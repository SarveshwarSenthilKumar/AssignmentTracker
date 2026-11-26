const validId=value=>typeof value==='string'&&/^[a-f\d]{24}$/i.test(value);
const pairKey=(a,b)=>[String(a).toLowerCase(),String(b).toLowerCase()].sort().join(':');
const same=(a,b)=>String(a)===String(b);

module.exports=function registerFriendSharing(app,auth,{User,PDF,isLocked,collaboratorAccess}){
  const {Schema,Types}=PDF.db.base;
  const schema=new Schema({
    _id:String, generation:{type:Schema.Types.ObjectId,required:true,index:true},
    sender:{type:Schema.Types.ObjectId,required:true,index:true},
    recipient:{type:Schema.Types.ObjectId,required:true,index:true},
    accepted:{type:Boolean,default:false}
  },{timestamps:true});
  const Friendship=PDF.db.models.Friendship||PDF.db.model('Friendship',schema);
  const activeAccount={deactivatedAt:null,approvalPending:{$ne:true}};
  const party=id=>({$or:[{sender:id},{recipient:id}]});
  const route=handler=>[auth,async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    if(Object.values(req.params).some(value=>!validId(value)))return res.status(404).json({message:'This item is unavailable.'});
    try{await handler(req,res);}
    catch{res.status(503).json({message:'Could not complete the sharing request.'});}
  }];
  async function acceptedFor(user){
    return Friendship.find({...party(user),accepted:true}).select('generation sender recipient').lean();
  }
  const ownerDocument=req=>PDF.findOne({_id:req.params.id,user:req.user.userId,deletedAt:null}).select('user pdfFolder +friendShares +revokedCollaborators');
  const friendsBase='/api/friends', sharesBase='/api/friend-shares';

  app.get(friendsBase,...route(async(req,res)=>{
    const user=req.user.userId;
    const relations=await Friendship.find(party(user)).sort({updatedAt:-1}).lean();
    const other=relation=>same(relation.sender,user)?relation.recipient:relation.sender;
    const accounts=await User.find({_id:{$in:relations.map(other)},...activeAccount}).select('username').lean();
    const names=new Map(accounts.map(account=>[String(account._id),account.username]));
    res.json(relations.flatMap(relation=>{
      const accountId=String(other(relation)),username=names.get(accountId);
      return username?[{id:relation.generation,accountId,username,status:relation.accepted?'friend':same(relation.sender,user)?'outgoing':'incoming'}]:[];
    }));
  }));

  app.post(friendsBase,...route(async(req,res)=>{
    const email=typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():'';
    if(!email||email.length>254)return res.status(400).json({message:'Enter your friend’s account email.'});
    const user=req.user.userId;
    const recipient=await User.findOne({email,...activeAccount}).select('username').lean();
    if(!recipient||same(recipient._id,user))return res.status(400).json({message:'Choose another active Assignment Tracker account.'});
    const id=pairKey(user,recipient._id);
    const generation=new Types.ObjectId();
    try{
      await Friendship.updateOne({_id:id},{$setOnInsert:{generation,sender:user,recipient:recipient._id,accepted:false}},{upsert:true});
    }catch(error){if(error.code!==11000)throw error;}
    res.status(204).end();
  }));

  app.post(friendsBase+'/:id/accept',...route(async(req,res)=>{
    const result=await Friendship.updateOne({generation:req.params.id,recipient:req.user.userId,accepted:false},{$set:{accepted:true}});
    if(!result.matchedCount)return res.status(404).json({message:'This friend request is unavailable.'});
    res.status(204).end();
  }));

  app.delete(friendsBase+'/:id',...route(async(req,res)=>{
    // A new request gets a new generation, so removed friends never regain old shares.
    const relation=await Friendship.findOneAndDelete({generation:req.params.id,...party(req.user.userId)});
    if(relation)await PDF.updateMany({'friendShares.friendship':relation.generation},
      {$pull:{friendShares:{friendship:relation.generation}}},{timestamps:false}).catch(()=>{});
    res.status(204).end();
  }));

  app.get(sharesBase+'/:id',...route(async(req,res)=>{
    const file=await ownerDocument(req);
    if(!file||await isLocked(file))return res.status(404).json({message:'This document is unavailable for sharing.'});
    const active=new Set((await acceptedFor(req.user.userId)).map(relation=>String(relation.generation)));
    res.json((file.friendShares||[]).filter(share=>active.has(String(share.friendship))).map(share=>share.recipient));
  }));

  app.post(sharesBase+'/:id',...route(async(req,res)=>{
    const recipient=req.body?.recipient;
    if(!validId(recipient))return res.status(400).json({message:'Choose a friend.'});
    const user=req.user.userId;
    const friendship=await Friendship.findOne({_id:pairKey(user,recipient),accepted:true}).select('generation').lean();
    if(!friendship||!await User.exists({_id:recipient,...activeAccount}))return res.status(404).json({message:'This friend is unavailable.'});
    const file=await ownerDocument(req);
    if(!file||await isLocked(file))return res.status(404).json({message:'This document is unavailable for sharing.'});
    const blocked=collaboratorAccess.blocked(file,collaboratorAccess.forFile({accountId:recipient},file));
    if(blocked)return res.status(403).json({message:'This account’s access to the document was revoked.'});
    const result=await PDF.updateOne({_id:file._id,user,deletedAt:null},{
      $addToSet:{friendShares:{recipient,friendship:friendship.generation}}
    },{timestamps:false});
    if(!result.matchedCount)return res.status(404).json({message:'This document is unavailable.'});
    res.status(204).end();
  }));

  app.delete(sharesBase+'/:id/:recipient',...route(async(req,res)=>{
    const result=await PDF.updateOne({_id:req.params.id,user:req.user.userId,deletedAt:null},
      {$pull:{friendShares:{recipient:req.params.recipient}}},{timestamps:false});
    if(!result.matchedCount)return res.status(404).json({message:'This document is unavailable.'});
    res.status(204).end();
  }));

  app.get(sharesBase+'/:id/download',...route(async(req,res)=>{
    const user=req.user.userId;
    const grants=await acceptedFor(user);
    const file=await PDF.findOne({_id:req.params.id,deletedAt:null,
      friendShares:{$elemMatch:{recipient:user,friendship:{$in:grants.map(relation=>relation.generation)}}}
    }).select('user pdfFolder originalName pdfData +friendShares +revokedCollaborators');
    const authorized=file&&grants.some(relation=>
      (same(relation.sender,file.user)||same(relation.recipient,file.user))&&
      file.friendShares.some(share=>same(share.friendship,relation.generation)&&same(share.recipient,user)));
    const identity=file&&collaboratorAccess.forFile({accountId:user},file);
    if(!authorized||await isLocked(file)||collaboratorAccess.blocked(file,identity)){
      return res.status(404).json({message:'This shared document is unavailable.'});
    }
    res.set('X-Content-Type-Options','nosniff');
    res.attachment(file.originalName).type('application/octet-stream').send(file.pdfData);
  }));

  return {acceptedFor};
};
