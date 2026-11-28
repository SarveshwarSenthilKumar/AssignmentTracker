const validateStudySources = require('./studySources');
const { ratings, nextReview } = require('./studyReview');

module.exports=function(app,authenticateToken,{mongoose,AssistantConversation,PDF}){
  const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},kind:{type:String,enum:['question','topic'],default:'question'},title:{type:String,required:true,maxlength:500},answer:{type:String,default:'',maxlength:24000},answers:{type:[String],default:undefined},notes:{type:String,default:'',maxlength:12000},topic:{type:String,default:'',maxlength:120},studied:{type:Boolean,default:false},reviewedAt:Date,sources:{type:[mongoose.Schema.Types.Mixed],default:undefined},review: new mongoose.Schema({
    dueAt: Date, intervalMinutes: Number, count: Number, rating: { type: String, enum: ratings }, attemptId: String,
  }, { _id: false }),sourceKey:String,conversationId:String,messageId:String},{timestamps:true});
  schema.index({user:1,sourceKey:1},{unique:true,partialFilterExpression:{sourceKey:{$type:'string'}}});
  const StudyItem=mongoose.models.StudyItem||mongoose.model('StudyItem',schema);
  const route=handler=>async(req,res)=>{try{await handler(req,res)}catch(error){if(error.code===11000)return res.status(409).json({message:'This question is already starred. Refresh your study list.'});res.status(500).json({message:'Could not save the study list. Please retry.'})}};
  const valid=id=>typeof id==='string'&&/^[a-f0-9]{24}$/i.test(id);
  const fields=body=>{
    const result={};for(const [key,max] of [['title',500],['answer',24000],['notes',12000],['topic',120]])if(body[key]!==undefined){if(typeof body[key]!=='string'||body[key].length>max)throw new Error('invalid');result[key]=body[key].trim()}
    if(body.answers!==undefined){
      if(!Array.isArray(body.answers)||body.answers.length>20||body.answers.some(answer=>typeof answer!=='string'||answer.length>24000))throw new Error('invalid');
      result.answers=body.answers.map(answer=>answer.trim()).filter(Boolean);result.answer=result.answers[0]||'';
    }else if(body.answer!==undefined){result.answers=result.answer?[result.answer]:[]}
    if(body.kind!==undefined){if(!['question','topic'].includes(body.kind))throw new Error('invalid');result.kind=body.kind}
    if(body.studied!==undefined){if(typeof body.studied!=='boolean')throw new Error('invalid');result.studied=body.studied;result.reviewedAt=body.studied?new Date():null}
    if(result.title==='')throw new Error('invalid');return result;
  };
  app.get('/api/study',authenticateToken,route(async(req,res)=>res.set('Cache-Control','no-store').json(await StudyItem.find({user:req.user.userId}).sort({createdAt:-1}).lean())));
  app.post('/api/study',authenticateToken,route(async(req,res)=>{
    let data;try{data=fields(req.body||{})}catch{return res.status(400).json({message:'Enter a title up to 500 characters, a topic up to 120, and up to 20 answers of 24,000 characters each.'})}
    if(req.body?.conversationId){
      const {conversationId,messageId}=req.body;if(!valid(conversationId)||!valid(messageId))return res.status(400).json({message:'Choose a saved question.'});
      const conversation=await AssistantConversation.findOne({_id:conversationId,user:req.user.userId}).lean();
      const index=conversation?.messages.findIndex(message=>String(message._id)===messageId&&message.role==='user')??-1;
      if(index<0)return res.status(404).json({message:'The saved question is no longer available.'});
      const question=conversation.messages[index],next=conversation.messages[index+1];
      data={...data,kind:'question',title:question.content.slice(0,500),notes:question.content.length>500?question.content.slice(0,12000):'',answer:next?.role==='assistant'?next.content.slice(0,24000):'',conversationId,messageId,sourceKey:`${conversationId}:${messageId}`};
      data.answers=data.answer?[data.answer]:[];
      const existing=await StudyItem.findOne({user:req.user.userId,sourceKey:data.sourceKey});if(existing)return res.json(existing);
    }
    if (req.body?.sources !== undefined) {
      data.sources = await validateStudySources(req.body.sources, req.user.userId, PDF);
      if (!data.sources) return res.status(400).json({ message: 'Choose up to five available PDFs or workspace note sections.' });
    }
    if(!data.title)return res.status(400).json({message:'Enter a question or topic.'});
    res.status(201).json(await StudyItem.create({...data,user:req.user.userId}));
  }));
  app.post('/api/study/:id/review', authenticateToken, route(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const { rating, version, attemptId, questionUpdatedAt } = req.body || {};
    if (!valid(req.params.id) || !ratings.includes(rating) || !Number.isSafeInteger(version) || version < 0 ||
      typeof attemptId !== 'string' || !/^[a-f\d]{32}$/.test(attemptId)) {
      return res.status(400).json({ message: 'Choose a confidence rating for a saved question.' });
    }
    const filter = { _id: req.params.id, user: req.user.userId, kind: 'question' };
    const current = await StudyItem.findOne(filter).lean();
    if (!current) return res.status(404).json({ message: 'This question is no longer in your bank.' });
    if (current.review?.attemptId === attemptId) return res.json(current);
    const now = new Date();
    if ((questionUpdatedAt && questionUpdatedAt !== current.updatedAt?.toISOString()) || (current.review?.count || 0) !== version || current.review?.dueAt > now) {
      return res.status(409).json({ message: 'This question was already scheduled. Refresh the review queue.' });
    }
    const match = version ? { 'review.count': version } : { 'review.count': { $in: [null, 0] } };
    const item = await StudyItem.findOneAndUpdate({ ...filter, ...match, updatedAt: current.updatedAt },
      { $set: { review: { ...nextReview(current.review, rating, now), attemptId }, studied: true, reviewedAt: now } },
      { new: true, runValidators: true });
    if (item) return res.json(item);
    const retried = await StudyItem.findOne({ ...filter, 'review.attemptId': attemptId }).lean();
    if (retried) return res.json(retried);
    return res.status(409).json({ message: 'This question changed. Refresh the review queue.' });
  }));
  app.patch('/api/study/:id',authenticateToken,route(async(req,res)=>{
    if(!valid(req.params.id))return res.status(400).json({message:'Invalid study item.'});let data;try{data=fields(req.body||{})}catch{return res.status(400).json({message:'Check the title and field lengths. Use up to 20 answers of 24,000 characters each.'})}
    if (req.body?.sources !== undefined) {
      const current = await StudyItem.findOne({ _id: req.params.id, user: req.user.userId }).select('sources').lean();
      if (!current) return res.status(404).json({ message: 'Study item not found.' });
      data.sources = await validateStudySources(req.body.sources, req.user.userId, PDF, current.sources);
      if (!data.sources) return res.status(400).json({ message: 'Choose up to five available PDFs or workspace note sections.' });
    }
    const item=await StudyItem.findOneAndUpdate({_id:req.params.id,user:req.user.userId},{$set:data},{new:true,runValidators:true});if(!item)return res.status(404).json({message:'Study item not found.'});res.json(item);
  }));
  app.delete('/api/study/:id',authenticateToken,route(async(req,res)=>{if(!valid(req.params.id))return res.status(400).json({message:'Invalid study item.'});const item=await StudyItem.findOneAndDelete({_id:req.params.id,user:req.user.userId});if(!item)return res.status(404).json({message:'Study item not found.'});res.json({deleted:true})}));
  return StudyItem;
};
