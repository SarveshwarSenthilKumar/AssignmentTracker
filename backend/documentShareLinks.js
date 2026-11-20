const { createHash, randomBytes } = require('node:crypto');
const { insertPDFPages, deletePDFPage } = require('./pdfPages');
const { mergeText } = require('./liveText');

const hashToken = token => createHash('sha256').update(token).digest('hex');
const validId = id => /^[a-f\d]{24}$/i.test(id);
const editable = file => /\.(md|markdown|txt)$/i.test(file.originalName || '') &&
  /^(text\/plain|text\/markdown|application\/octet-stream)(;|$)/i.test(file.mimeType || '');

module.exports = function registerDocumentShareLinks(app, auth, { User, PDF, PDFFolder }) {
  const contentRevision = file => createHash('sha256').update(file.pdfData).digest('hex');
  const normalized = annotations => (annotations || []).map((item, index) => item.id ? item : { ...item, id: `legacy-${index}-${createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0, 16)}` });
  const live = shared => async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
    if (shared ? !/^[A-Za-z0-9_-]{43}$/.test(req.params.token) : !validId(req.params.id)) return res.status(404).json({ message: 'Document unavailable.' });
    const filter = shared ? { shareLinkHash: hashToken(req.params.token), shareLinkRole: 'edit', deletedAt: null } : { _id: req.params.id, user: req.user.userId, deletedAt: null };
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const file = await PDF.findOne(filter);
        if (!file || await isLocked(file)) return res.status(404).json({ message: 'This document or editor link is unavailable.' });
        const content = contentRevision(file);
        let annotations = normalized(file.annotations);
        if (req.method === 'PUT') {
          const { upserts, removed, patches = [], contentRevision: base } = req.body || {};
          if (base !== content) return res.status(409).json({ message: 'The document pages changed. Synchronize before saving annotations.', contentChanged: true });
          if (!Array.isArray(upserts) || !Array.isArray(removed) || upserts.some(item => !item || typeof item.id !== 'string' || item.id.length > 200) || removed.some(id => typeof id !== 'string' || id.length > 200)) return res.status(400).json({ message: 'Invalid annotation changes.' });
          const validKey = key => typeof key === 'string' && !['id', '__proto__', 'constructor', 'prototype'].includes(key);
          if (!Array.isArray(patches) || patches.some(patch => !patch || typeof patch.id !== 'string' || !patch.set || typeof patch.set !== 'object' || Array.isArray(patch.set) || !Array.isArray(patch.unset) || !Object.keys(patch.set).every(validKey) || !patch.unset.every(validKey))) return res.status(400).json({ message: 'Invalid annotation property changes.' });
          const edits = new Map(patches.map(patch => [patch.id, patch]));
          const items = new Map(annotations.map(item => [item.id, item]));
          for (const id of removed) items.delete(id);
          for (const item of upserts) {
            const patch = edits.get(item.id);
            if (patch && items.has(item.id)) {
              const merged = { ...items.get(item.id), ...patch.set };
              for (const key of patch.unset) delete merged[key];
              items.set(item.id, merged);
            } else items.set(item.id, item);
          }
          annotations = [...items.values()];
          if (Buffer.byteLength(JSON.stringify(annotations)) > 12 * 1024 * 1024) return res.status(413).json({ message: 'Annotations exceed the 12 MB limit.' });
          const result = await PDF.updateOne({ ...filter, _id: file._id, updatedAt: file.updatedAt, pdfData: file.pdfData, annotations: file.annotations }, { $set: { annotations, updatedAt: new Date() } }, { runValidators: true });
          if (!result.matchedCount) continue;
        }
        const revision = createHash('sha256').update(file.pdfData).update(JSON.stringify(annotations)).digest('hex');
        res.set('X-Share-Revision', revision);
        if (req.method === 'GET' && req.query.revision === revision && req.query.contentRevision === content) return res.status(204).end();
        return res.json({ _id: file._id, name: file.name, originalName: file.originalName, mimeType: file.mimeType, tags: file.tags, annotations, contentRevision: content, revision,
          ...(req.method === 'GET' && req.query.contentRevision !== content && { pdfData: file.pdfData.toString('base64') }) });
      }
      res.status(409).json({ message: 'Other edits are arriving. Retrying will merge your changes.' });
    } catch { res.status(503).json({ message: 'Live synchronization is temporarily unavailable. Your local edits are retained.' }); }
  };
  app.get('/api/pdfs/:id/live', auth, live(false));
  app.put('/api/pdfs/:id/live', auth, live(false));
  app.get('/api/shared-document/:token/live', live(true));
  app.put('/api/shared-document/:token/live', live(true));
  async function isLocked(file) {
    const owner = await User.findById(file.user).select('lockedSections deactivatedAt approvalPending').lean();
    if (!owner || owner.deactivatedAt || owner.approvalPending) return true;
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
    res.json({ active: !!file.shareLinkHash, role: file.shareLinkRole || 'view', canEdit: true });
  }));
  app.post(path, ...ownerRoute(async (res, filter, file, req) => {
    const role = req.body?.role ?? 'view';
    if (!['view', 'edit'].includes(role)) {
      return res.status(400).json({ message: 'Choose Viewer or Editor.' });
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

  const publicText = (write, owner = false) => async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
    const unavailable = () => res.status(404).json({ message: 'This editor link is unavailable.' });
    if (owner ? !validId(req.params.id) : !/^[A-Za-z0-9_-]{43}$/.test(req.params.token)) return unavailable();
    try {
      const filter = owner ? { _id: req.params.id, user: req.user.userId, deletedAt: null } : { shareLinkHash: hashToken(req.params.token), shareLinkRole: 'edit', deletedAt: null };
      const file = await PDF.findOne(filter).select('name user pdfFolder originalName mimeType pdfData originalBackup');
      if (!file || !editable(file) || await isLocked(file)) return unavailable();
      const text = file.pdfData.toString('utf8');
      if (file.pdfData.length > 1024 * 1024 || !Buffer.from(text).equals(file.pdfData)) {
        return res.status(422).json({ message: 'Live editing requires a UTF-8 text file up to 1 MB.' });
      }
      const revision = bytes => createHash('sha256').update(bytes).digest('hex');
      const version = revision(file.pdfData);
      if (!write) return res.json({ name: file.name, text, revision: version });
      const { text: draft, baseRevision, baseText } = req.body || {};
      if (typeof draft !== 'string' || Buffer.byteLength(draft) > 1024 * 1024 || typeof baseRevision !== 'string') {
        return res.status(400).json({ message: 'Live editing supports text up to 1 MB.' });
      }
      if (baseText !== undefined && (typeof baseText !== 'string' || Buffer.byteLength(baseText) > 1024 * 1024)) return res.status(400).json({ message: 'Invalid base text.' });
      const merged = baseRevision === version ? draft : typeof baseText === 'string' ? mergeText(baseText, draft, text) : null;
      if (merged !== null && Buffer.byteLength(merged) <= 1024 * 1024) {
        const bytes = Buffer.from(merged);
        const result = await PDF.updateOne({ ...filter, _id: file._id, pdfFolder: file.pdfFolder ?? null, pdfData: file.pdfData }, {
          $set: { pdfData: bytes, originalBackup: file.originalBackup || file.pdfData, updatedAt: new Date() }
        });
        if (result.matchedCount) return res.json({ text: merged, revision: revision(bytes) });
      }
      res.status(409).json({ message: 'Another editor saved changes. Your draft is still available.' });
    } catch {
      res.status(503).json({ message: 'Could not synchronize this document.' });
    }
  };
  app.get('/api/shared-document/:token/text', publicText(false));
  app.put('/api/shared-document/:token/text', publicText(true));
  app.get('/api/pdfs/:id/text', auth, publicText(false, true));
  app.put('/api/pdfs/:id/text', auth, publicText(true, true));

  // Link capabilities apply only to this document; never impersonate its owner.
  const editor = (handler, owner = false) => async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    if (owner ? !validId(req.params.id) : !/^[A-Za-z0-9_-]{43}$/.test(req.params.token)) return res.status(404).json({ message: 'This editor link is unavailable.' });
    try {
      const filter = owner ? { _id: req.params.id, user: req.user.userId, deletedAt: null } : { shareLinkHash: hashToken(req.params.token), shareLinkRole: 'edit', deletedAt: null };
      const file = await PDF.findOne(filter);
      if (!file || await isLocked(file)) return res.status(404).json({ message: 'This editor link is unavailable.' });
      const revision = createHash('sha256').update(file.pdfData).update(JSON.stringify(normalized(file.annotations))).digest('hex');
      const save = async changes => {
        if (req.get('X-Share-Revision') !== revision) {
          res.status(409).json({ message: 'This document changed. Download your draft before reopening the latest version.' });
          return false;
        }
        const result = await PDF.updateOne({ ...filter, _id: file._id, updatedAt: file.updatedAt, pdfFolder: file.pdfFolder ?? null, pdfData: file.pdfData, annotations: file.annotations }, { $set: { ...changes, updatedAt: new Date() } }, { runValidators: true });
        if (!result.matchedCount) { res.status(409).json({ message: 'This document changed or its link was revoked. Reopen the link.' }); return false; }
        const next = createHash('sha256').update(changes.pdfData || file.pdfData).update(JSON.stringify(changes.annotations || file.annotations || [])).digest('hex');
        res.set('X-Share-Revision', next);
        return true;
      };
      res.set('X-Share-Revision', revision);
      await handler(req, res, file, save, revision);
    } catch (error) { res.status(400).json({ message: error.message || 'Could not edit this shared file.' }); }
  };
  app.get('/api/shared-document/:token/editor', editor((req, res, file, save, revision) => {
    res.json({ _id: file._id, name: file.name, originalName: file.originalName, mimeType: file.mimeType, revision,
      editor: editable(file) && file.pdfData.length <= 1024 * 1024 && Buffer.from(file.pdfData.toString('utf8')).equals(file.pdfData) ? 'text' : file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.originalName) ? 'pdf' : 'file' });
  }));
  app.get('/api/shared-document/:token/document', editor((req, res, file) => {
    res.json({ _id: file._id, name: file.name, originalName: file.originalName, mimeType: file.mimeType, pdfData: file.pdfData.toString('base64'), annotations: file.annotations, tags: file.tags });
  }));
  app.get('/api/shared-document/:token/document/download', editor((req, res, file) => res.attachment(file.originalName).type('application/octet-stream').send(file.pdfData)));
  app.put('/api/shared-document/:token/document/annotations', editor(async (req, res, file, save) => {
    if (!Array.isArray(req.body.annotations) || Buffer.byteLength(JSON.stringify(req.body.annotations)) > 12 * 1024 * 1024) return res.status(400).json({ message: 'Choose annotations totaling no more than 12 MB.' });
    if (await save({ annotations: req.body.annotations })) res.json({ saved: true });
  }));
  app.put('/api/shared-document/:token/document/content', editor(async (req, res, file, save) => {
    const content = req.body?.content;
    if (typeof content !== 'string' || !content.length || content.length > 16 * 1024 * 1024 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(content)) return res.status(400).json({ message: 'Choose a non-empty file up to 12 MB.' });
    const bytes = Buffer.from(content, 'base64');
    if (await save({ pdfData: bytes, originalBackup: file.originalBackup || file.pdfData, annotations: [] })) res.json({ saved: true });
  }));
  const pages = (remove, owner = false) => editor(async (req, res, file, save) => {
    if (file.mimeType !== 'application/pdf' && !/\.pdf$/i.test(file.originalName)) return res.status(400).json({ message: 'Page editing requires a PDF.' });
    const { sources = [], ...options } = req.body;
    if (!Array.isArray(sources) || sources.some(source => typeof source !== 'string') || sources.reduce((size, source) => size + source.length, 0) > 14 * 1024 * 1024) return res.status(400).json({ message: 'Choose PDFs totaling no more than 10 MB.' });
    const result = remove ? await deletePDFPage(file.pdfData, Number(req.params.pageNumber), options.annotations ?? file.annotations) : await insertPDFPages(file.pdfData, { ...options, sources: sources.map(source => Buffer.from(source, 'base64')), annotations: options.annotations ?? file.annotations });
    if (await save({ pdfData: result.bytes, annotations: result.annotations })) res.json({ ...result, bytes: undefined, pdfData: result.bytes.toString('base64'), contentRevision: createHash('sha256').update(result.bytes).digest('hex') });
  }, owner);
  app.post('/api/shared-document/:token/document/pages', pages(false));
  app.delete('/api/shared-document/:token/document/pages/:pageNumber', pages(true));
  app.post('/api/pdfs/:id/live/pages', auth, pages(false, true));
  app.delete('/api/pdfs/:id/live/pages/:pageNumber', auth, pages(true, true));

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
