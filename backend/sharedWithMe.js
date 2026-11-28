const {createHash,createCipheriv,createDecipheriv,randomBytes}=require('node:crypto');
const mongoose=require('mongoose');
const {expired}=require('./shareLinkExpiry');

module.exports=function registerSharedWithMe(app,auth,{PDF,User,PDFFolder,collaboratorAccess,isLocked,friends}){
  const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},document:{type:mongoose.Schema.Types.ObjectId,required:true},linkHash:String,link:String,visitedAt:Date});
  schema.index({user:1,document:1},{unique:true});
  const Receipt=PDF.db.models.SharedDocumentReceipt||PDF.db.model('SharedDocumentReceipt',schema);
  const key=createHash('sha256').update(process.env.JWT_SECRET||randomBytes(32)).digest();
  const hash=token=>createHash('sha256').update(token).digest('hex');
  const encrypt=token=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');};
  const decrypt=value=>{const data=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');};
  const remember=async(identity,file,token)=>{
    if(!identity.accountId||identity.owner)return;
    const filter={user:identity.accountId,document:file._id},update={$set:{linkHash:hash(token),link:encrypt(token),visitedAt:new Date()}};
    try{await Receipt.updateOne(filter,update,{upsert:true});}catch(error){if(error.code!==11000)throw error;await Receipt.updateOne(filter,update);}
  };
  app.post('/api/shared-with-me/documents',auth,async(req,res)=>{
    res.set('Cache-Control','no-store');
    const token=req.body?.token;
    if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return res.status(400).json({message:'Paste a valid document sharing link.'});
    try{
      const file=await PDF.findOne({shareLinkHash:hash(token),deletedAt:null}).select('user pdfFolder +revokedCollaborators +shareLinkExpiresAt').lean();
      if(!file||await isLocked(file))return res.status(404).json({message:'This document link is unavailable.'});
      if(expired(file))return res.status(410).json({message:'This sharing link has expired. Ask the owner or a document admin to extend it.'});
      const identity=await collaboratorAccess.identify(req,res,file);
      if(collaboratorAccess.blocked(file,identity))return res.status(403).json({message:'Your access to this document was revoked.'});
      if(identity.owner)return res.status(400).json({message:'This document is already in your own library.'});
      await remember(identity,file,token);res.status(201).json({saved:true});
    }catch{res.status(503).json({message:'Could not save the shared document.'});}
  });
  app.get('/api/shared-with-me/documents',auth,async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    try{
      const receipts=await Receipt.find({user:req.user.userId}).sort({visitedAt:-1}).limit(200).lean();
      const user=req.user.userId;
      const relationships=await friends.acceptedFor(user);
      const ownersByFriendship=new Map(relationships.map(relation=>[String(relation.generation),String(relation.sender)===String(user)?String(relation.recipient):String(relation.sender)]));
      const files=await PDF.find({deletedAt:null,user:{$ne:user},$or:[
        {_id:{$in:receipts.map(item=>item.document)}},{documentAdmins:user},
        {friendShares:{$elemMatch:{recipient:user,friendship:{$in:relationships.map(relation=>relation.generation)}}}}
      ]}).select('name originalName mimeType documentKind user pdfFolder updatedAt +shareLinkHash +shareLinkRole +shareLinkExpiresAt +shareLinkMessage +documentAdmins +revokedCollaborators +friendShares').lean();
      if(!files.length)return res.json([]);
      const identity=await collaboratorAccess.identify(req,res,files[0]);
      const owners=await User.find({_id:{$in:files.map(file=>file.user)}}).select('username lockedSections deactivatedAt approvalPending').lean();
      const ownerMap=new Map(owners.map(owner=>[String(owner._id),owner]));
      const folders=await PDFFolder.find({user:{$in:owners.map(owner=>owner._id)}}).select('user parentId').lean();
      const folderMap=new Map(folders.map(folder=>[String(folder._id),folder]));
      const receiptMap=new Map(receipts.map(item=>[String(item.document),item]));
      const available=file=>{
        const owner=ownerMap.get(String(file.user));
        if(!owner||owner.deactivatedAt||owner.approvalPending)return false;
        const locks=new Set(owner.lockedSections||[]),seen=new Set();
        if(locks.has('documents')||locks.has(`file:${file._id}`))return false;
        for(let id=file.pdfFolder;id;){const value=String(id),folder=folderMap.get(value);if(seen.has(value)||locks.has(`documents:${value}`)||!folder||String(folder.user)!==String(file.user))return false;seen.add(value);id=folder.parentId;}
        return !collaboratorAccess.blocked(file,collaboratorAccess.forFile(identity,file));
      };
      const result=[];
      for(const file of files){
        if(!available(file))continue;
        const admin=(file.documentAdmins||[]).some(id=>String(id)===String(req.user.userId));
        const receipt=receiptMap.get(String(file._id));
        let path=null;
        if(!expired(file)&&receipt&&receipt.linkHash===file.shareLinkHash){try{const token=decrypt(receipt.link);if(hash(token)===file.shareLinkHash)path=`#/shared-document/${token}`;}catch{}}
        const privateGrant=(file.friendShares||[]).find(share=>String(share.recipient)===String(user)&&ownersByFriendship.get(String(share.friendship))===String(file.user));
        const friendShare = Boolean(privateGrant);
        if(!admin&&!path&&!friendShare)continue;
        result.push({_id:file._id,name:file.name,documentKind:file.documentKind,originalName:file.originalName,mimeType:file.mimeType,owner:ownerMap.get(String(file.user)).username,role:admin?'Admin':path&&file.shareLinkRole==='edit'?'Editor':'Viewer',updatedAt:file.updatedAt,visitedAt:receipt?.visitedAt,openPath:path,friendShare,friendMessage:privateGrant?.message||'',shareMessage:path?file.shareLinkMessage||'':'',canManageLinks:admin});
      }
      res.json(result.sort((a,b)=>new Date(b.visitedAt||b.updatedAt)-new Date(a.visitedAt||a.updatedAt)));
    }catch{res.status(503).json({message:'Could not load documents shared with you.'});}
  });
  const recoverToken=async file=>{
    const receipts=await Receipt.find({document:file._id,linkHash:file.shareLinkHash}).select('link').limit(10).lean();
    for(const receipt of receipts){try{const token=decrypt(receipt.link);if(hash(token)===file.shareLinkHash)return token;}catch{}}
    return null;
  };
  return {remember,recoverToken};
};
