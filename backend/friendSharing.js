const { createHash, randomBytes } = require('node:crypto');
const inviteHash = secret => createHash('sha256').update(secret).digest('hex');
const validInvite = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);

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
    if(Object.entries(req.params).some(([key,value])=>key==='secret'?!validInvite(value):!validId(value)))return res.status(404).json({message:'This item is unavailable.'});
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
    const { email, username } = req.body || {};
    if ((email === undefined) === (username === undefined)) {
      return res.status(400).json({message:'Enter either an account email or a username.'});
    }
    const byUsername = username !== undefined;
    const raw = byUsername ? username : email;
    const identifier = typeof raw === 'string' ? raw.trim() : '';
    if (!identifier || identifier.length > (byUsername ? 1024 : 254)) {
      return res.status(400).json({message:byUsername ? 'Enter your friend’s exact username.' : 'Enter your friend’s account email.'});
    }
    const user=req.user.userId;
    const lookup = byUsername ? { username: identifier } : { email: identifier.toLowerCase() };
    const recipient=await User.findOne({...lookup,...activeAccount}).select('username').lean();
    if(!recipient||same(recipient._id,user))return res.status(400).json({message:'Choose another active Assignment Tracker account.'});
    const id=pairKey(user,recipient._id);
    const generation=new Types.ObjectId();
    try{
      await Friendship.updateOne({_id:id},{$setOnInsert:{generation,sender:user,recipient:recipient._id,accepted:false}},{upsert:true});
    }catch(error){if(error.code!==11000)throw error;}
    res.status(204).end();
  }));

  const inviteBase = '/api/friend-invites';
  const inviteFields = { friendInviteHash: '', friendInviteExpiresAt: '' };
  const activeInvite = secret => ({
    ...activeAccount, friendInviteHash: inviteHash(secret), friendInviteExpiresAt: { $gt: new Date() },
  });

  app.get(inviteBase, ...route(async (req, res) => {
    const account = await User.findById(req.user.userId).select('+friendInviteExpiresAt').lean();
    const expiresAt = account?.friendInviteExpiresAt;
    res.json({ expiresAt: expiresAt > new Date() ? expiresAt : null });
  }));

  app.post(inviteBase, ...route(async (req, res) => {
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const result = await User.updateOne({ _id: req.user.userId, ...activeAccount }, {
      $set: { friendInviteHash: inviteHash(secret), friendInviteExpiresAt: expiresAt },
    });
    if (!result.matchedCount) return res.status(404).json({ message: 'This account is unavailable.' });
    res.status(201).json({ path: '/friend-invite/' + secret, expiresAt });
  }));

  app.delete(inviteBase, ...route(async (req, res) => {
    await User.updateOne({ _id: req.user.userId }, { $unset: inviteFields });
    res.status(204).end();
  }));

  app.get(inviteBase + '/:secret', ...route(async (req, res) => {
    const inviter = await User.findOne(activeInvite(req.params.secret)).select('username +friendInviteExpiresAt').lean();
    if (!inviter) return res.status(404).json({ message: 'This invite has expired, been used, or been revoked.' });
    if (same(inviter._id, req.user.userId)) return res.status(400).json({ message: 'Share this link with someone else to become friends.' });
    const alreadyFriends = Boolean(await Friendship.exists({ _id: pairKey(inviter._id, req.user.userId), accepted: true }));
    res.json({ username: inviter.username, expiresAt: inviter.friendInviteExpiresAt, alreadyFriends });
  }));

  app.post(inviteBase + '/:secret', ...route(async (req, res) => {
    const recipient = req.user.userId;
    const session = await User.db.startSession();
    let outcome;
    try {
      await session.withTransaction(async () => {
        const filter = activeInvite(req.params.secret);
        const inviter = await User.findOne(filter).select('username').session(session).lean();
        if (!inviter) { outcome = 'unavailable'; return; }
        if (same(inviter._id, recipient)) { outcome = 'self'; return; }
        if (!await User.exists({ _id: recipient, ...activeAccount }).session(session)) {
          outcome = 'unavailable'; return;
        }
        const id = pairKey(inviter._id, recipient);
        if (await Friendship.exists({ _id: id, accepted: true }).session(session)) {
          outcome = 'accepted'; return;
        }
        const consumed = await User.updateOne({ _id: inviter._id, ...filter }, { $unset: inviteFields }, { session });
        if (!consumed.matchedCount) { outcome = 'unavailable'; return; }
        await Friendship.updateOne({ _id: id }, {
          $setOnInsert: { generation: new Types.ObjectId(), sender: inviter._id, recipient },
          $set: { accepted: true },
        }, { upsert: true, session });
        outcome = 'accepted';
      });
    } finally { await session.endSession(); }
    if (outcome === 'self') return res.status(400).json({ message: 'You cannot accept your own invite.' });
    if (outcome !== 'accepted') return res.status(404).json({ message: 'This invite has expired, been used, or been revoked.' });
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
