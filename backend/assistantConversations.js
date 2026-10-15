const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const ID=/^[a-f\d]{24}$/i;
const messageSchema=new mongoose.Schema({
  role:{type:String,enum:['user','assistant'],required:true},
  content:{type:String,required:true,maxlength:12000},
  sources:{type:[{type:{type:String},id:String,title:String,_id:false}],default:[]},
  context:mongoose.Schema.Types.Mixed,
  partial:Boolean,failed:Boolean,
  createdAt:{type:Date,default:Date.now},
});
const schema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
  title:{type:String,default:'New chat',maxlength:120},
  pinned:{type:Boolean,default:false},archived:{type:Boolean,default:false},
  settings:{workspace:{type:Boolean,default:true},screen:{type:Boolean,default:true},file:{type:Boolean,default:true}},
  messages:{type:[messageSchema],default:[]},
  revision:{type:Number,default:0},
  generationId:String,generatingUntil:Date,generationError:String,
},{timestamps:true});
schema.index({user:1,archived:1,pinned:-1,updatedAt:-1});
const AssistantConversation=mongoose.model('AssistantConversation',schema);
const summaryFields='title pinned archived settings revision createdAt updatedAt generatingUntil generationError';
function chatError(message,status=400){const error=new Error(message);error.status=status;return error;}
function available(user,id){return {_id:id,user,$or:[{generatingUntil:null},{generatingUntil:{$lte:new Date()}}]};}
function publicConversation(doc){
  const value=doc.toObject?doc.toObject():{...doc};
  delete value.user;delete value.generationId;delete value.__v;
  if(value.generatingUntil&&new Date(value.generatingUntil)<=new Date()){
    value.generatingUntil=null;
    value.generationError='The previous reply was interrupted. You can retry your question.';
    if(value.messages?.at(-1)?.role==='user')value.messages.at(-1).failed=true;
  }
  return value;
}
function registerConversationRoutes(app,authenticateToken){
  app.use('/api/assistant/conversations',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.get('/api/assistant/conversations',authenticateToken,async(req,res)=>{
    try {
      const filter={user:req.user.userId,archived:req.query.archived==='true'};
      const search=String(req.query.q||'').trim().slice(0,100);
      if(search){const literal=search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');filter.$or=[{title:{$regex:literal,$options:'i'}},{'messages.content':{$regex:literal,$options:'i'}}];}
      const offset=Math.min(100000,Math.max(0,Number.parseInt(req.query.offset,10)||0));
      const records=await AssistantConversation.find(filter).select(summaryFields).sort({pinned:-1,updatedAt:-1,_id:-1}).skip(offset).limit(41).lean();
      res.json({conversations:records.slice(0,40).map(publicConversation),nextOffset:records.length>40?offset+40:null});
    }catch{res.status(500).json({message:'Could not load chat history.'});}
  });
  app.post('/api/assistant/conversations',authenticateToken,async(req,res)=>{
    try{const chat=await AssistantConversation.create({user:req.user.userId});res.status(201).json(publicConversation(chat));}
    catch{res.status(500).json({message:'Could not create a chat.'});}
  });
  app.get('/api/assistant/conversations/:id',authenticateToken,async(req,res)=>{
    if(!ID.test(req.params.id))return res.status(400).json({message:'Invalid chat ID.'});
    try{const chat=await AssistantConversation.findOne({_id:req.params.id,user:req.user.userId});if(!chat)return res.status(404).json({message:'Chat not found.'});res.json(publicConversation(chat));}
    catch{res.status(500).json({message:'Could not open this chat.'});}
  });
  app.post('/api/assistant/conversations/:id/fork',authenticateToken,async(req,res)=>{
    if(!ID.test(req.params.id)||!ID.test(req.body.messageId||''))return res.status(400).json({message:'Choose a saved message to branch from.'});
    try{
      const original=await AssistantConversation.findOne({_id:req.params.id,user:req.user.userId});
      if(!original)return res.status(404).json({message:'Chat not found.'});
      const index=original.messages.findIndex(message=>String(message._id)===req.body.messageId);
      if(index<0)return res.status(404).json({message:'Message not found. Reopen this chat.'});
      const selected=original.messages[index];
      const messages=original.messages.slice(0,selected.role==='user'?index:index+1).map(message=>{const value=message.toObject();delete value._id;return value;});
      const chat=await AssistantConversation.create({user:req.user.userId,title:`${original.title} (branch)`.slice(0,120),settings:original.settings.toObject?original.settings.toObject():original.settings,messages});
      res.status(201).json({conversation:publicConversation(chat),question:selected.role==='user'?selected.content:''});
    }catch{res.status(500).json({message:'Could not create a branch of this conversation.'});}
  });
  app.patch('/api/assistant/conversations/:id',authenticateToken,async(req,res)=>{
    if(!ID.test(req.params.id))return res.status(400).json({message:'Invalid chat ID.'});
    const changes={};
    if(req.body.title!==undefined){if(typeof req.body.title!=='string'||!req.body.title.trim()||req.body.title.trim().length>120)return res.status(400).json({message:'Enter a chat title between 1 and 120 characters.'});changes.title=req.body.title.trim();}
    for(const key of ['pinned','archived'])if(req.body[key]!==undefined){if(typeof req.body[key]!=='boolean')return res.status(400).json({message:'Invalid chat setting.'});changes[key]=req.body[key];}
    if(req.body.settings!==undefined){for(const key of ['workspace','screen','file']){if(typeof req.body.settings?.[key]!=='boolean')return res.status(400).json({message:'Choose which context to share.'});changes[`settings.${key}`]=req.body.settings[key];}}
    if(!Number.isInteger(req.body.revision)||!Object.keys(changes).length)return res.status(400).json({message:'Refresh this chat before saving changes.'});
    try{const chat=await AssistantConversation.findOneAndUpdate({...available(req.user.userId,req.params.id),revision:req.body.revision},{$set:changes,$inc:{revision:1}},{new:true,runValidators:true});if(!chat)return res.status(409).json({message:'This chat changed or is generating a reply. Reopen it and try again.'});res.json(publicConversation(chat));}
    catch{res.status(500).json({message:'Could not update this chat.'});}
  });
  app.delete('/api/assistant/conversations/:id',authenticateToken,async(req,res)=>{
    if(!ID.test(req.params.id))return res.status(400).json({message:'Invalid chat ID.'});
    const revision=Number(req.query.revision);
    if(!Number.isInteger(revision))return res.status(400).json({message:'Refresh this chat before deleting it.'});
    try{const result=await AssistantConversation.deleteOne({...available(req.user.userId,req.params.id),revision});if(!result.deletedCount)return res.status(409).json({message:'This chat changed or is generating a reply. Reopen it and try again.'});res.json({deleted:true});}
    catch{res.status(500).json({message:'Could not delete this chat.'});}
  });
}
async function prepareConversation(user,body){
  if(!ID.test(body.conversationId||'')||!Number.isInteger(body.revision))throw chatError('Choose a saved chat and refresh it before sending.');
  const chat=await AssistantConversation.findOne({_id:body.conversationId,user});
  if(!chat)throw chatError('Chat not found.',404);
  if(chat.archived)throw chatError('Restore this archived chat before continuing.',409);
  if(chat.revision!==body.revision)throw chatError('This chat changed in another tab. Reopen it before sending.',409);
  const regenerate=body.regenerate===true;
  if(regenerate&&chat.messages.at(-1)?.role!=='assistant')throw chatError('There is no answer to regenerate.');
  if(!regenerate&&(typeof body.question!=='string'||!body.question.trim()||body.question.length>4000))throw chatError('Enter a question of up to 4,000 characters.');
  const messages=chat.messages.map(message=>message.toObject());
  if(regenerate)messages.pop();
  else {
    if(messages.at(-1)?.role==='user'){
      if(messages.at(-1).content===body.question.trim())messages.pop();
      else messages.at(-1).failed=true;
    }
    if(messages.length>=299)throw chatError('This conversation is full. Start a new chat to continue.');
    messages.push({role:'user',content:body.question.trim(),createdAt:new Date()});
  }
  const history=[];let characters=0;
  for(const message of messages.filter(message=>!message.failed).reverse()){
    const content=message.content.slice(0,4000);
    if(history.length>=20||characters+content.length>40000)break;
    history.unshift({role:message.role,content});characters+=content.length;
  }
  const generationId=randomUUID();
  const settings={workspace:body.includeWorkspace,screen:body.includeScreen,file:body.includeDocument};
  const updates={generationId,generatingUntil:new Date(Date.now()+120000),generationError:'',settings};
  if(!regenerate)updates.messages=messages;
  if(!chat.messages.length)updates.title=body.question.trim().replace(/\s+/g,' ').slice(0,120);
  const locked=await AssistantConversation.findOneAndUpdate({...available(user,chat.id),revision:body.revision},{$set:updates,$inc:{revision:1}},{new:true});
  if(!locked)throw chatError('A reply is already running or this chat changed. Reopen it and try again.',409);
  return {id:chat.id,user,generationId,messages,history,regenerate};
}
async function finishConversation(turn,answer,error){
  if(!turn)return null;
  const changes={generationId:null,generatingUntil:null,generationError:error||''};
  if(answer)changes.messages=[...turn.messages,{role:'assistant',...answer,createdAt:new Date()}];
  else if(!turn.regenerate)changes.messages=turn.messages.map((message,index)=>index===turn.messages.length-1?{...message,failed:true}:message);
  const chat=await AssistantConversation.findOneAndUpdate({_id:turn.id,user:turn.user,generationId:turn.generationId},{$set:changes,$inc:{revision:1}},{new:true});
  if(!chat)throw chatError('The chat changed before this answer could be saved. Reopen it to see the saved state.',409);
  return publicConversation(chat);
}
module.exports={AssistantConversation,registerConversationRoutes,prepareConversation,finishConversation};
