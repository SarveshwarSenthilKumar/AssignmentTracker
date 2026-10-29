module.exports=(app,auth,mongoose)=>{
  const sections=['Home','Tasks','Calendar','Documents','PDF editor','Notes','AI assistant','Study phone','Workspace','Visualization','Career prep','Resumes','Cover letters','Saved jobs','Study stars','Analytics','Account','Site roadmap','Feature suggestions','Bug reports','Miscellaneous'];
  const statuses=['open','in-review','fixed','closed'],severities=['minor','normal','major','blocking'];
  const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},submissionId:{type:String,required:true},section:{type:String,enum:sections},severity:{type:String,enum:severities},title:String,description:String,steps:String,expected:String,actual:String,diagnostics:mongoose.Schema.Types.Mixed,status:{type:String,enum:statuses,default:'open'},response:{type:String,default:''},revision:{type:Number,default:0}},{timestamps:true});
  schema.index({user:1,submissionId:1},{unique:true});schema.index({user:1,createdAt:-1});
  const Report=mongoose.models.BugReport||mongoose.model('BugReport',schema);
  const reviewer=async id=>{const emails=(process.env.BUG_REPORT_EDITOR_EMAILS||process.env.SITE_ROADMAP_EDITOR_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);if(!emails.length)return false;const user=await mongoose.models.User.findById(id).select('email').lean();return !!user&&emails.includes(user.email.toLowerCase())};
  const safeText=(body,key,max,required=false)=>{const value=body[key]??'';if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw new Error(`Enter valid ${key} (${required?'required, ':''}up to ${max} characters).`);return value.trim()};
  app.get('/api/bug-reports',auth,async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{
      const canReview=await reviewer(req.user.userId),all=req.query.scope==='all';if(all&&!canReview)return res.status(403).json({message:'Only configured reviewers can view other users’ reports.'});
      const filter=all?{}:{user:req.user.userId};
      if(req.query.status){if(!statuses.includes(req.query.status))return res.status(400).json({message:'Invalid report status.'});filter.status=req.query.status}
      if(req.query.section){if(!sections.includes(req.query.section))return res.status(400).json({message:'Invalid report section.'});filter.section=req.query.section}
      const total=await Report.countDocuments(filter);
      if(req.query.cursor){if(!mongoose.isValidObjectId(req.query.cursor))return res.status(400).json({message:'Invalid report cursor.'});filter._id={$lt:req.query.cursor}}
      const query=Report.find(filter).sort({_id:-1}).limit(51).select('-__v');if(all)query.populate('user','username email');
      const rows=await query.lean(),items=rows.slice(0,50);
      res.json({items,total,nextCursor:rows.length>50?String(items.at(-1)._id):null,canReview,sections,statuses,severities});
    }catch{res.status(503).json({message:'Could not load bug reports. Please retry.'})}
  });
  app.post('/api/bug-reports',auth,async(req,res)=>{
    const body=req.body||{};let data;
    try{
      if(!sections.includes(body.section)||!severities.includes(body.severity)||typeof body.submissionId!=='string'||!/^[a-f\d-]{36}$/i.test(body.submissionId))throw new Error('Choose a section, severity and valid submission identifier.');
      data={user:req.user.userId,submissionId:body.submissionId,section:body.section,severity:body.severity,title:safeText(body,'title',160,true),description:safeText(body,'description',6000,true),steps:safeText(body,'steps',4000),expected:safeText(body,'expected',2000),actual:safeText(body,'actual',2000)};
      if(body.diagnostics){const d=body.diagnostics;if(typeof d!=='object'||Array.isArray(d))throw new Error('Invalid diagnostics.');data.diagnostics={browser:safeText(d,'browser',500),language:safeText(d,'language',40),viewport:safeText(d,'viewport',40)}}
    }catch(error){return res.status(400).json({message:error.message})}
    try{
      const existing=await Report.findOne({user:req.user.userId,submissionId:data.submissionId});if(existing)return res.json(existing);
      if(await Report.countDocuments({user:req.user.userId,createdAt:{$gte:new Date(Date.now()-3600000)}})>=10)return res.status(429).json({message:'You have submitted 10 reports in the past hour. Please wait before adding more.'});
      res.status(201).json(await Report.create(data));
    }catch(error){if(error.code===11000){const existing=await Report.findOne({user:req.user.userId,submissionId:data.submissionId}).catch(()=>null);if(existing)return res.json(existing)}res.status(500).json({message:'Could not save the report. Your draft is preserved; try again.'})}
  });
  app.patch('/api/bug-reports/:id',auth,async(req,res)=>{
    try{
      if(!await reviewer(req.user.userId))return res.status(403).json({message:'Only configured reviewers can update report status.'});
      if(!mongoose.isValidObjectId(req.params.id)||!statuses.includes(req.body?.status)||!Number.isInteger(req.body.revision)||req.body.revision<0)return res.status(400).json({message:'Choose a valid report and status.'});
      let response;try{response=safeText(req.body,'response',3000)}catch(error){return res.status(400).json({message:error.message})}
      const item=await Report.findOneAndUpdate({_id:req.params.id,revision:req.body.revision},{$set:{status:req.body.status,response},$inc:{revision:1}},{new:true}).populate('user','username email');if(!item)return res.status(409).json({message:'This report changed or was removed. Refresh and retry.'});res.json(item);
    }catch{res.status(500).json({message:'Could not update this report.'})}
  });
};
