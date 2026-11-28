const { randomBytes, createHash } = require('node:crypto');
const {appendHistory}=require('./documentEditHistory');
const {unexpired,expired}=require('./shareLinkExpiry');

// Pen previews are ephemeral; annotation changes from other tools are merged
// into the same document before they are pushed to peers.
module.exports = function registerLiveInk(app, auth, { PDF, isLocked, hashToken, validId, collaboratorAccess, activity }) {
  const sessions = new Map(), rooms = new Map();
  const emit = (session, event) => {
    if (session.res.writableEnded) return;
    if (session.res.destroyed || session.res.writableLength > 1024 * 1024) { session.res.destroy(); return; }
    session.res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  const broadcast = (session, event) => {
    for (const peer of rooms.get(session.room) || []) if (peer !== session) emit(peer, event);
  };
  const roster = room => {
    const people = new Map();
    for (const session of rooms.get(room) || []) {
      if (session.res.destroyed || session.res.writableEnded) continue;
      let person = people.get(session.person);
      if (!person) {
        person = { peer: session.person, name: session.name, color: session.color, signedIn:!!session.actor.accountId, role: session.owner ? 'Owner' : session.admin ? 'Admin' : 'Editor', sessions: [] };
        people.set(session.person, person);
      }
      person.sessions.push(session.peer);
      if (session.owner) person.role = 'Owner';
      else if(session.admin&&person.role!=='Owner')person.role='Admin';
    }
    return [...people.values()];
  };
  const sendRoster = room => { const members = roster(room); for (const peer of rooms.get(room) || []) emit(peer, { type: 'roster', members }); };
  const scheduleExpiry=(session,expiresAt)=>{
    clearTimeout(session.expiryTimer);session.expiresAt=expiresAt;
    if(!session.shared||!expiresAt||session.res.destroyed||session.res.writableEnded)return;
    session.expiryTimer=setTimeout(async()=>{
      try{
        const file=await PDF.findOne(session.filter).select('+shareLinkExpiresAt').lean();
        if(!file||expired(file)){emit(session,{type:'expired',message:'This document sharing link has expired. Ask the owner or a document admin to extend it.'});session.res.end();}
        else scheduleExpiry(session,file.shareLinkExpiresAt);
      }catch{session.res.end();}
    },Math.max(0,Math.min(2147483647,new Date(expiresAt).getTime()-Date.now())));
  };
  const connect = shared => async (req, res) => {
    if (shared ? !/^[A-Za-z0-9_-]{43}$/.test(req.params.token) : !validId(req.params.id)) return res.status(404).end();
    const filter = shared ? { shareLinkHash: hashToken(req.params.token), shareLinkRole: 'edit', deletedAt: null } : { _id: req.params.id, user: req.user.userId, deletedAt: null };
    let actor = req.documentCollaborator;
    try {
      const allowed = async () => {
        const file = await PDF.findOne({...filter,...(shared?unexpired():{})}).select('_id user pdfFolder +revokedCollaborators +documentAdmins +shareLinkExpiresAt').lean();
        if(!file)return null;
        if(!actor)actor=await collaboratorAccess.identify(req,res,file);
        return !collaboratorAccess.blocked(file,actor) && !await isLocked(file) ? file : null;
      };
      const file = await allowed();
      if (!file) return res.status(404).end();
      if (req.aborted || res.destroyed || res.writableEnded) return;
      const room = String(file._id), peers = rooms.get(room) || new Set();
      const person = actor.person;
      if (peers.size >= 32) return res.status(429).json({ message: 'This live room is full.' });
      res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'private, no-store, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no', 'Referrer-Policy': 'no-referrer' });
      res.flushHeaders();
      const key = randomBytes(32).toString('base64url');
      const session = { key, person, actor, owner:actor.owner, peer: randomBytes(9).toString('hex'), color: ['#38bdf8','#a78bfa','#fb923c','#34d399','#f472b6'][parseInt(person.slice(0,4),16) % 5], room, shared, filter:shared?{...filter,...collaboratorAccess.filter(actor)}:filter, res, previews: new Map(), sequence: 0, checkedAt: Date.now(), checking: null, allowed, lastPacket: 0 };
      session.admin=!!actor.accountId&&(file.documentAdmins||[]).some(id=>String(id)===actor.accountId);
      session.name = actor.name || `Guest ${person.slice(0,4).toUpperCase()}`;
      sessions.set(key, session); peers.add(session); rooms.set(room, peers);
      const previews = [];
      for (const peer of peers) for (const preview of peer.previews.values()) if (Date.now() - preview.updated < 10000) previews.push(preview);
      // A session key is a short-lived write capability. Never expose it to peers.
      emit(session, { type: 'ready', session: key, self: session.person, members: roster(room), previews, presences: [...peers].filter(peer => peer !== session && peer.presence).map(peer => ({ peer: peer.peer, color: peer.color, data: peer.presence })) });
      const heartbeat = setInterval(async () => {
        try {
          const current=await allowed();
          if (!current) { emit(session,session.expiresAt&&Date.now()>=new Date(session.expiresAt).getTime()?{type:'expired',message:'This document sharing link has expired.'}:{ type: 'unavailable' }); res.end(); return; }
          const admin=!!actor.accountId&&(current.documentAdmins||[]).some(id=>String(id)===actor.accountId);
          if(admin!==session.admin){session.admin=admin;sendRoster(room);}
          if(String(current.shareLinkExpiresAt||'')!==String(session.expiresAt||''))scheduleExpiry(session,current.shareLinkExpiresAt);
          session.checkedAt = Date.now();
          for (const [id, preview] of session.previews) if (Date.now() - preview.updated > 10000) { session.previews.delete(id); broadcast(session, { type: 'clear', id }); }
          res.write(': heartbeat\n\n');
        } catch { res.end(); }
      }, 10000);
      res.on('close', () => {
        clearInterval(heartbeat);clearTimeout(session.expiryTimer); sessions.delete(key); peers.delete(session);
        for (const id of session.previews.keys()) broadcast(session, { type: 'clear', id });
        broadcast(session, { type: 'presence', peer: session.peer, color: session.color, data: null });
        if (!peers.size) rooms.delete(room);
        else sendRoster(room);
      });
      sendRoster(room);
      scheduleExpiry(session,file.shareLinkExpiresAt);
    } catch { if (!res.headersSent) res.status(503).end(); else res.end(); }
  };
  app.get('/api/pdfs/:id/live/stream', auth, connect(false));
  app.get('/api/shared-document/:token/live/stream', connect(true));
  app.delete('/api/pdfs/:id/collaborators/:person',auth,async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(!validId(req.params.id)||!/^[a-f\d]{24}$/.test(req.params.person))return res.status(400).json({message:'Choose a valid collaborator.'});
    try {
      const file=await PDF.findOne({_id:req.params.id,$or:[{user:req.user.userId},{documentAdmins:req.user.userId}],deletedAt:null}).select('_id user +documentAdmins +revokedCollaborators').lean();
      if(!file)return res.status(403).json({message:'Only the document owner or an admin can revoke access.'});
      const owner=await collaboratorAccess.identify(req,res,file);
      if(collaboratorAccess.blocked(file,owner))return res.status(403).json({message:'Your document access was revoked.'});
      const peers=rooms.get(String(file._id))||new Set();
      const targets=[...peers].filter(session=>session.person===req.params.person);
      if(req.params.person===owner.person||targets.some(session=>session.owner))return res.status(400).json({message:'The owner’s access cannot be revoked.'});
      const ownerPerson=createHash('sha256').update(`${file._id}:account:${file.user}`).digest('hex').slice(0,24);
      if(req.params.person===ownerPerson)return res.status(400).json({message:'The owner’s access cannot be revoked.'});
      const adminPeople=(file.documentAdmins||[]).map(id=>createHash('sha256').update(`${file._id}:account:${id}`).digest('hex').slice(0,24));
      if(!owner.owner&&adminPeople.includes(req.params.person))return res.status(403).json({message:'Only the owner can remove another document admin.'});
      const blocked=[...new Set([req.params.person,...targets.map(session=>session.actor.browserPerson)])];
      const removedAdmins=(file.documentAdmins||[]).filter((id,index)=>adminPeople[index]===req.params.person);
      const protectedRoles=owner.owner?{}:{documentAdmins:{$nin:targets.map(session=>session.actor.accountId).filter(Boolean)}};
      const result=await PDF.updateOne({_id:file._id,$or:[{user:req.user.userId},{documentAdmins:req.user.userId}],...protectedRoles},{$addToSet:{revokedCollaborators:{$each:blocked}},$pull:{documentAdmins:{$in:removedAdmins}},$set:{updatedAt:new Date()}});
      if(!result.matchedCount)return res.status(403).json({message:'Your document admin role changed. Reopen the collaborator list.'});
      for(const session of peers)if(!session.owner&&(blocked.includes(session.person)||blocked.includes(session.actor.browserPerson))){emit(session,{type:'revoked',message:'The owner revoked your access to this document.'});session.res.end();}
      if (activity && result.modifiedCount && !(file.revokedCollaborators || []).includes(req.params.person)) {
        await activity.record([...removedAdmins, ...targets.map(session => session.actor.accountId)], file, req.user.userId, 'access', 'Revoked your document access');
      }
      sendRoster(String(file._id));
      res.status(204).end();
    } catch {res.status(503).json({message:'Could not revoke access. Please try again.'});}
  });
  app.post('/api/document-live-ink/:session', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const session = sessions.get(req.params.session);
    if (!session || session.res.destroyed || session.res.writableEnded) return res.status(404).end();
    if(session.shared&&session.expiresAt&&Date.now()>=new Date(session.expiresAt).getTime()){emit(session,{type:'expired',message:'This document sharing link has expired.'});session.res.end();return res.status(410).json({code:'DOCUMENT_LINK_EXPIRED',message:'This document sharing link has expired.'});}
    try {
      if (Date.now() - session.checkedAt > 10000) {
        session.checking ||= session.allowed().finally(() => { session.checking = null; });
        if (!await session.checking) { session.res.end(); return res.status(404).end(); }
        session.checkedAt = Date.now();
      }
      if(session.res.destroyed||session.res.writableEnded)return res.status(404).end();
      const { id, sequence, cancel, points = [], offset, replace, page, tool, color, strokeWidth, pressure, contentRevision, ended } = req.body || {};
      if (typeof id !== 'string' || id.length > 150 || !Number.isSafeInteger(sequence) || sequence <= session.sequence) return res.status(400).end();
      if (Date.now() - session.lastPacket < 15) return res.status(429).end();
      if (req.body.presence !== undefined) {
        const presence = req.body.presence;
        if (Buffer.byteLength(JSON.stringify(presence)) > 32 * 1024) return res.status(400).end();
        const actions = ['viewing','selecting','typing','editing-text','drawing','highlighting','moving','resizing','erasing','measuring','selecting-region','placing','working','idle'];
        if (presence && ((presence.action !== undefined && !actions.includes(presence.action)) || (presence.targetId != null && (typeof presence.targetId !== 'string' || presence.targetId.length > 200)) || (presence.targetKind != null && !['text','sticky-note','image','annotation','region'].includes(presence.targetKind)))) return res.status(400).end();
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
          const file = await PDF.findOne({...session.filter,...(session.shared?unexpired():{})}).select('+editHistory');
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
          const result = await PDF.updateOne({ ...session.filter,...(session.shared?unexpired():{}), _id: file._id, updatedAt: file.updatedAt, annotations: file.annotations, pdfData: file.pdfData }, { $set: { annotations: next,editHistory:appendHistory(file,session.actor,{annotations:next}), updatedAt: new Date() } }, { runValidators: true });
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
  return { async refreshExpiry(documentId) {
    const file=await PDF.findById(documentId).select('+shareLinkExpiresAt').lean();
    for(const session of rooms.get(String(documentId))||[])if(session.shared)scheduleExpiry(session,file?.shareLinkExpiresAt);
  }, async refreshRoles(documentId) {
    const file=await PDF.findById(documentId).select('+documentAdmins').lean();
    for(const session of rooms.get(String(documentId))||[])session.admin=!!session.actor.accountId&&(file?.documentAdmins||[]).some(id=>String(id)===session.actor.accountId);
    sendRoster(String(documentId));
  }, saved(documentId) {
    for (const session of rooms.get(String(documentId)) || []) emit(session, { type: 'refresh' });
  }, revokeShared(documentId,role) {
    for (const session of rooms.get(String(documentId)) || []) if (session.shared) { emit(session, role?{type:'permissions-changed',role}:{ type: 'unavailable' }); session.res.end(); }
  } };
};
