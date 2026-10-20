function registerCalendarColors(app,auth,{User,Todo,CalendarEntry,history}){
  app.get('/api/calendar/colors',auth,async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{
      const user=await User.findById(req.user.userId).select('calendarColors').lean();
      if(!user)return res.status(404).json({message:'Account not found.'});
      res.json({colors:user.calendarColors||{}});
    }catch{res.status(500).json({message:'Could not load calendar colors.'});}
  });
  app.put('/api/calendar/colors',auth,async(req,res)=>{
    const {id,color}=req.body||{};
    if(typeof id!=='string'||!/^(?:txst:[\w-]{1,100}|(?:task|entry):[a-f\d]{24})$/.test(id))return res.status(400).json({message:'Choose a valid calendar item.'});
    if(color!==null&&(typeof color!=='string'||!/^#[a-f\d]{6}$/i.test(color)))return res.status(400).json({message:'Choose a valid color.'});
    try{
      const [kind,recordId]=id.split(':');
      if(kind!=='txst'&&!await(kind==='entry'?CalendarEntry:Todo).exists({_id:recordId,user:req.user.userId}))return res.status(404).json({message:'Calendar item not found.'});
      const saved=await history.mutate(req.user.userId,'change event color',async session=>{
        const user=await User.findById(req.user.userId).select('calendarColors').session(session).lean();
        const previous=user.calendarColors?.[id]||null;
        if(!previous&&color&&Object.keys(user.calendarColors||{}).length>=10000)throw new Error('Too many custom calendar colors. Reset an unused color first.');
        const next=color?.toLowerCase()||null,key=`calendarColors.${id}`;
        await User.updateOne({_id:req.user.userId},next?{$set:{[key]:next}}:{$unset:{[key]:1}},{session});
        return {value:{id,color:next},kind:'color',before:{id,color:previous},after:{id,color:next}};
      });
      res.json(saved);
    }catch(error){res.status(500).json({message:error.message?.startsWith('Too many')?error.message:'Could not save the calendar color.'});}
  });
}
module.exports={registerCalendarColors};
