const { createHash } = require('node:crypto');
const {appendHistory,historyPage}=require('./documentEditHistory');

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
  const ownedFolder = req => PDFFolder.findOne({ _id: req.params.id, user: req.user.userId }).select('+sharedWith +sharedEditors');
  const memberFolder = req => PDFFolder.findOne({ _id: req.params.id, sharedWith: req.user.userId }).select('name user').lean();
  const ownerLocks = async id => (await User.findById(id).select('lockedSections').lean())?.lockedSections ?? [];
  const editable = file => /\.(md|markdown|txt)$/i.test(file.originalName || '') &&
    /^(text\/plain|text\/markdown|application\/octet-stream)(;|$)/i.test(file.mimeType || '');
  const revision = bytes => createHash('sha256').update(bytes).digest('hex');
  const collaboratorId = (fileId,userId) => createHash('sha256').update(`${String(fileId).toLowerCase()}:account:${String(userId).toLowerCase()}`).digest('hex').slice(0,24);
  const collaboratorFilter = (req,access) => access.owned?{}:{revokedCollaborators:{$ne:collaboratorId(req.params.fileId,req.user.userId)}};

  async function accessibleFolder(req) {
    const owned = await ownedFolder(req);
    const folder = owned || await memberFolder(req);
    if (!folder) return null;
    const owner = await User.findById(folder.user).select('deactivatedAt approvalPending').lean();
    if (!owner || owner.deactivatedAt || owner.approvalPending) return null;
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
    return { folder, locks, owned: !!owned };
  }

  app.get(base, ...route(async (req, res) => {
    const folders = await PDFFolder.find({ sharedWith: req.user.userId }).select('name').sort('name').lean();
    res.json(folders);
  }));
  app.get(`${base}/:id/members`, ...route(async (req, res) => {
    const folder = await ownedFolder(req);
    if (!folder) return res.status(404).json({ message: 'Folder not found.' });
    const editors = new Set(folder.sharedEditors.map(String));
    const members = await User.find({ _id: { $in: folder.sharedWith } }).select('username email').lean();
    res.json(members.map(member => ({ ...member, role: editors.has(String(member._id)) ? 'edit' : 'view' })));
  }));
  app.post(`${base}/:id/members`, ...route(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const role = req.body?.role ?? 'view';
    if (!['view', 'edit'].includes(role)) return res.status(400).json({ message: 'Choose a sharing permission.' });
    if (!email || email.length > 254) return res.status(400).json({ message: 'Enter the email of an existing account.' });
    const folder = await ownedFolder(req);
    if (!folder) return res.status(404).json({ message: 'Folder not found.' });
    const member = await User.findOne({ email }).select('username email').lean();
    if (!member || String(member._id) === String(req.user.userId)) {
      return res.status(400).json({ message: 'Choose another existing AssignmentTracker account.' });
    }
    const result = await PDFFolder.updateOne({ _id: folder._id, user: req.user.userId }, role === 'edit'
      ? { $addToSet: { sharedWith: member._id, sharedEditors: member._id } }
      : { $addToSet: { sharedWith: member._id }, $pull: { sharedEditors: member._id } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Folder not found.' });
    res.json({ ...member, role });
  }));
  app.delete(`${base}/:id/members/:memberId`, ...route(async (req, res) => {
    const result = await PDFFolder.updateOne({ _id: req.params.id, user: req.user.userId }, { $pull: { sharedWith: req.params.memberId, sharedEditors: req.params.memberId } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Folder not found.' });
    res.status(204).end();
  }));
  app.get(`${base}/:id`, ...route(async (req, res) => {
    const access = await accessibleFolder(req);
    if (!access) return res.status(404).json({ message: 'This shared folder is unavailable.' });
    const { folder, locks } = access;
    const files = await PDF.find({ user: folder.user, pdfFolder: folder._id, deletedAt: null })
      .select('name originalName mimeType +revokedCollaborators').sort('name').lean();
    const canEdit = access.owned || !!await PDFFolder.exists({ _id: folder._id, sharedWith: req.user.userId, sharedEditors: req.user.userId });
    res.json({ name: folder.name, files: files.filter(file => !locks.includes(`file:${file._id}`)&&(access.owned||!(file.revokedCollaborators||[]).includes(collaboratorId(file._id,req.user.userId)))).map(({revokedCollaborators,...file}) => ({ ...file, canEdit: canEdit && editable(file) })) });
  }));

  const editText = write => async (req, res) => {
    const access = await accessibleFolder(req);
    const userId = req.user.userId;
    if (!access || (!access.owned && !await PDFFolder.exists({ _id: access.folder._id, sharedWith: userId, sharedEditors: userId })) ||
        access.locks.includes(`file:${req.params.fileId.toLowerCase()}`)) {
      return res.status(404).json({ message: 'You do not have edit access to this document.' });
    }
    const filter = { _id: req.params.fileId, user: access.folder.user, pdfFolder: access.folder._id, deletedAt: null, ...collaboratorFilter(req,access) };
    const file = await PDF.findOne(filter).select('originalName mimeType pdfData originalBackup +editHistory');
    if (!file || !editable(file)) return res.status(404).json({ message: 'This document is unavailable for live editing.' });
    if (file.pdfData.length > 1024 * 1024 || !Buffer.from(file.pdfData.toString('utf8')).equals(file.pdfData)) {
      return res.status(422).json({ message: 'Live editing requires a UTF-8 text file up to 1 MB.' });
    }
    const version = revision(file.pdfData);
    if (!write) return res.json({ text: file.pdfData.toString('utf8'), revision: version });
    const { text, baseRevision } = req.body || {};
    if (typeof text !== 'string' || Buffer.byteLength(text) > 1024 * 1024 || typeof baseRevision !== 'string') {
      return res.status(400).json({ message: 'Live editing supports text up to 1 MB.' });
    }
    if (baseRevision === version) {
      const bytes = Buffer.from(text);
      if (bytes.equals(file.pdfData)) return res.json({ text, revision: version });
      const update = await PDF.updateOne({ ...filter, pdfData: file.pdfData }, {
        $set: { pdfData: bytes, originalBackup: file.originalBackup || file.pdfData,editHistory:appendHistory(file,req.user,{pdfData:bytes,action:'Edited text'}), updatedAt: new Date() }
      });
      if (update.matchedCount) return res.json({ text, revision: revision(bytes) });
    }
    res.status(409).json({ message: 'Another editor saved changes. Your draft is still available.' });
  };
  app.get(`${base}/:id/files/:fileId/text`, ...route(editText(false)));
  app.put(`${base}/:id/files/:fileId/text`, ...route(editText(true)));
  app.get(`${base}/:id/files/:fileId/history`,...route(async(req,res)=>{
    const access=await accessibleFolder(req);
    if(!access||access.locks.includes(`file:${req.params.fileId.toLowerCase()}`))return res.status(404).json({message:'This document history is unavailable.'});
    const file=await PDF.findOne({_id:req.params.fileId,user:access.folder.user,pdfFolder:access.folder._id,deletedAt:null,...collaboratorFilter(req,access)}).select('_id +editHistory').lean();
    if(!file)return res.status(404).json({message:'This document history is unavailable.'});
    res.json(historyPage(file,req.query));
  }));
  app.get(`${base}/:id/files/:fileId`, ...route(async (req, res) => {
    const access = await accessibleFolder(req);
    if (!access || access.locks.includes(`file:${req.params.fileId.toLowerCase()}`)) {
      return res.status(404).json({ message: 'This shared document is unavailable.' });
    }
    const file = await PDF.findOne({ _id: req.params.fileId, user: access.folder.user, pdfFolder: access.folder._id, deletedAt: null, ...collaboratorFilter(req,access) })
      .select('originalName pdfData');
    if (!file) return res.status(404).json({ message: 'This shared document is unavailable.' });
    res.set('X-Content-Type-Options', 'nosniff');
    res.attachment(file.originalName).type('application/octet-stream').send(file.pdfData);
  }));
};
