async function resetAccountWorkspace({ userId, models, startSession }) {
  const session = await startSession();
  try {
    let deleted;
    await session.withTransaction(async () => {
      const owner = { user: userId };
      deleted = {};
      for (const [key, model] of [['tasks', models.Todo], ['documents', models.PDF], ['taskFolders', models.Folder], ['documentFolders', models.PDFFolder], ['calendarEntries', models.CalendarEntry]]) {
        const result = await model.deleteMany(owner, { session });
        deleted[key] = result.deletedCount;
      }
      if (models.AssistantConversation) {
        const result = await models.AssistantConversation.deleteMany(owner, { session });
        deleted.assistantConversations = result.deletedCount;
      }
      if (models.SavedJob) await models.SavedJob.deleteMany(owner, {session});
      if (models.ResumeDraft) await models.ResumeDraft.deleteMany(owner, {session});
      if (models.CoverLetterDraft) await models.CoverLetterDraft.deleteMany(owner, {session});
      if (models.TaskDeletionRecovery) await models.TaskDeletionRecovery.deleteMany(owner, {session});
      if (models.CalendarChange) await models.CalendarChange.deleteMany(owner, {session});
      const result = await models.User.updateOne({ _id: userId }, { $set: { canvasUrl: null, canvasToken: null, lastCanvasSync: null }, $unset: { geminiApiKeyEncrypted: 1, geminiApiKeyLastFour: 1, geminiApiKeyUpdatedAt: 1, workflowLayout: 1, hiddenCalendarIds: 1, hideTxstEvents: 1, calendarColors: 1, calendarCategories:1 }, $inc: { workflowRevision: 1 } }, { session });
      if (result.matchedCount !== 1) throw new Error('Account no longer exists.');
    });
    return deleted;
  } finally { await session.endSession(); }
}

module.exports = { resetAccountWorkspace };
