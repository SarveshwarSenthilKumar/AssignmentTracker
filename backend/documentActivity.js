const validId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
const same = (a, b) => String(a) === String(b);

module.exports = function createDocumentActivity(PDF, User) {
  const { Schema } = PDF.db.base;
  const id = Schema.Types.ObjectId;
  const activitySchema = new Schema({
    recipient: { type: id, required: true },
    document: { type: id, required: true },
    actor: { type: id, required: true },
    kind: { type: String, enum: ['share', 'access', 'comment'], required: true },
    detail: String,
    name: String,
    readAt: Date,
    createdAt: { type: Date, default: Date.now, expires: '90d' },
  });
  activitySchema.index({ recipient: 1, createdAt: -1 });
  const commentSchema = new Schema({
    document: { type: id, index: true, required: true },
    author: { type: id, required: true },
    text: { type: String, required: true, maxlength: 2000 },
  }, { timestamps: true });
  commentSchema.index({ document: 1, _id: -1 });
  const Activity = PDF.db.models.DocumentActivity || PDF.db.model('DocumentActivity', activitySchema);
  const Comment = PDF.db.models.DocumentComment || PDF.db.model('DocumentComment', commentSchema);

  const record = async (recipients, file, actor, kind, detail) => {
    try {
      const targets = [...new Set(recipients.filter(Boolean).map(String))].filter(recipient => !same(recipient, actor));
      if (!targets.length) return;
      const name = file.name || (await PDF.findById(file._id).select('name').lean())?.name || 'Shared document';
      await Activity.insertMany(targets.map(recipient => ({ recipient, document: file._id, actor, kind, detail, name })));
    } catch (error) { console.error('Could not record shared-file activity:', error.name); }
  };

  function register(app, auth, { isLocked, collaboratorAccess, friends, received, adminToken }) {
    const route = handler => [auth, async (req, res) => {
      res.set('Cache-Control', 'private, no-store');
      if (req.params.id !== undefined && !validId(req.params.id)) return res.status(404).json({ message: 'Document unavailable.' });
      try { await handler(req, res); }
      catch { res.status(503).json({ message: 'Shared-file activity is temporarily unavailable.' }); }
    }];
    const namesFor = async ids => new Map((await User.find({ _id: { $in: ids } }).select('username').lean())
      .map(user => [String(user._id), user.username]));
    const accessFor = async (documentId, user) => {
      const file = await PDF.findOne({ _id: documentId, deletedAt: null })
        .select('name originalName mimeType user pdfFolder +documentAdmins +friendShares +revokedCollaborators +shareLinkHash +shareLinkSecret +shareLinkExpiresAt').lean();
      if (!file || await isLocked(file) || collaboratorAccess.blocked(file, collaboratorAccess.forFile({ accountId: user }, file))) return null;
      const owner = same(file.user, user);
      const admin = (file.documentAdmins || []).some(account => same(account, user));
      const friendship = !owner && (file.friendShares || []).some(grant => same(grant.recipient, user))
        ? await friends.acceptedFor(user) : [];
      const friend = friendship.some(relation => (same(relation.sender, file.user) || same(relation.recipient, file.user)) &&
        file.friendShares.some(grant => same(grant.recipient, user) && same(grant.friendship, relation.generation)));
      const savedLink = !owner ? await received.linkFor(file, user) : null;
      const token = admin && !owner && !savedLink ? await adminToken(file) : null;
      const link = savedLink || (token ? '#/shared-document/' + token : null);
      if (!owner && !admin && !friend && !link) return null;
      return { file, owner, friend, link };
    };

    app.get('/api/document-activity', ...route(async (req, res) => {
      const entries = await Activity.find({ recipient: req.user.userId }).sort({ createdAt: -1, _id: -1 }).limit(100).lean();
      const names = await namesFor(entries.map(item => item.actor));
      const unread = await Activity.countDocuments({ recipient: req.user.userId, readAt: null });
      res.json({ unread, entries: entries.map(item => ({
        id: item._id, documentId: item.document, actor: names.get(String(item.actor)) || 'An account',
        kind: item.kind, detail: item.detail, name: item.name, read: Boolean(item.readAt), createdAt: item.createdAt,
      })) });
    }));
    app.post('/api/document-activity/read', ...route(async (req, res) => {
      const filter = { recipient: req.user.userId, readAt: null };
      if (req.body?.id !== undefined) {
        if (!validId(req.body.id)) return res.status(400).json({ message: 'Invalid activity item.' });
        filter._id = req.body.id;
      }
      await Activity.updateMany(filter, { $set: { readAt: new Date() } });
      res.status(204).end();
    }));

    app.get('/api/document-discussion/:id', ...route(async (req, res) => {
      const access = await accessFor(req.params.id, req.user.userId);
      if (!access) return res.status(404).json({ message: 'You no longer have access to this document.' });
      const { file, owner, friend, link } = access;
      const document = { _id: file._id, name: file.name, originalName: file.originalName, friendShare: friend,
        openPath: owner ? '#/documents/' + file._id : link };
      if (req.query.view === 'file') return res.json({ file: document });
      const comments = await Comment.find({ document: file._id }).sort({ _id: -1 }).limit(100).lean();
      const names = await namesFor(comments.map(item => item.author));
      res.json({
        file: document,
        comments: comments.map(item => ({ id: item._id, text: item.text, author: names.get(String(item.author)) || 'An account', createdAt: item.createdAt })),
      });
    }));

    app.post('/api/document-discussion/:id', ...route(async (req, res) => {
      const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
      if (!text || text.length > 2000) return res.status(400).json({ message: 'Enter a comment of 1–2,000 characters.' });
      const sender = req.user.userId;
      const access = await accessFor(req.params.id, sender);
      if (!access) return res.status(404).json({ message: 'You no longer have access to this document.' });
      const { file } = access;
      const [authors, visitors] = await Promise.all([
        Comment.distinct('author', { document: file._id }),
        received.linkRecipients(file),
      ]);
      await Comment.create({ document: file._id, author: sender, text });
      const candidates = [...new Set([...authors, ...visitors, ...(file.documentAdmins || []), ...(file.friendShares || []).map(grant => grant.recipient)].map(String))]
        .filter(user => !same(user, file.user) && !same(user, sender)).slice(0, 30);
      const viewers = await Promise.allSettled(candidates.map(async user => await accessFor(file._id, user) ? user : null));
      await record([file.user, ...viewers.flatMap(item => item.status === 'fulfilled' && item.value ? [item.value] : [])], file, sender, 'comment', 'Left a comment');
      res.status(201).json({ saved: true });
    }));
  }

  return { record, register };
};
