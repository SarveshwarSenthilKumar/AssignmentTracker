const { randomBytes } = require('node:crypto');

// Ephemeral pen movement is pushed to peers, never stored as document content.
module.exports = function registerLiveInk(app, auth, { PDF, isLocked, hashToken, validId }) {
  const sessions = new Map(), rooms = new Map();
  const emit = (session, event) => {
    if (session.res.destroyed || session.res.writableLength > 1024 * 1024) { session.res.destroy(); return; }
    session.res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const broadcast = (session, event) => {
    for (const peer of rooms.get(session.room) || []) if (peer !== session) emit(peer, event);
  };
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
      const room = String(file._id), peers = rooms.get(room) || new Set();
      if (peers.size >= 32) return res.status(429).json({ message: 'This live room is full.' });
      res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no', 'Referrer-Policy': 'no-referrer' });
      res.flushHeaders();
      const key = randomBytes(32).toString('base64url');
      const session = { key, room, shared, res, previews: new Map(), sequence: 0, checkedAt: Date.now(), checking: null, allowed, lastPacket: 0 };
      sessions.set(key, session); peers.add(session); rooms.set(room, peers);
      const previews = [];
      for (const peer of peers) for (const preview of peer.previews.values()) if (Date.now() - preview.updated < 10000) previews.push(preview);
      // A session key is a short-lived write capability. Never expose it to peers.
      emit(session, { type: 'ready', session: key, previews });
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
        if (!peers.size) rooms.delete(room);
      });
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
      if (cancel) { session.sequence = sequence; session.previews.delete(id); broadcast(session, { type: 'clear', id }); return res.status(204).end(); }
      if (Date.now() - session.lastPacket < 15) return res.status(429).end();
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
  return { revokeShared(documentId) {
    for (const session of rooms.get(String(documentId)) || []) if (session.shared) { emit(session, { type: 'unavailable' }); session.res.end(); }
  } };
};
