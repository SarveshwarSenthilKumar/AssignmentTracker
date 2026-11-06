const HOUR_MS = 3600000;

module.exports = function startCompletedTaskCleanup({ User, Todo, remove }) {
  let running = false;
  async function sweep() {
    if (running || User.db.readyState !== 1) return;
    running = true;
    try {
      const accounts = User.find({ completedTaskRetentionDays: { $gte: 1, $lte: 3650 } })
        .select('completedTaskRetentionDays').lean().cursor();
      for await (const account of accounts) {
        const cutoff = new Date(Date.now() - account.completedTaskRetentionDays * 24 * HOUR_MS);
        const filter = {
          user: account._id,
          status: 'completed',
          canvasType: { $ne: 'calendar_event' },
          completedAt: { $type: 'date', $lte: cutoff },
          $or: [{ restoredAt: null }, { restoredAt: { $lte: cutoff } }]
        };
        const candidates = await Todo.find(filter).sort({ completedAt: 1 }).limit(25).select('_id').lean();
        for (const candidate of candidates) {
          const enabled = await User.exists({ _id: account._id, completedTaskRetentionDays: account.completedTaskRetentionDays });
          if (!enabled) break;
          try { await remove({ ...filter, _id: candidate._id }); }
          catch (error) { console.error('Could not move a completed task to Recently deleted:', error.name); }
        }
      }
    } catch (error) {
      console.error('Completed task cleanup could not finish:', error.name);
    } finally { running = false; }
  }
  const timer = setInterval(sweep, HOUR_MS);
  timer.unref();
};
