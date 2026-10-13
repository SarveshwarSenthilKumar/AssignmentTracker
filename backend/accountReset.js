async function resetAccountWorkspace({ userId, models, startSession }) {
  const session = await startSession();
  try {
    let deleted;
    await session.withTransaction(async () => {
      const owner = { user: userId };
      deleted = {};
      for (const [key, model] of [['tasks', models.Todo], ['documents', models.PDF], ['taskFolders', models.Folder], ['documentFolders', models.PDFFolder]]) {
        const result = await model.deleteMany(owner, { session });
        deleted[key] = result.deletedCount;
      }
      const result = await models.User.updateOne({ _id: userId }, { $set: { canvasUrl: null, canvasToken: null, lastCanvasSync: null } }, { session });
      if (result.matchedCount !== 1) throw new Error('Account no longer exists.');
    });
    return deleted;
  } finally { await session.endSession(); }
}

module.exports = { resetAccountWorkspace };
