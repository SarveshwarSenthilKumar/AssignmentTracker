const contactEmail=require('./feedbackContactEmail');
module.exports=(app,auth,mongoose)=>{
  const sections=['Home','Tasks','Calendar','Documents','PDF editor','Notes','AI assistant','Study phone','Workspace','Visualization','Career prep','Resumes','Cover letters','Saved jobs','Study stars','Analytics','Account','Site roadmap','Feature suggestions','Bug reports','Miscellaneous'];
  const statuses=['submitted','reviewing','planned','in-progress','shipped','not-planned'],priorities=['nice-to-have','useful','important','essential'];
  const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},submissionId:{type:String,required:true},contactEmail:{type:String,default:'',maxlength:254},section:{type:String,enum:sections},priority:{type:String,enum:priorities},title:String,problem:String,solution:String,benefits:String,workaround:String,roadmapItem:{type:mongoose.Schema.Types.ObjectId,ref:'SiteRoadmapItem'},status:{type:String,enum:statuses,default:'submitted'},response:{type:String,default:''},revision:{type:Number,default:0}},{timestamps:true});
  schema.index({user:1,submissionId:1},{unique:true});schema.index({user:1,createdAt:-1});
  const Report=mongoose.models.FeatureSuggestion||mongoose.model('FeatureSuggestion',schema);
  const reviewer=async id=>(await require('./adminAccess')(mongoose,id)).features;
  const roadmapEditor=async id=>(await require('./adminAccess')(mongoose,id)).roadmap;
  const safeText=(body,key,max,required=false)=>{const value=body[key]??'';if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`Enter valid ${key} (${required?'required, ':''}up to ${max} characters).`);return value.trim()};
  app.get('/api/feature-suggestions',auth,async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{
      const canReview=await reviewer(req.user.userId),all=req.query.scope==='all';if(all&&!canReview)return res.status(403).json({message:'Only configured reviewers can view other users’ suggestions.'});
      const filter=all?{}:{user:req.user.userId};
      if(req.query.status){if(!statuses.includes(req.query.status))return res.status(400).json({message:'Invalid suggestion status.'});filter.status=req.query.status}
      if(req.query.section){if(!sections.includes(req.query.section))return res.status(400).json({message:'Invalid suggestion section.'});filter.section=req.query.section}
      const total=await Report.countDocuments(filter);
      if(req.query.cursor){if(!mongoose.isValidObjectId(req.query.cursor))return res.status(400).json({message:'Invalid suggestion cursor.'});filter._id={$lt:req.query.cursor}}
      const query=Report.find(filter).sort({_id:-1}).limit(51).select('-__v');if(all)query.populate('user','username email');
      const rows=await query.lean(),items=rows.slice(0,50);
      res.json({items,total,nextCursor:rows.length>50?String(items.at(-1)._id):null,canReview,sections,statuses,priorities,canPublish:canReview&&await roadmapEditor(req.user.userId)});
    }catch{res.status(503).json({message:'Could not load feature suggestions. Please retry.'})}
  });
  app.post('/api/feature-suggestions',auth,async(req,res)=>{
    const body=req.body||{};let data;
    try{
      if(!sections.includes(body.section)||!priorities.includes(body.priority)||typeof body.submissionId!=='string'||!/^[a-f\d-]{36}$/i.test(body.submissionId))throw new Error('Choose a section, priority and valid submission identifier.');
      data={user:req.user.userId,submissionId:body.submissionId,contactEmail:contactEmail(body.contactEmail),section:body.section,priority:body.priority,title:safeText(body,'title',160,true),problem:safeText(body,'problem',6000,true),solution:safeText(body,'solution',4000),benefits:safeText(body,'benefits',2000),workaround:safeText(body,'workaround',2000)};

    }catch(error){return res.status(400).json({message:error.message})}
    try{
      const existing=await Report.findOne({user:req.user.userId,submissionId:data.submissionId});if(existing)return res.json(existing);
      if(await Report.countDocuments({user:req.user.userId,createdAt:{$gte:new Date(Date.now()-3600000)}})>=10)return res.status(429).json({message:'You have submitted 10 suggestions in the past hour. Please wait before adding more.'});
      res.status(201).json(await Report.create(data));
    }catch(error){if(error.code===11000){const existing=await Report.findOne({user:req.user.userId,submissionId:data.submissionId}).catch(()=>null);if(existing)return res.json(existing)}res.status(500).json({message:'Could not save the suggestion. Your draft is preserved; try again.'})}
  });
  app.patch('/api/feature-suggestions/:id',auth,async(req,res)=>{
    try{
      if(!await reviewer(req.user.userId))return res.status(403).json({message:'Only configured reviewers can update suggestion status.'});
      if(!mongoose.isValidObjectId(req.params.id)||!statuses.includes(req.body?.status)||!Number.isInteger(req.body.revision)||req.body.revision<0)return res.status(400).json({message:'Choose a valid suggestion and status.'});
      let response;try{response=safeText(req.body,'response',3000)}catch(error){return res.status(400).json({message:error.message})}
      const item=await Report.findOneAndUpdate({_id:req.params.id,revision:req.body.revision},{$set:{status:req.body.status,response},$inc:{revision:1}},{new:true}).populate('user','username email');if(!item)return res.status(409).json({message:'This suggestion changed or was removed. Refresh and retry.'});res.json(item);
    }catch{res.status(500).json({message:'Could not update this suggestion.'})}
  });
  app.post('/api/feature-suggestions/:id/publish',auth,async(req,res)=>{
    let session;
    try{
      if(!await reviewer(req.user.userId)||!await roadmapEditor(req.user.userId))return res.status(403).json({message:'Publishing requires suggestion review and roadmap editor access.'});
      if(!mongoose.isValidObjectId(req.params.id)||!Number.isInteger(req.body?.revision)||req.body.revision<0)return res.status(400).json({message:'Choose a current suggestion.'});
      let title,description;try{title=safeText(req.body,'title',160,true);description=safeText(req.body,'description',5000,true)}catch(error){return res.status(400).json({message:error.message})}
      if(!['Tasks','Calendar','Documents','AI','Career prep','Platform'].includes(req.body.category)||!['considering','planned','in-progress','shipped'].includes(req.body.status))return res.status(400).json({message:'Choose a valid public category and status.'});
      session=await mongoose.startSession();let item,roadmap;
      await session.withTransaction(async()=>{
        const current=await Report.findOne({_id:req.params.id,revision:req.body.revision}).session(session);
        if(!current)throw new Error('The suggestion changed. Refresh before publishing.');
        if(current.roadmapItem)throw new Error('This suggestion has already been published. Manage its public entry on the site roadmap.');
        [roadmap]=await mongoose.models.SiteRoadmapItem.create([{title,description,category:req.body.category,status:req.body.status,pinned:false,sourceSuggestion:current._id}],{session});
        item=await Report.findOneAndUpdate({_id:current._id,revision:current.revision},{$set:{roadmapItem:roadmap._id,status:req.body.status==='considering'?'reviewing':req.body.status},$inc:{revision:1}},{new:true,session});
        if(!item)throw new Error('The suggestion changed. Refresh before publishing.');
      });
      res.status(201).json({item,roadmapId:roadmap._id});
    }catch(error){res.status(409).json({message:/Transaction numbers|replica set|mongos/i.test(error.message)?'Publishing requires MongoDB Atlas or a replica set. No item was published.':error.code===11000?'This suggestion has already been published.':error.message?.startsWith('The suggestion')||error.message?.startsWith('This suggestion')?error.message:'Could not publish the suggestion. Refresh before retrying.'})}
    finally{if(session)await session.endSession()}
  });

};
