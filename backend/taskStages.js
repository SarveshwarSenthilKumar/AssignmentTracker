const builtIn = ['todo', 'in-progress', 'completed'];
const customId = value => typeof value === 'string' && /^stage-[a-f\d]{32}$/.test(value);
const invalid = message => Object.assign(new Error(message), { status: 400 });

function completionFields(status, previous, completedAt) {
  return { status, completedAt: status === 'completed' ? (previous === status && completedAt ? completedAt : new Date()) : null };
}

async function stageUpdate(Folder, task, destination, session) {
  let stage;
  if (!builtIn.includes(destination)) {
    if (!customId(destination) || !task.folder) throw invalid('Choose a stage in this task’s folder.');
    // Serialize moves into a custom stage with edits to that folder’s workflow.
    const folder = await Folder.findOneAndUpdate(
      { _id: task.folder, user: task.user, 'stages.id': destination },
      { $inc: { stageRevision: 1 } }, { session, new: true }
    );
    stage = folder?.stages.find(item => item.id === destination);
    if (!stage) throw invalid('This stage is no longer in the task’s folder.');
  }
  const status = stage ? (stage.complete ? 'completed' : 'in-progress') : destination;
  return { stageId: stage?.id || null, ...completionFields(status, task.status, task.completedAt) };
}

function registerTaskStages({ app, auth, mongoose, Folder, Todo }) {
  app.put('/api/folders/:id/stages', auth, async (req, res) => {
    const { stages, previousStages } = req.body || {};
    if (!/^[a-f\d]{24}$/i.test(req.params.id) || !Array.isArray(stages) || stages.length > 12 || !Array.isArray(previousStages) || previousStages.length > 12 ||
      stages.some(stage => !customId(stage?.id) || typeof stage.name !== 'string' || !stage.name.trim() || stage.name.trim().length > 48 || typeof stage.complete !== 'boolean') ||
      new Set(stages.map(stage => stage.id)).size !== stages.length ||
      new Set(stages.map(stage => stage.name.trim().toLowerCase())).size !== stages.length) {
      return res.status(400).json({ message: 'Use up to 12 stages with distinct names of 1–48 characters.' });
    }
    const next = stages.map(({ id, name, complete }) => ({ id, name: name.trim(), complete }));
    const filter = { _id: req.params.id, user: req.user.userId };
    let session;
    try {
      session = await mongoose.startSession();
      let saved;
      await session.withTransaction(async () => {
        const folder = await Folder.findOne(filter).session(session);
        if (!folder) throw Object.assign(new Error('Folder no longer exists.'), { status: 404 });
        const current = folder.stages.map(({ id, name, complete }) => ({ id, name, complete }));
        if (current.length !== previousStages.length || current.some((item, i) => {
          const previous = previousStages[i];
          return item.id !== previous?.id || item.name !== previous.name || item.complete !== previous.complete;
        })) throw Object.assign(new Error('These stages changed elsewhere. Reopen the editor and try again.'), { status: 409 });
        folder.stages = next;
        await folder.save({ session });
        for (const previous of current) {
          const updated = next.find(stage => stage.id === previous.id);
          const tasks = { user: req.user.userId, folder: folder._id, stageId: previous.id };
          if (!updated) {
            // Keep each task’s current completion and return it to the matching built-in column.
            await Todo.updateMany(tasks, { $set: { stageId: null } }, { session });
          } else if (updated.complete !== previous.complete) {
            const status = updated.complete ? 'completed' : 'in-progress';
            await Todo.updateMany(tasks, { $set: completionFields(status) }, { session });
          }
        }
        saved = folder;
      });
      res.json(saved);
    } catch (error) {
      res.status(error.status || 500).json({ message: error.status ? error.message : 'Could not save the folder stages.' });
    } finally { if (session) await session.endSession(); }
  });
}

module.exports = { stageUpdate, registerTaskStages };
