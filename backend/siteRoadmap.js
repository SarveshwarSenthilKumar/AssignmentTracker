module.exports=(app,auth,mongoose)=>{
  const statuses=['considering','planned','in-progress','shipped'],categories=['Tasks','Calendar','Documents','AI','Career prep','Platform'];
  const schema=new mongoose.Schema({sourceSuggestion:{type:mongoose.Schema.Types.ObjectId,ref:'FeatureSuggestion'},title:{type:String,required:true,maxlength:160},description:{type:String,required:true,maxlength:5000},status:{type:String,enum:statuses,default:'considering'},category:{type:String,enum:categories,default:'Platform'},pinned:{type:Boolean,default:false},revision:{type:Number,default:0}},{timestamps:true});
  schema.index({sourceSuggestion:1},{unique:true,partialFilterExpression:{sourceSuggestion:{$type:'objectId'}}});
  const Item=mongoose.models.SiteRoadmapItem||mongoose.model('SiteRoadmapItem',schema);
  const isEditor=async userId=>{
    const allowed=(process.env.SITE_ROADMAP_EDITOR_EMAILS||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
    if(!allowed.length)return false;
    const user=await mongoose.models.User.findById(userId).select('email').lean();
    return !!user&&allowed.includes(user.email.toLowerCase());
  };
  const editor=async(req,res,next)=>{try{if(!await isEditor(req.user.userId))return res.status(403).json({message:'Only configured roadmap editors can change this public board.'});next()}catch{res.status(503).json({message:'Could not verify roadmap editor access.'})}};
  const fields=body=>{
    if(typeof body?.title!=='string'||!body.title.trim()||body.title.length>160||typeof body.description!=='string'||!body.description.trim()||body.description.length>5000)throw new Error('Enter a title up to 160 characters and a description up to 5,000 characters.');
    if(!statuses.includes(body.status)||!categories.includes(body.category)||typeof body.pinned!=='boolean')throw new Error('Choose valid status, category and featured settings.');
    return {title:body.title.trim(),description:body.description.trim(),status:body.status,category:body.category,pinned:body.pinned};
  };
  app.get('/api/site-roadmap',async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{res.json({items:await Item.find().select('-__v -sourceSuggestion').sort({pinned:-1,updatedAt:-1,_id:1}).limit(500).lean(),statuses,categories})}catch{res.status(503).json({message:'The roadmap is unavailable. Please try again later.'})}
  });
  app.get('/api/site-roadmap/access',auth,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json({canEdit:await isEditor(req.user.userId)})}catch{res.status(503).json({message:'Could not check roadmap access.'})}});
  app.post('/api/site-roadmap',auth,editor,async(req,res)=>{
    let data;try{data=fields(req.body)}catch(error){return res.status(400).json({message:error.message})}
    try{res.status(201).json(await Item.create(data))}catch{res.status(500).json({message:'Could not publish this roadmap item.'})}
  });
  app.put('/api/site-roadmap/:id',auth,editor,async(req,res)=>{
    if(!mongoose.isValidObjectId(req.params.id)||!Number.isInteger(req.body?.revision)||req.body.revision<0)return res.status(400).json({message:'Choose a current roadmap item.'});
    let data;try{data=fields(req.body)}catch(error){return res.status(400).json({message:error.message})}
    try{const item=await Item.findOneAndUpdate({_id:req.params.id,revision:req.body.revision},{$set:data,$inc:{revision:1}},{new:true});if(!item)return res.status(409).json({message:'This item changed or was removed. Refresh the board before editing again.'});res.json(item)}catch{res.status(500).json({message:'Could not update this roadmap item.'})}
  });
  app.delete('/api/site-roadmap/:id',auth,editor,async(req,res)=>{
    if(!mongoose.isValidObjectId(req.params.id)||!Number.isInteger(req.body?.revision)||req.body.revision<0)return res.status(400).json({message:'Choose a current roadmap item.'});
    try{const item=await Item.findOneAndDelete({_id:req.params.id,revision:req.body.revision});if(!item)return res.status(409).json({message:'This item changed or was removed. Refresh before deleting.'});res.json({deleted:true})}catch{res.status(500).json({message:'Could not remove this roadmap item.'})}
  });
};
