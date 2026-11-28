const { createHash, randomBytes } = require('node:crypto');
const { insertPDFPages, deletePDFPage } = require('./pdfPages');
const { mergeText } = require('./liveText');
const {appendHistory,historyPage}=require('./documentEditHistory');
const {seal,unseal}=require('./shareLinkSecret');
const {unexpired,expired}=require('./shareLinkExpiry');

const hashToken = token => createHash('sha256').update(token).digest('hex');
const validId = id => /^[a-f\d]{24}$/i.test(id);
const editable = file => /\.(md|markdown|txt)$/i.test(file.originalName || '') &&
  /^(text\/plain|text\/markdown|application\/octet-stream)(;|$)/i.test(file.mimeType || '');

module.exports = function registerDocumentShareLinks(app, auth, { User, PDF, PDFFolder }) {
  const collaboratorAccess = require('./documentCollaboratorAccess')({User});
  const friends=require('./friendSharing')(app,auth,{User,PDF,collaboratorAccess,isLocked});
  const received=require('./sharedWithMe')(app,auth,{PDF,User,PDFFolder,collaboratorAccess,isLocked,friends});
  app.use('/api/shared-document/:token',async(req,res,next)=>{
    res.set('Cache-Control','private, no-store');
    if(!/^[A-Za-z0-9_-]{43}$/.test(req.params.token))return res.status(404).json({message:'This document link is unavailable.'});
    try {
      const file=await PDF.findOne({shareLinkHash:hashToken(req.params.token),deletedAt:null}).select('_id user +revokedCollaborators +shareLinkSecret +shareLinkExpiresAt').lean();
      if(!file)return res.status(404).json({message:'This document link is unavailable.'});
      if(expired(file))return res.status(410).json({code:'DOCUMENT_LINK_EXPIRED',message:'This document sharing link has expired. Ask the owner or a document admin to extend it.'});
      const identity=await collaboratorAccess.identify(req,res,file);
      if(collaboratorAccess.blocked(file,identity))return res.status(403).json({code:'DOCUMENT_ACCESS_REVOKED',message:'The owner revoked your access to this document.'});
      if(!file.shareLinkSecret)await PDF.updateOne({_id:file._id,shareLinkHash:hashToken(req.params.token),shareLinkSecret:{$exists:false}},{$set:{shareLinkSecret:seal(req.params.token)}});
      if(req.method==='GET'&&req.path==='/editor')await received.remember(identity,file,req.params.token).catch(()=>{});
      next();
    } catch {res.status(503).json({message:'Could not verify document access.'});}
  });
  const sharedAccess=req=>({...collaboratorAccess.filter(req.documentCollaborator),...unexpired()});
  const liveInk = require('./liveInk')(app, auth, { PDF, User, isLocked, hashToken, validId, collaboratorAccess });
  const contentRevision = file => createHash('sha256').update(file.pdfData).digest('hex');
  const editorRevision=(file,annotations,bytes=file.pdfData)=>createHash('sha256').update(bytes)
    .update(JSON.stringify(annotations)).update(file.whiteboardAppearance?JSON.stringify(file.whiteboardAppearance):'').digest('hex');
  const normalized = annotations => (annotations || []).map((item, index) => item.id ? item : { ...item, id: `legacy-${index}-${createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0, 16)}` });
  const live = shared => async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
    if (shared ? !/^[A-Za-z0-9_-]{43}$/.test(req.params.token) : !validId(req.params.id)) return res.status(404).json({ message: 'Document unavailable.' });
    const filter = shared ? { shareLinkHash: hashToken(req.params.token), shareLinkRole: 'edit', deletedAt: null, ...sharedAccess(req) } : { _id: req.params.id, user: req.user.userId, deletedAt: null };
    try {
      for (let attempt = 0; attempt < 6; attempt++) {
        const file = await PDF.findOne(filter).select('+editHistory');
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
          const actor=await collaboratorAccess.identify(req,res,file);
          const result = await PDF.updateOne({ ...filter,...(shared?sharedAccess(req):{}), _id: file._id, updatedAt: file.updatedAt, pdfData: file.pdfData, annotations: file.annotations }, { $set: { annotations, editHistory:appendHistory(file,actor,{annotations}), updatedAt: new Date() } }, { runValidators: true });
          if (!result.matchedCount) continue;
          liveInk.saved(file._id);
        }
        const revision = editorRevision(file,annotations);
        res.set('X-Share-Revision', revision);
        if (req.method === 'GET' && req.query.revision === revision && req.query.contentRevision === content) return res.status(204).end();
        return res.json({ _id: file._id, name: file.name, documentKind:file.documentKind, copiedFromName:file.copiedFromName, originalName: file.originalName, mimeType: file.mimeType, tags: file.tags, whiteboardAppearance:file.whiteboardAppearance, annotations, contentRevision: content, revision,
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
      const filter = { _id: req.params.id, $or:[{user:req.user.userId},{documentAdmins:req.user.userId}] };
      const file = await PDF.findOne(filter).select('user pdfFolder deletedAt originalName mimeType +shareLinkHash +shareLinkSecret +shareLinkRole +shareLinkExpiresAt +shareLinkMessage +documentAdmins +revokedCollaborators').lean();
      if (!file) return res.status(404).json({ message: 'Document not found.' });
      const identity=await collaboratorAccess.identify(req,res,file);
      if(collaboratorAccess.blocked(file,identity))return res.status(403).json({message:'Your document access has been revoked.'});
      await handler(res, filter, file, req);
    } catch {
      res.status(500).json({ message: 'Could not manage this share link.' });
    }
  }];

  const adminsPath='/api/pdfs/:id/document-admins';
  app.get('/api/pdfs/:id/history',...ownerRoute(async(res,filter,file,req)=>{
    if(await isLocked(file))return res.status(403).json({message:'Unlock the document to view its edit history.'});
    const document=await PDF.findOne({...filter,deletedAt:null}).select('_id +editHistory').lean();
    if(!document)return res.status(404).json({message:'Document unavailable.'});
    res.json(historyPage(document,req.query));
  }));
  app.get('/api/shared-document/:token/history',async(req,res)=>{
    try{
      const file=await PDF.findOne({shareLinkHash:hashToken(req.params.token),shareLinkRole:'edit',deletedAt:null,...sharedAccess(req)}).select('user pdfFolder +editHistory').lean();
      if(!file||await isLocked(file))return res.status(404).json({message:'This document history is unavailable.'});
      res.json(historyPage(file,req.query));
    }catch{res.status(503).json({message:'Could not load edit history.'});}
  });
  app.get(adminsPath,...ownerRoute(async(res,filter,file,req)=>{
    if(String(file.user)!==String(req.user.userId))return res.status(403).json({message:'Only the owner can manage document admins.'});
    res.json(await User.find({_id:{$in:file.documentAdmins||[]}}).select('username').lean());
  }));
  app.put(adminsPath,...ownerRoute(async(res,filter,file,req)=>{
    if(String(file.user)!==String(req.user.userId))return res.status(403).json({message:'Only the owner can manage document admins.'});
    const {username,enabled}=req.body||{};
    if(typeof username!=='string'||!username.trim()||typeof enabled!=='boolean')return res.status(400).json({message:'Enter a username and choose an admin role.'});
    const account=await User.findOne({username:username.trim()}).collation({locale:'en',strength:2}).select('username deactivatedAt approvalPending').lean();
    if(!account||account.deactivatedAt||account.approvalPending)return res.status(404).json({message:'Choose an approved, active account.'});
    if(String(account._id)===String(file.user))return res.status(400).json({message:'The owner already has full document access.'});
    const person=createHash('sha256').update(`${file._id}:account:${account._id}`).digest('hex').slice(0,24);
    if(enabled&&(file.revokedCollaborators||[]).includes(person))return res.status(400).json({message:'This account’s document access was revoked.'});
    const update=enabled?{$addToSet:{documentAdmins:account._id}}:{$pull:{documentAdmins:account._id}};
    await PDF.updateOne({_id:file._id,user:req.user.userId},update);
    await liveInk.refreshRoles(file._id);
    res.json({username:account.username,role:enabled?'Admin':'Editor'});
  }));

  const path = '/api/pdfs/:id/share-link';
  const existingToken=async(file,provided)=>{
    if(!file.shareLinkHash)return null;
    if(file.shareLinkSecret){try{const token=unseal(file.shareLinkSecret);if(hashToken(token)===file.shareLinkHash)return token;}catch{}}
    if(typeof provided==='string'&&/^[A-Za-z0-9_-]{43}$/.test(provided)&&hashToken(provided)===file.shareLinkHash)return provided;
    return received.recoverToken(file);
  };
  app.get(path, ...ownerRoute(async(res, _filter, file) => {
    const token=await existingToken(file);
    res.json({ active: !!file.shareLinkHash, role: file.shareLinkRole || 'view',expiresAt:file.shareLinkExpiresAt||null,shareMessage:file.shareLinkMessage||'',expired:expired(file),canEdit: true,path:token?`#/shared-document/${token}`:null,requiresExistingLink:!!file.shareLinkHash&&!token });
  }));
  app.post(path, ...ownerRoute(async (res, filter, file, req) => {
    const role = req.body?.role ?? 'view';
    const message = req.body?.shareMessage;
    if (message !== undefined && (typeof message !== 'string' || message.trim().length > 300)) {
      return res.status(400).json({ message: 'Use up to 300 characters for the document share message.' });
    }
    const messageUpdate = message === undefined ? {} : { shareLinkMessage: message.trim() };
    let expiresAt=file.shareLinkExpiresAt||null;
    if(Object.hasOwn(req.body||{},'expiresAt')){
      const value=req.body.expiresAt;
      if(value===null)expiresAt=null;
      else if(typeof value==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(value)&&Number.isFinite(Date.parse(value))&&Date.parse(value)>Date.now())expiresAt=new Date(value);
      else return res.status(400).json({message:'Choose an expiration date and time in the future, or turn expiration off.'});
    }
    if (!['view', 'edit'].includes(role)) {
      return res.status(400).json({ message: 'Choose Viewer or Editor.' });
    }
    if (file.deletedAt || await isLocked(file)) {
      return res.status(403).json({ message: 'Remove the applicable lock or restore the document before creating a share link.' });
    }
    for(let attempt=0;attempt<4;attempt++){
      const current=attempt===0?file:await PDF.findOne({...filter,deletedAt:null}).select('user pdfFolder deletedAt +shareLinkHash +shareLinkSecret +shareLinkRole +shareLinkExpiresAt').lean();
      if(!current)return res.status(403).json({message:'Your document sharing permissions changed.'});
      if(file.shareLinkHash&&current.shareLinkHash!==file.shareLinkHash)return res.status(409).json({message:'This link was revoked or changed while saving. Reopen sharing before creating another link.'});
      const token=current.shareLinkHash?await existingToken(current,req.body?.existingToken):randomBytes(32).toString('base64url');
      if(!token)return res.status(409).json({requiresExistingLink:true,message:'The existing address has not changed. Paste that link once to recover it without replacing it.'});
      const unchanged=current.shareLinkHash?{shareLinkHash:current.shareLinkHash}:{$and:[{$or:[{shareLinkHash:{$exists:false}},{shareLinkHash:null}]}]};
      const expirationUpdate=Object.hasOwn(req.body||{},'expiresAt')||!current.shareLinkHash?{shareLinkExpiresAt:expiresAt}:{};
      const result=await PDF.findOneAndUpdate({...filter,...unchanged,deletedAt:null},{$set:{shareLinkHash:hashToken(token),shareLinkSecret:seal(token),shareLinkRole:role,...expirationUpdate,...messageUpdate}},{new:true}).select('_id +shareLinkExpiresAt +shareLinkMessage');
      if(!result)continue;
      if(current.shareLinkHash&&(current.shareLinkRole||'view')!==role)liveInk.revokeShared(file._id,role);
      await liveInk.refreshExpiry(file._id);
      return res.status(current.shareLinkHash?200:201).json({path:`#/shared-document/${token}`,role,expiresAt:result.shareLinkExpiresAt||null,shareMessage:result.shareLinkMessage||'',expired:expired(result)});
    }
    res.status(409).json({message:'Sharing settings changed at the same time. Please retry.'});
  }));
  app.delete(path, ...ownerRoute(async (res, filter) => {
    const result=await PDF.updateOne(filter, { $unset: { shareLinkHash: 1, shareLinkSecret:1,shareLinkRole: 1,shareLinkExpiresAt:1,shareLinkMessage:1 } });
    if(!result.matchedCount)return res.status(403).json({message:'Your document sharing permissions changed.'});
    liveInk.revokeShared(filter._id);
    res.status(204).end();
  }));

  const publicText = (write, owner = false) => async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' });
    const unavailable = () => res.status(404).json({ message: 'This editor link is unavailable.' });
    if (owner ? !validId(req.params.id) : !/^[A-Za-z0-9_-]{43}$/.test(req.params.token)) return unavailable();
    try {
      const filter = owner ? { _id: req.params.id, user: req.user.userId, deletedAt: null } : { shareLinkHash: hashToken(req.params.token), shareLinkRole: 'edit', deletedAt: null, ...sharedAccess(req) };
      const file = await PDF.findOne(filter).select('name user pdfFolder originalName mimeType pdfData originalBackup +editHistory');
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
        const result = await PDF.updateOne({ ...filter,...(!owner?sharedAccess(req):{}), _id: file._id, pdfFolder: file.pdfFolder ?? null, pdfData: file.pdfData }, {
          $set: { pdfData: bytes, originalBackup: file.originalBackup || file.pdfData, editHistory:bytes.equals(file.pdfData)?file.editHistory:appendHistory(file,await collaboratorAccess.identify(req,res,file),{pdfData:bytes,action:'Edited text'}),updatedAt: new Date() }
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
  const editor = (handler, owner = false,allowView=false) => async (req, res) => {
    res.set({ 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' });
    if (owner ? !validId(req.params.id) : !/^[A-Za-z0-9_-]{43}$/.test(req.params.token)) return res.status(404).json({ message: 'This editor link is unavailable.' });
    try {
      const filter = owner ? { _id: req.params.id, user: req.user.userId, deletedAt: null } : { shareLinkHash: hashToken(req.params.token), shareLinkRole:allowView?{$in:['view','edit']}:'edit', deletedAt: null, ...sharedAccess(req) };
      const file = await PDF.findOne(filter).select(allowView ? '+editHistory +shareLinkRole +shareLinkMessage' : '+editHistory +shareLinkRole');
      if (!file || await isLocked(file)) return res.status(404).json({ message: 'This editor link is unavailable.' });
      const revision = editorRevision(file,normalized(file.annotations));
      const save = async (changes,details={}) => {
        if (req.get('X-Share-Revision') !== revision) {
          res.status(409).json({ message: 'This document changed. Download your draft before reopening the latest version.' });
          return false;
        }
        const actor=await collaboratorAccess.identify(req,res,file);
        const action=changes.pdfData?(req.method==='DELETE'?'Deleted a page':req.path.includes('/pages')?(req.body.mode==='reorder'?'Reordered pages':'Added pages'):'Replaced file contents'):undefined;
        const result = await PDF.updateOne({ ...filter,...(!owner?sharedAccess(req):{}), _id: file._id, updatedAt: file.updatedAt, pdfFolder: file.pdfFolder ?? null, pdfData: file.pdfData, annotations: file.annotations }, { $set: { ...changes, editHistory:appendHistory(file,actor,{...changes,action,pages:req.params.pageNumber?[Number(req.params.pageNumber)]:[],...details}),updatedAt: new Date() } }, { runValidators: true });
        if (!result.matchedCount) { res.status(409).json({ message: 'This document changed or its link was revoked. Reopen the link.' }); return false; }
        liveInk.saved(file._id);
        const next = editorRevision(file,normalized(changes.annotations || file.annotations),changes.pdfData || file.pdfData);
        res.set('X-Share-Revision', next);
        return true;
      };
      res.set('X-Share-Revision', revision);
      await handler(req, res, file, save, revision);
    } catch (error) { res.status(400).json({ message: error.message || 'Could not edit this shared file.' }); }
  };
  app.get('/api/shared-document/:token/editor', editor((req, res, file, save, revision) => {
    res.json({ _id: file._id, name: file.name, documentKind:file.documentKind, copiedFromName:file.copiedFromName, originalName: file.originalName, mimeType: file.mimeType, revision,role:file.shareLinkRole||'view',shareMessage:file.shareLinkMessage||'',
      editor: file.shareLinkRole!=='edit'?'view':editable(file) && file.pdfData.length <= 1024 * 1024 && Buffer.from(file.pdfData.toString('utf8')).equals(file.pdfData) ? 'text' : file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.originalName) ? 'pdf' : 'file' });
  },false,true));
  app.get('/api/shared-document/:token/document', editor((req, res, file) => {
    res.json({ _id: file._id, name: file.name, documentKind:file.documentKind, copiedFromName:file.copiedFromName, originalName: file.originalName, mimeType: file.mimeType, pdfData: file.pdfData.toString('base64'), annotations: file.annotations, tags: file.tags, whiteboardAppearance:file.whiteboardAppearance });
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
    const context=remove?`Deleted page ${req.params.pageNumber}. The document now has ${result.numPages} pages.`:options.mode==='reorder'?`Moved page ${options.currentPage} to page ${result.firstInsertedPage}.`:options.mode==='duplicate'?`Duplicated page ${options.currentPage} at page ${result.firstInsertedPage}. The document now has ${result.numPages} pages.`:`Inserted ${result.insertedPages} ${options.mode==='blank'?'blank ':''}page${result.insertedPages===1?'':'s'} starting at page ${result.firstInsertedPage}${sources.length?` from ${sources.length} PDF file${sources.length===1?'':'s'}`:''}. The document now has ${result.numPages} pages.`;
    if (await save({ pdfData: result.bytes, annotations: result.annotations },{context,pages:[remove?Number(req.params.pageNumber):result.firstInsertedPage].filter(Number.isInteger)})) res.json({ ...result, bytes: undefined, pdfData: result.bytes.toString('base64'), contentRevision: createHash('sha256').update(result.bytes).digest('hex') });
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
      const filter = { shareLinkHash: hashToken(req.params.token), deletedAt: null, ...sharedAccess(req) };
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
