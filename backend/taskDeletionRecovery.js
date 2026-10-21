// Keep deletion snapshots outside the active task collection, so existing task
// queries and integrations never mistake deleted tasks for active ones.
module.exports = function createTaskDeletionRecovery({ mongoose, Todo, Folder, app, authenticateToken }) {
  const Recovery = mongoose.model('TaskDeletionRecovery', new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    tasks: [mongoose.Schema.Types.Mixed],
    connections: [mongoose.Schema.Types.Mixed],
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, expires: 0 },
  }));
  async function remove(filter) {
    const session = await mongoose.startSession();
    let result;
    try {
      await session.withTransaction(async () => {
        const tasks = await Todo.find(filter).session(session).lean();
        const ids = tasks.map(task => task._id);
        if (!ids.length) { result = { deletedCount: 0, deletedIds: [] }; return; }
        const linked = await Todo.find({ user: filter.user, _id: { $nin: ids }, dependsOn: { $in: ids } }).select('_id dependsOn').session(session).lean();
        const removed = new Set(ids.map(String));
        const [recovery] = await Recovery.create([{
          user: filter.user, tasks,
          connections: linked.map(task => ({ id: task._id, dependsOn: task.dependsOn.filter(id => removed.has(String(id))) })),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        }], { session });
        const deleted = await Todo.deleteMany({ user: filter.user, _id: { $in: ids } }, { session });
        await Todo.updateMany({ user: filter.user, dependsOn: { $in: ids } }, { $pull: { dependsOn: { $in: ids } } }, { session });
        result = { deletedCount: deleted.deletedCount, deletedIds: ids.map(String), undoId: String(recovery._id) };
      });
      return result;
    } finally { await session.endSession(); }
  }
  app.get('/api/todos/deletion-history', authenticateToken, async (req, res) => {
    try {
      const records = await Recovery.find({ user: req.user.userId, expiresAt: { $gt: new Date() } }).select('_id createdAt expiresAt tasks.text').sort({ createdAt: -1, _id: -1 }).limit(20).lean();
      res.json(records.map(record => ({ _id: record._id, count: record.tasks.length, label: record.tasks.length === 1 ? record.tasks[0].text : `${record.tasks.length} tasks`, expiresAt: record.expiresAt })));
    } catch { res.status(500).json({ message: 'Could not load deleted task history.' }); }
  });
  app.post('/api/todos/deletion-history/:id/undo', authenticateToken, async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid task deletion.' });
    const session = await mongoose.startSession();
    try {
      let restored;
      await session.withTransaction(async () => {
        const record = await Recovery.findOne({ _id: req.params.id, user: req.user.userId, expiresAt: { $gt: new Date() } }).session(session).lean();
        if (!record) { const error = new Error('This deletion was already undone or its seven-day recovery period expired.'); error.status = 404; throw error; }
        const folderIds = [...new Set(record.tasks.map(task => task.folder).filter(Boolean).map(String))];
        const folders = new Set((await Folder.find({ user: req.user.userId, _id: { $in: folderIds } }).select('_id').session(session).lean()).map(folder => String(folder._id)));
        const active = await Todo.find({ user: req.user.userId }).select('_id').session(session).lean();
        const activeIds = new Set(active.map(task => String(task._id)));
        const validIds = new Set([...activeIds, ...record.tasks.map(task => String(task._id))]);
        const tasks = record.tasks.filter(task => !activeIds.has(String(task._id))).map(task => ({ ...task, folder: task.folder && folders.has(String(task.folder)) ? task.folder : null, dependsOn: (task.dependsOn || []).filter(id => validIds.has(String(id))) }));
        if (tasks.length) await Todo.insertMany(tasks, { session });
        for (const edge of record.connections) {
          const dependencies = edge.dependsOn.filter(id => validIds.has(String(id)));
          if (dependencies.length) await Todo.updateOne({ _id: edge.id, user: req.user.userId }, { $addToSet: { dependsOn: { $each: dependencies } } }, { session });
        }
        await Recovery.deleteOne({ _id: record._id, user: req.user.userId }, { session });
        restored = tasks.length;
      });
      res.json({ restoredCount: restored });
    } catch (error) { res.status(error.status || 500).json({ message: error.status ? error.message : 'Could not restore tasks. No partial restore was saved.' }); }
    finally { await session.endSession(); }
  });
  return { remove, Recovery };
};
