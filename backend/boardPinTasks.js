const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const pinId = value => typeof value === 'string' && /^[a-z\d_-]{1,80}$/i.test(value);

module.exports = function registerBoardPinTasks(app, auth, { DetectiveWall, PDF, Todo, isLocked, received, collaboratorAccess }) {
  async function whiteboardFor(id, user, includeNotes = false) {
    const board = await PDF.findOne({ _id: id, deletedAt: null, documentKind: 'whiteboard' })
      .select('user pdfFolder +revokedCollaborators +shareLinkHash +shareLinkRole +shareLinkExpiresAt' + (includeNotes ? ' annotations' : '')).lean();
    if (!board) return null;
    if (String(board.user) === String(user)) return includeNotes && await isLocked(board) ? null : { board, owned: true };
    if (board.shareLinkRole !== 'edit' || collaboratorAccess.blocked(board, collaboratorAccess.forFile({ accountId: user }, board)) ||
      await isLocked(board)) return null;
    const path = await received.linkFor(board, user);
    return path ? { board, path } : null;
  }

  app.get('/api/board-pins/whiteboards/:id', auth, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid whiteboard.' });
    try {
      const access = await whiteboardFor(req.params.id, req.user.userId);
      if (!access) return res.status(404).json({ message: 'This whiteboard is unavailable.' });
      return res.json({ owned: !!access.owned, path: access.path });
    } catch {
      return res.status(503).json({ message: 'Could not open this whiteboard.' });
    }
  });

  app.post('/api/todos/from-board-pin', auth, async (req, res) => {
    const { kind, boardId, noteId, taskId, title } = req.body || {};
    if (!['detective-wall', 'whiteboard'].includes(kind) || !validId(boardId) || !pinId(noteId) ||
      !validId(taskId) || typeof title !== 'string' || !title.trim() || title.trim().length > 1000) {
      return res.status(400).json({ message: 'Enter a task title and choose a valid sticky note.' });
    }
    const user = req.user.userId;
    const taskFilter = { _id: taskId, user };
    const link = '#/' + (kind === 'whiteboard' ? 'documents' : kind) + '/' + boardId.toLowerCase() + '/pin/' + noteId;
    try {
      const existing = await Todo.findOne({ ...taskFilter, links: link });
      if (existing) return res.json(existing);
      let note;
      if (kind === 'detective-wall') {
        const wall = await DetectiveWall.findOne({ _id: boardId, user }).select('state.nodes').lean();
        note = wall?.state?.nodes?.find(item => item.id === noteId && item.type === 'note');
      } else {
        const access = await whiteboardFor(boardId, user, true);
        if (access) note = access.board.annotations?.find(item => item.id === noteId && item.stickyNote);
      }
      if (!note) return res.status(404).json({ message: 'This sticky note is unavailable. Save the board and try again.' });
      const task = await Todo.create({ _id: taskId, user, text: title.trim(), description: String(note.text || '').trim(), links: [link] });
      return res.status(201).json(task);
    } catch (error) {
      if (error.code === 11000) {
        const existing = await Todo.findOne({ ...taskFilter, links: link }).catch(() => null);
        if (existing) return res.json(existing);
        return res.status(409).json({ message: 'This task could not be recreated. Reopen the task form and try again.' });
      }
      return res.status(503).json({ message: 'Could not create a task from this note.' });
    }
  });
};
