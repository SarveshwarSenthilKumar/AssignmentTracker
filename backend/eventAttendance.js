module.exports=(app,auth,mongoose)=>{
  const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},title:String,date:String,location:String,notes:String,sourceId:String},{timestamps:true});
  schema.index({user:1,sourceId:1},{unique:true,partialFilterExpression:{sourceId:{$type:'string'}}});
  const Attendance=mongoose.models.EventAttendance||mongoose.model('EventAttendance',schema);
  const valid=body=>{
    if(!body||typeof body.title!=='string'||!body.title.trim()||body.title.length>200)throw new Error('Enter an event name up to 200 characters.');
    if(typeof body.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(body.date)||!Number.isFinite(Date.parse(body.date+'T12:00:00Z'))||new Date(body.date+'T12:00:00Z').toISOString().slice(0,10)!==body.date)throw new Error('Choose a valid attendance date.');
    for(const [key,max]of [['location',300],['notes',6000],['sourceId',300]])if(body[key]!==undefined&&(typeof body[key]!=='string'||body[key].length>max))throw new Error('Event details are too long or invalid.');
    return {title:body.title.trim(),date:body.date,location:body.location?.trim()||'',notes:body.notes?.trim()||''};
  };
  app.get('/api/event-attendance',auth,async(req,res)=>{res.set('Cache-Control','no-store');try{res.json(await Attendance.find({user:req.user.userId}).sort({date:-1,createdAt:-1}).lean())}catch{res.status(500).json({message:'Could not load your attended events.'})}});
  app.post('/api/event-attendance',auth,async(req,res)=>{try{const data=valid(req.body);res.status(201).json(await Attendance.create({...data,user:req.user.userId,...(req.body.sourceId?.trim()?{sourceId:req.body.sourceId.trim()}:{})}))}catch(error){res.status(error.code===11000?409:error.name==='Error'?400:500).json({message:error.code===11000?'This calendar event is already in your attendance log.':error.name==='Error'?error.message:'Could not save attendance.'})}});
  app.put('/api/event-attendance/:id',auth,async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:'Choose a valid attendance record.'});let data;try{data=valid(req.body)}catch(error){return res.status(400).json({message:error.message})}try{const item=await Attendance.findOneAndUpdate({_id:req.params.id,user:req.user.userId},{$set:data},{new:true});if(!item)return res.status(404).json({message:'Attendance record not found.'});res.json(item)}catch{res.status(500).json({message:'Could not update attendance.'})}});
  app.delete('/api/event-attendance/:id',auth,async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:'Choose a valid attendance record.'});try{const item=await Attendance.findOneAndDelete({_id:req.params.id,user:req.user.userId});if(!item)return res.status(404).json({message:'Attendance record not found.'});res.json({deleted:true})}catch{res.status(500).json({message:'Could not delete attendance.'})}});
};
