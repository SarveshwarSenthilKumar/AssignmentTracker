const { createHash, randomBytes } = require('node:crypto');

const hashToken = token => createHash('sha256').update(token).digest('hex');
const validId = id => /^[a-f\d]{24}$/i.test(id);
const editable = file => /\.(md|markdown|txt)$/i.test(file.originalName || '') &&
  /^(text\/plain|text\/markdown|application\/octet-stream)(;|$)/i.test(file.mimeType || '');

module.exports = function registerDocumentShareLinks(app, auth, { User, PDF, PDFFolder }) {
  async function isLocked(file) {
    const owner = await User.findById(file.user).select('lockedSections').lean();
    if (!owner) return true;
    const locks = new Set(owner.lockedSections);
    if (locks.has('documents') || locks.has(`file:${file._id}`)) return true;
    const seen = new Set();
    for (let id = file.pdfFolder; id;) {
      const key = String(id);
      if (seen.has(key) || locks.has(`documents:${key}`)) return true;
      seen.add(key);
      const folder = await PDFFolder.findOne({ _id: id, user: file.user }).select('parentId').lean();
      if (!folder) return true;
      id = folder.parentId;
    }
    return false;
  }

  const ownerRoute = handler => [auth, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid document ID.' });
    try {
      const filter = { _id: req.params.id, user: req.user.userId };
      const file = await PDF.findOne(filter).select('user pdfFolder deletedAt originalName mimeType +shareLinkHash +shareLinkRole').lean();
      if (!file) return res.status(404).json({ message: 'Document not found.' });
      await handler(res, filter, file, req);
    } catch {
      res.status(500).json({ message: 'Could not manage this share link.' });
    }
  }];

  const path = '/api/pdfs/:id/share-link';
  app.get(path, ...ownerRoute((res, _filter, file) => {
    res.json({ active: !!file.shareLinkHash, role: file.shareLinkRole || 'view', canEdit: editable(file) });
  }));
  app.post(path, ...ownerRoute(async (res, filter, file, req) => {
    const role = req.body?.role ?? 'view';
    if (!['view', 'edit'].includes(role) || (role === 'edit' && !editable(file))) {
      return res.status(400).json({ message: 'Editor links are available for Markdown and plain-text files.' });
    }
    if (file.deletedAt || await isLocked(file)) {
      return res.status(403).json({ message: 'Remove the applicable lock or restore the document before creating a share link.' });
    }
    const token = randomBytes(32).toString('base64url');
    const result = await PDF.updateOne({ ...filter, deletedAt: null }, { $set: { shareLinkHash: hashToken(token), shareLinkRole: role } });
    if (!result.matchedCount) return res.status(404).json({ message: 'Document not found.' });
    res.status(201).json({ path: role === 'edit' ? `#/shared-document/${token}` : `/api/shared-document/${token}`, role });
  }));
  app.delete(path, ...ownerRoute(async (res, filter) => {
    await PDF.updateOne(filter, { $unset: { shareLinkHash: 1, shareLinkRole: 1 } });
    res.status(204).end();
  }));

  const publicText = write => async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
    const unavailable = () => res.status(404).json({ message: 'This editor link is unavailable.' });
    if (!/^[A-Za-z0-9_-]{43}$/.test(req.params.token)) return unavailable();
    try {
      const filter = { shareLinkHash: hashToken(req.params.token), shareLinkRole: 'edit', deletedAt: null };
      const file = await PDF.findOne(filter).select('name user pdfFolder originalName mimeType pdfData originalBackup');
      if (!file || !editable(file) || await isLocked(file)) return unavailable();
      const text = file.pdfData.toString('utf8');
      if (file.pdfData.length > 1024 * 1024 || !Buffer.from(text).equals(file.pdfData)) {
        return res.status(422).json({ message: 'Live editing requires a UTF-8 text file up to 1 MB.' });
      }
      const revision = bytes => createHash('sha256').update(bytes).digest('hex');
      const version = revision(file.pdfData);
      if (!write) return res.json({ name: file.name, text, revision: version });
      const { text: draft, baseRevision } = req.body || {};
      if (typeof draft !== 'string' || Buffer.byteLength(draft) > 1024 * 1024 || typeof baseRevision !== 'string') {
        return res.status(400).json({ message: 'Live editing supports text up to 1 MB.' });
      }
      if (baseRevision === version) {
        const bytes = Buffer.from(draft);
        const result = await PDF.updateOne({ ...filter, _id: file._id, pdfFolder: file.pdfFolder ?? null, pdfData: file.pdfData }, {
          $set: { pdfData: bytes, originalBackup: file.originalBackup || file.pdfData, updatedAt: new Date() }
        });
        if (result.matchedCount) return res.json({ text: draft, revision: revision(bytes) });
      }
      res.status(409).json({ message: 'Another editor saved changes. Your draft is still available.' });
    } catch {
      res.status(503).json({ message: 'Could not synchronize this document.' });
    }
  };
  app.get('/api/shared-document/:token/text', publicText(false));
  app.put('/api/shared-document/:token/text', publicText(true));

  app.get('/api/shared-document/:token', async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    const unavailable = () => res.status(404).type('text/plain').send('This document link is unavailable.');
    if (!/^[A-Za-z0-9_-]{43}$/.test(req.params.token)) return unavailable();
    try {
      const filter = { shareLinkHash: hashToken(req.params.token), deletedAt: null };
      const file = await PDF.findOne(filter).select('user pdfFolder').lean();
      if (!file || await isLocked(file)) return unavailable();
      const download = await PDF.findOne({ ...filter, _id: file._id, pdfFolder: file.pdfFolder ?? null }).select('originalName pdfData');
      if (!download) return unavailable();
      res.attachment(download.originalName).type('application/octet-stream').send(download.pdfData);
    } catch {
      res.status(503).type('text/plain').send('This document link could not be opened. Try again later.');
    }
  });
};
