module.exports = function registerSharedFolders(app, auth, { User, PDF, PDFFolder }) {
  const base = '/api/shared-folders';
  const validId = id => /^[a-f\d]{24}$/i.test(id);
  const route = handler => [auth, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    if ([req.params.id, req.params.fileId, req.params.memberId].some(id => id !== undefined && !validId(id))) {
      return res.status(400).json({ message: 'Invalid folder, document, or account ID.' });
    }
    try {
      await handler(req, res);
    } catch {
      res.status(500).json({ message: 'Could not complete the shared folder request.' });
    }
  }];
  const ownedFolder = req => PDFFolder.findOne({ _id: req.params.id, user: req.user.userId }).select('+sharedWith');
  const memberFolder = req => PDFFolder.findOne({ _id: req.params.id, sharedWith: req.user.userId }).select('name user').lean();
  const ownerLocks = async id => (await User.findById(id).select('lockedSections').lean())?.lockedSections ?? [];

  async function accessibleFolder(req) {
    const folder = await memberFolder(req);
    if (!folder) return null;
    const locks = await ownerLocks(folder.user);
    if (locks.includes('documents') || locks.includes(`documents:${folder._id}`)) return null;
    // A shared folder can be moved under a locked parent after sharing.
    const ancestors = await PDFFolder.find({ user: folder.user }).select('parentId').lean();
    const parents = new Map(ancestors.map(item => [String(item._id), item.parentId]));
    const seen = new Set();
    for (let id = parents.get(String(folder._id)); id; id = parents.get(String(id))) {
      if (seen.has(String(id)) || locks.includes(`documents:${id}`)) return null;
      seen.add(String(id));
    }
    return { folder, locks };
  }

  app.get(base, ...route(async (req, res) => {
    const folders = await PDFFolder.find({ sharedWith: req.user.userId }).select('name').sort('name').lean();
    res.json(folders);
  }));
  app.get(`${base}/:id/members`, ...route(async (req, res) => {
    const folder = await ownedFolder(req);
    if (!folder) return res.status(404).json({ message: 'Folder not found.' });
    res.json(await User.find({ _id: { $in: folder.sharedWith } }).select('username email').lean());
  }));
  app.post(`${base}/:id/members`, ...route(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!email || email.length > 254) return res.status(400).json({ message: 'Enter the email of an existing account.' });
    const folder = await ownedFolder(req);
    if (!folder) return res.status(404).json({ message: 'Folder not found.' });
    const member = await User.findOne({ email }).select('username email').lean();
    if (!member || String(member._id) === String(req.user.userId)) {
      return res.status(400).json({ message: 'Choose another existing AssignmentTracker account.' });
    }
    const result = await PDFFolder.updateOne({ _id: folder._id, user: req.user.userId }, { $addToSet: { sharedWith: member._id } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Folder not found.' });
    res.json(member);
  }));
  app.delete(`${base}/:id/members/:memberId`, ...route(async (req, res) => {
    const result = await PDFFolder.updateOne({ _id: req.params.id, user: req.user.userId }, { $pull: { sharedWith: req.params.memberId } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Folder not found.' });
    res.status(204).end();
  }));
  app.get(`${base}/:id`, ...route(async (req, res) => {
    const access = await accessibleFolder(req);
    if (!access) return res.status(404).json({ message: 'This shared folder is unavailable.' });
    const { folder, locks } = access;
    const files = await PDF.find({ user: folder.user, pdfFolder: folder._id, deletedAt: null })
      .select('name originalName mimeType').sort('name').lean();
    res.json({ name: folder.name, files: files.filter(file => !locks.includes(`file:${file._id}`)) });
  }));
  app.get(`${base}/:id/files/:fileId`, ...route(async (req, res) => {
    const access = await accessibleFolder(req);
    if (!access || access.locks.includes(`file:${req.params.fileId.toLowerCase()}`)) {
      return res.status(404).json({ message: 'This shared document is unavailable.' });
    }
    const file = await PDF.findOne({ _id: req.params.fileId, user: access.folder.user, pdfFolder: access.folder._id, deletedAt: null })
      .select('originalName pdfData');
    if (!file) return res.status(404).json({ message: 'This shared document is unavailable.' });
    res.set('X-Content-Type-Options', 'nosniff');
    res.attachment(file.originalName).type('application/octet-stream').send(file.pdfData);
  }));
};
