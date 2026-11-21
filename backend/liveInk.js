const { randomBytes, createHash } = require('node:crypto');
const jwt = require('jsonwebtoken');

// Pen previews are ephemeral; annotation changes from other tools are merged
// into the same document before they are pushed to peers.
module.exports = function registerLiveInk(app, auth, { PDF, User, isLocked, hashToken, validId }) {
  const sessions = new Map(), rooms = new Map();
  const emit = (session, event) => {
    if (session.res.writableEnded) return;
    if (session.res.destroyed || session.res.writableLength > 1024 * 1024) { session.res.destroy(); return; }
    session.res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const broadcast = (session, event) => {
    for (const peer of rooms.get(session.room) || []) if (peer !== session) emit(peer, event);
  };
  const member = session => ({ peer: session.peer, name: session.name, color: session.color, role: session.shared ? 'Editor' : 'Owner' });
  const roster = room => [...(rooms.get(room) || [])].filter(session => !session.res.destroyed && !session.res.writableEnded).map(member);
  const sendRoster = room => { const members = roster(room); for (const peer of rooms.get(room) || []) emit(peer, { type: 'roster', members }); };
  const connect = shared => async (req, res) => {
    if (shared ? !/^[A-Za-z0-9_-]{43}$/.test(req.params.token) : !validId(req.params.id)) return res.status(404).end();
    const filter = shared ? { shareLinkHash: hashToken(req.params.token), shareLinkRole: 'edit', deletedAt: null } : { _id: req.params.id, user: req.user.userId, deletedAt: null };
    try {
      const allowed = async () => {
        const file = await PDF.findOne(filter).select('_id user pdfFolder').lean();
        return file && !await isLocked(file) ? file : null;
      };
      const file = await allowed();
      if (!file) return res.status(404).end();
      let identity = req.user;
      if (shared) {
        identity = null;
        const bearer = /^Bearer (.+)$/.exec(req.get('Authorization') || '')?.[1];
        if (bearer) { try { identity = jwt.verify(bearer, process.env.JWT_SECRET); } catch { /* Public links remain available to guests. */ } }
      }
      const account = identity?.userId && validId(String(identity.userId)) ? await User.findById(identity.userId).select('username deactivatedAt approvalPending').lean() : null;
      const username = account && !account.deactivatedAt && !account.approvalPending ? account.username : null;
      const room = String(file._id), peers = rooms.get(room) || new Set();
      if (peers.size >= 32) return res.status(429).json({ message: 'This live room is full.' });
      res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no', 'Referrer-Policy': 'no-referrer' });
      res.flushHeaders();
      const key = randomBytes(32).toString('base64url');
      const session = { key, peer: randomBytes(9).toString('hex'), color: ['#38bdf8','#a78bfa','#fb923c','#34d399','#f472b6'][peers.size % 5], room, shared, filter, res, previews: new Map(), sequence: 0, checkedAt: Date.now(), checking: null, allowed, lastPacket: 0 };
      session.name = username || `Guest ${session.peer.slice(0,4).toUpperCase()}`;
      sessions.set(key, session); peers.add(session); rooms.set(room, peers);
      const previews = [];
      for (const peer of peers) for (const preview of peer.previews.values()) if (Date.now() - preview.updated < 10000) previews.push(preview);
      // A session key is a short-lived write capability. Never expose it to peers.
      emit(session, { type: 'ready', session: key, self: session.peer, members: roster(room), previews, presences: [...peers].filter(peer => peer !== session && peer.presence).map(peer => ({ peer: peer.peer, color: peer.color, data: peer.presence })) });
      const heartbeat = setInterval(async () => {
        try {
          if (!await allowed()) { emit(session, { type: 'unavailable' }); res.end(); return; }
          session.checkedAt = Date.now();
          for (const [id, preview] of session.previews) if (Date.now() - preview.updated > 10000) { session.previews.delete(id); broadcast(session, { type: 'clear', id }); }
          res.write(': heartbeat\n\n');
        } catch { res.end(); }
      }, 10000);
      res.on('close', () => {
        clearInterval(heartbeat); sessions.delete(key); peers.delete(session);
        for (const id of session.previews.keys()) broadcast(session, { type: 'clear', id });
        broadcast(session, { type: 'presence', peer: session.peer, color: session.color, data: null });
        if (!peers.size) rooms.delete(room);
        else sendRoster(room);
      });
      sendRoster(room);
    } catch { if (!res.headersSent) res.status(503).end(); else res.end(); }
  };
  app.get('/api/pdfs/:id/live/stream', auth, connect(false));
  app.get('/api/shared-document/:token/live/stream', connect(true));
  app.post('/api/document-live-ink/:session', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const session = sessions.get(req.params.session);
    if (!session || session.res.destroyed || session.res.writableEnded) return res.status(404).end();
    try {
      if (Date.now() - session.checkedAt > 10000) {
        session.checking ||= session.allowed().finally(() => { session.checking = null; });
        if (!await session.checking) { session.res.end(); return res.status(404).end(); }
        session.checkedAt = Date.now();
      }
      const { id, sequence, cancel, points = [], offset, replace, page, tool, color, strokeWidth, pressure, contentRevision, ended } = req.body || {};
      if (typeof id !== 'string' || id.length > 150 || !Number.isSafeInteger(sequence) || sequence <= session.sequence) return res.status(400).end();
      if (Date.now() - session.lastPacket < 15) return res.status(429).end();
      if (req.body.presence !== undefined) {
        const presence = req.body.presence;
        if (Buffer.byteLength(JSON.stringify(presence)) > 32 * 1024) return res.status(400).end();
        const number = value => Number.isFinite(value) && Math.abs(value) <= 10;
        const rect = item => item && Number.isInteger(item.page) && item.page > 0 && item.page <= 10000 && [item.x,item.y,item.width,item.height].every(number) && [0,90,180,270].includes(item.rotation);
        if (presence !== null && (!presence || typeof presence.tool !== 'string' || presence.tool.length > 50 || typeof presence.contentRevision !== 'string' || !/^[a-f\d]{64}$/.test(presence.contentRevision) || !Array.isArray(presence.rects) || presence.rects.length > 80 || !presence.rects.every(item => rect(item) && ['selection','caret','object','region'].includes(item.kind)) || (presence.cursor && (!rect(presence.cursor) || typeof presence.cursor.down !== 'boolean')))) return res.status(400).end();
        session.presence = presence;
        broadcast(session, { type: 'presence', peer: session.peer, color: session.color, data: presence });
      }
      if (req.body.kind === 'presence') { session.sequence = sequence; session.lastPacket = Date.now(); return res.status(204).end(); }
      if (cancel) { session.sequence = sequence; session.previews.delete(id); broadcast(session, { type: 'clear', id }); return res.status(204).end(); }
      if (req.body.kind === 'edit') {
        const changes = req.body.changes;
        const validKey = key => !['id', '__proto__', 'constructor', 'prototype'].includes(key);
        if (!Array.isArray(changes) || changes.length > 64 || Buffer.byteLength(JSON.stringify(changes)) > 512 * 1024 || changes.some(change => !change || typeof change.id !== 'string' || change.id.length > 200 || !change.set || typeof change.set !== 'object' || Array.isArray(change.set) || !Array.isArray(change.unset) || !Object.keys(change.set).every(validKey) || !change.unset.every(key => typeof key === 'string' && validKey(key)))) return res.status(400).end();
        for (let attempt = 0; attempt < 6; attempt++) {
          const file = await PDF.findOne(session.filter);
          if (!file || await isLocked(file)) { session.res.end(); return res.status(404).end(); }
          const hash = createHash('sha256').update(file.pdfData).digest('hex');
          if (contentRevision !== hash) return res.status(409).end();
          const annotations = new Map((file.annotations || []).map((item, index) => item.id ? item : { ...item, id: `legacy-${index}-${createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0, 16)}` }).map(item => [item.id, item]));
          for (const change of changes) {
            if (change.removed) annotations.delete(change.id);
            else {
              if (!annotations.has(change.id) && !change.set.tool) return res.status(409).end();
              const item = { ...(annotations.get(change.id) || {}), ...change.set, id: change.id };
              for (const key of change.unset) delete item[key];
              annotations.set(change.id, item);
            }
          }
          const next = [...annotations.values()];
          if (Buffer.byteLength(JSON.stringify(next)) > 12 * 1024 * 1024) return res.status(413).end();
          const result = await PDF.updateOne({ ...session.filter, _id: file._id, updatedAt: file.updatedAt, annotations: file.annotations, pdfData: file.pdfData }, { $set: { annotations: next, updatedAt: new Date() } }, { runValidators: true });
          if (!result.matchedCount) continue;
          session.sequence = sequence; session.lastPacket = Date.now();
          broadcast(session, { type: 'edit', changes, contentRevision: hash });
          return res.status(204).end();
        }
        return res.status(409).end();
      }
      if (!Array.isArray(points) || points.length > 512 || !Number.isInteger(offset) || offset < 0 || offset + points.length > 20000 || !Number.isInteger(page) || page < 1 || page > 10000 || !['pen', 'highlighter'].includes(tool) || typeof color !== 'string' || !/^#[\da-f]{3,8}$/i.test(color) || !Number.isFinite(strokeWidth) || strokeWidth <= 0 || strokeWidth > 1000 || typeof contentRevision !== 'string' || !/^[a-f\d]{64}$/.test(contentRevision) || points.some(point => !point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.x) > 100000 || Math.abs(point.y) > 100000 || (point.pressure != null && (!Number.isFinite(point.pressure) || point.pressure < 0 || point.pressure > 1)))) return res.status(400).end();
      const previous = session.previews.get(id);
      // A successful response can be lost after broadcasting. A retried chunk is
      // acknowledged without adding its points twice.
      if (!replace && previous && offset < previous.points.length && offset + points.length <= previous.points.length && JSON.stringify(previous.points.slice(offset, offset + points.length)) === JSON.stringify(points)) { session.sequence = sequence; return res.status(204).end(); }
      if (replace ? offset !== 0 : offset !== (previous?.points.length || 0)) return res.status(409).end();
      const preview = { id, page, tool, color, strokeWidth, pressure: pressure !== false, contentRevision, points: [...(replace ? [] : previous?.points || []), ...points], ended: !!ended, updated: Date.now() };
      if (!previous && session.previews.size >= 16) { const first = session.previews.keys().next().value; session.previews.delete(first); broadcast(session, { type: 'clear', id: first }); }
      session.sequence = sequence; session.lastPacket = Date.now(); session.previews.set(id, preview);
      broadcast(session, { type: 'ink', ...preview, offset, points });
      res.status(204).end();
    } catch { res.status(503).end(); }
  });
  return { saved(documentId) {
    for (const session of rooms.get(String(documentId)) || []) emit(session, { type: 'refresh' });
  }, revokeShared(documentId) {
    for (const session of rooms.get(String(documentId)) || []) if (session.shared) { emit(session, { type: 'unavailable' }); session.res.end(); }
  } };
};
