module.exports=function registerDetectiveWalls(app,auth,{mongoose}){
  const Wall=mongoose.models.DetectiveWall||mongoose.model('DetectiveWall',new mongoose.Schema({
    user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
    name:{type:String,required:true,maxLength:120},
    state:{type:mongoose.Schema.Types.Mixed,default:()=>({nodes:[],strings:[]})},
    revision:{type:Number,default:0}
  },{timestamps:true}));
  const validId=id=>typeof id==='string'&&mongoose.isValidObjectId(id);
  const color=value=>typeof value==='string'&&/^#[a-f\d]{6}$/i.test(value);
  const number=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max;
  function clean(state){
    if(!state||!Array.isArray(state.nodes)||!Array.isArray(state.strings)||state.nodes.length>200||state.strings.length>500)throw new Error('Use up to 200 items and 500 strings per wall.');
    if(Buffer.byteLength(JSON.stringify(state))>10*1024*1024)throw new Error('This wall exceeds 10 MB. Use smaller photos or another wall.');
    const ids=new Set(),key=value=>typeof value==='string'&&/^[a-z\d_-]{1,80}$/i.test(value);
    const nodes=state.nodes.map(node=>{
      if(!node||!key(node.id)||ids.has(node.id)||!['note','photo','pin'].includes(node.type)||!number(node.x,0,12000)||!number(node.y,0,100000)||!number(node.width,60,6000)||!number(node.height,60,100000)||!number(node.rotation,-30,30)||!color(node.color)||typeof node.text!=='string'||node.text.length>3000)throw new Error('An item has invalid content or dimensions.');
      ids.add(node.id);
      const item={id:node.id,type:node.type,x:node.x,y:node.y,width:node.width,height:node.height,rotation:node.rotation,color:node.color,text:node.text};
      if(node.paperStyle!==undefined){if(!['sticky','paper','receipt','index','torn','photo'].includes(node.paperStyle))throw new Error('Invalid paper style.');item.paperStyle=node.paperStyle;}
      if(node.fontSize!==undefined){if(!number(node.fontSize,8,96))throw new Error('Invalid text size.');item.fontSize=node.fontSize;}
      if(node.type==='photo'){
        if(node.imageHeight!==undefined){if(!number(node.imageHeight,80,6000))throw new Error('Invalid photo height.');item.imageHeight=node.imageHeight;}
        if(typeof node.image!=='string'||node.image.length>2800000||!/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(node.image))throw new Error('Photos must be PNG, JPEG or WebP images smaller than 2 MB.');
        item.image=node.image;
      }
      return item;
    });
    const edges=new Set();
    const strings=state.strings.map(edge=>{
      if(!number(edge?.width??6,1,24))throw new Error('Choose a string thickness between 1 and 24.');
      if(!edge||!key(edge.id)||edges.has(edge.id)||!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to||!color(edge.color)||typeof edge.text!=='string'||edge.text.length>160)throw new Error('A string has invalid endpoints or content.');
      if(edge.slack!==undefined&&!number(edge.slack,-250,450))throw new Error('Invalid string curve.');
      if(edge.fontSize!==undefined&&!number(edge.fontSize,8,96))throw new Error('Invalid string label size.');
      edges.add(edge.id);return {id:edge.id,from:edge.from,to:edge.to,color:edge.color,text:edge.text,width:edge.width??6,...(edge.slack!==undefined?{slack:edge.slack}:{}),...(edge.fontSize!==undefined?{fontSize:edge.fontSize}:{})};
    });
    return {nodes,strings};
  }
  app.get('/api/detective-walls',auth,async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    try{res.json(await Wall.find({user:req.user.userId}).select('name revision createdAt updatedAt').sort({updatedAt:-1}).lean())}catch{res.status(503).json({message:'Could not load your walls.'})}
  });
  app.post('/api/detective-walls',auth,async(req,res)=>{
    const name=req.body?.name;
    if(typeof name!=='string'||!name.trim()||name.trim().length>120)return res.status(400).json({message:'Enter a wall name up to 120 characters.'});
    let state
    if(req.body.state!==undefined){try{state=clean(req.body.state)}catch(error){return res.status(400).json({message:error.message})}}
    try{res.status(201).json(await Wall.create({user:req.user.userId,name:name.trim(),...(state?{state}:{})}))}catch{res.status(503).json({message:'Could not create the wall.'})}
  });
  app.get('/api/detective-walls/:id',auth,async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    if(!validId(req.params.id))return res.sendStatus(404);
    try{const wall=await Wall.findOne({_id:req.params.id,user:req.user.userId}).lean();if(!wall)return res.status(404).json({message:'This wall is unavailable.'});res.json(wall)}catch{res.status(503).json({message:'Could not open the wall.'})}
  });
  app.put('/api/detective-walls/:id',auth,async(req,res)=>{
    if(!validId(req.params.id))return res.sendStatus(404);
    const {name,revision,state}=req.body||{};
    if(typeof name!=='string'||!name.trim()||name.trim().length>120||!Number.isSafeInteger(revision)||revision<0)return res.status(400).json({message:'Invalid wall name or revision.'});
    let cleaned;try{cleaned=clean(state)}catch(error){return res.status(400).json({message:error.message})}
    try{
      const wall=await Wall.findOneAndUpdate({_id:req.params.id,user:req.user.userId,revision},{$set:{name:name.trim(),state:cleaned},$inc:{revision:1}},{new:true}).select('revision updatedAt').lean();
      if(!wall)return res.status(409).json({message:'This wall changed in another tab or was removed. Your unsaved work is still open; export a backup before reloading.'});
      res.json(wall);
    }catch{res.status(503).json({message:'Could not save the wall. Your work is still open; retry saving.'})}
  });
  app.delete('/api/detective-walls/:id',auth,async(req,res)=>{
    if(!validId(req.params.id))return res.sendStatus(404);
    try{const result=await Wall.deleteOne({_id:req.params.id,user:req.user.userId});if(!result.deletedCount)return res.status(404).json({message:'This wall is unavailable.'});res.json({deleted:true})}catch{res.status(503).json({message:'Could not delete the wall.'})}
  });
  return Wall;
};
