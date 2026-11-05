const positive = value => Number.isSafeInteger(value) && value > 0 && value <= 1000000000;
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;

function validateProgressConfig(body) {
  if (!positive(body.progressTarget)) throw new Error('Choose a whole-number target from 1 to 1,000,000,000.');
  if (body.progressUnit !== undefined && (typeof body.progressUnit !== 'string' || body.progressUnit.trim().length > 40)) throw new Error('Use a unit name of up to 40 characters.');
  if (body.progressAutoComplete !== undefined && typeof body.progressAutoComplete !== 'boolean') throw new Error('Choose whether to complete the task automatically.');
  return {
    progressTarget: body.progressTarget,
    progressUnit: (body.progressUnit || '').trim(),
    ...(body.progressAutoComplete !== undefined ? { progressAutoComplete: body.progressAutoComplete } : {})
  };
}

function completeReachedGoal() {
  const reached = { $and: [
    { $eq: ['$progressAutoComplete', true] },
    { $ne: ['$status', 'completed'] },
    { $gt: ['$progressTarget', 0] },
    { $gte: [{ $sum: '$progressLogs.amount' }, '$progressTarget'] }
  ] };
  return { $set: {
    status: { $cond: [reached, 'completed', '$status'] },
    completedAt: { $cond: [reached, '$$NOW', '$completedAt'] }
  } };
}

function register({ app, Todo, authenticateToken }) {
  const route = '/api/todos/:id([a-fA-F0-9]{24})/progress';
  app.put(route, authenticateToken, async (req, res) => {
    let config;
    try { config = validateProgressConfig(req.body); }
    catch (error) { return res.status(400).json({ message: error.message }); }
    try {
      const settings = Object.fromEntries(Object.entries(config).map(([key, value]) => [key, { $literal: value }]));
      const task = await Todo.findOneAndUpdate(
        { _id: req.params.id, user: req.user.userId },
        [{ $set: settings }, completeReachedGoal()],
        { new: true, updatePipeline: true }
      );
      if (!task) return res.status(404).json({ message: 'Task not found.' });
      res.json(task);
    } catch { res.status(500).json({ message: 'Could not save the progress target.' }); }
  });
  app.post(`${route}/entries`, authenticateToken, async (req, res) => {
    const { id, day, amount } = req.body || {};
    if (typeof id !== 'string' || !/^[a-f\d-]{36}$/i.test(id) || !validDay(day) || !positive(amount)) return res.status(400).json({ message: 'Choose a valid day and a positive whole-number amount up to 1,000,000,000.' });
    // Dates are calendar labels in the user's chosen zone; allow the current day anywhere.
    if (day > new Date(Date.now() + 14 * 3600000).toISOString().slice(0, 10)) return res.status(400).json({ message: 'Progress cannot be recorded for a future day.' });
    try {
      const owner = { _id: req.params.id, user: req.user.userId };
      const logs = { $ifNull: ['$progressLogs', []] };
      const entry = { id, day, amount, createdAt: new Date() };
      const task = await Todo.findOneAndUpdate(
        { ...owner, progressTarget: { $gt: 0 }, 'progressLogs.id': { $ne: id }, $expr: { $lt: [{ $size: logs }, 10000] } },
        [{ $set: { progressLogs: { $concatArrays: [logs, { $literal: [entry] }] } } }, completeReachedGoal()],
        { new: true, updatePipeline: true }
      );
      if (task) return res.json(task);
      const current = await Todo.findOne(owner);
      if (!current) return res.status(404).json({ message: 'Task not found.' });
      // A retry of the same entry must not count twice.
      if (current.progressLogs.some(log => log.id === id)) {
        const existing = current.progressLogs.find(log => log.id === id);
        if (existing.day !== day || existing.amount !== amount) return res.status(409).json({ message: 'This entry changed. Reopen the task and try again.' });
        return res.json(current);
      }
      res.status(409).json({ message: current.progressTarget ? 'This task has reached its 10,000-entry limit.' : 'Set a progress target first.' });
    } catch { res.status(500).json({ message: 'Could not log progress. Retry the same entry to avoid counting it twice.' }); }
  });
  app.delete(`${route}/entries/:entryId`, authenticateToken, async (req, res) => {
    if (!/^[a-f\d-]{36}$/i.test(req.params.entryId)) return res.status(400).json({ message: 'Invalid progress entry.' });
    try {
      const task = await Todo.findOneAndUpdate({ _id: req.params.id, user: req.user.userId }, { $pull: { progressLogs: { id: req.params.entryId } } }, { new: true });
      if (!task) return res.status(404).json({ message: 'Task not found.' });
      res.json(task);
    } catch { res.status(500).json({ message: 'Could not remove the progress entry.' }); }
  });
}
module.exports = { register, validateProgressConfig };
