const {randomBytes}=require('node:crypto');
const {hash,seal,unseal}=require('./shareLinkSecret');

module.exports=function registerTaskFolderShares(app,auth,{Folder,Todo,User}){
  const options={ 'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer' };
  const base='/api/task-folder-shares';
  const validId=value=>/^[a-f\d]{24}$/i.test(value);
  const validToken=value=>/^[\w-]{43}$/.test(value);
  const fields='name user parentId +taskShareHash +taskShareSecret';
  const ownerFilter=req=>({_id:req.params.id,user:req.user.userId});
  const path=token=>'#/shared-task-folder/'+token;
  const unavailable=res=>res.status(404).json({message:'This task folder or sharing link is unavailable.'});
  const ownerRoute=handler=>[auth,async(req,res)=>{
    res.set(options);
    if(!validId(req.params.id))return unavailable(res);
    try{await handler(req,res);}
    catch{res.status(503).json({message:'Could not manage task folder sharing.'});}
  }];

  async function isLocked(folder){
    const owner=await User.findById(folder.user).select('lockedSections deactivatedAt approvalPending').lean();
    if(!owner||owner.deactivatedAt||owner.approvalPending)return true;
    const locks=new Set(owner.lockedSections);
    if(locks.has('tasks'))return true;
    const seen=new Set();
    for(let item=folder;item;){
      const id=String(item._id);
      if(seen.has(id)||locks.has('tasks:'+id))return true;
      seen.add(id);
      if(!item.parentId)return false;
      item=await Folder.findOne({_id:item.parentId,user:folder.user}).select('parentId').lean();
      if(!item)return true;
    }
    return false;
  }

  const currentPath=folder=>{
    const token=folder.taskShareSecret&&unseal(folder.taskShareSecret);
    return token&&hash(token)===folder.taskShareHash?path(token):null;
  };

  app.get(base+'/:id',...ownerRoute(async(req,res)=>{
    const folder=await Folder.findOne(ownerFilter(req)).select(fields).lean();
    if(!folder)return unavailable(res);
    if(!folder.taskShareHash)return res.json({active:false,path:null});
    res.json({active:true,path:currentPath(folder)});
  }));
  app.post(base+'/:id',...ownerRoute(async(req,res)=>{
    const filter=ownerFilter(req);
    const folder=await Folder.findOne(filter).select(fields).lean();
    if(!folder||await isLocked(folder))return unavailable(res);
    if(folder.taskShareHash)return res.json({active:true,path:currentPath(folder)});
    const token=randomBytes(32).toString('base64url');
    const result=await Folder.updateOne({...filter,taskShareHash:null},
      {$set:{taskShareHash:hash(token),taskShareSecret:seal(token)}});
    if(result.matchedCount)return res.status(201).json({active:true,path:path(token)});
    const existing=await Folder.findOne(filter).select(fields).lean();
    if(!existing)return unavailable(res);
    res.json({active:!!existing.taskShareHash,path:currentPath(existing)});
  }));
  app.delete(base+'/:id',...ownerRoute(async(req,res)=>{
    const result=await Folder.updateOne(ownerFilter(req),{$unset:{taskShareHash:1,taskShareSecret:1}});
    if(!result.matchedCount)return unavailable(res);
    res.status(204).end();
  }));

  app.get('/api/shared-task-folder/:token',async(req,res)=>{
    res.set(options);
    if(!validToken(req.params.token))return unavailable(res);
    try{
      const folder=await Folder.findOne({taskShareHash:hash(req.params.token)}).select('name user parentId').lean();
      if(!folder||await isLocked(folder))return unavailable(res);
      const tasks=await Todo.find({folder:folder._id,user:folder.user})
        .select('text status completedAt dueDate calendarAllDay calendarDate')
        .sort({createdAt:1,_id:1}).lean();
      res.json({name:folder.name,tasks});
    }catch{res.status(503).json({message:'Could not load the shared task folder.'});}
  });
};
