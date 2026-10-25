const {randomUUID}=require('node:crypto');
const {calendarEntry}=require('./calendarEntries');
function registerCalendarSeries(app,auth,{CalendarEntry,history,linksOwned}){
  const links=entries=>Object.fromEntries(['taskIds','documentIds'].map(key=>[key,[...new Set(entries.flatMap(entry=>(entry[key]||[]).map(String)))]]));
  app.post('/api/calendar-series',auth,async(req,res)=>{
    let entries,rule;
    try{
      if(!Array.isArray(req.body.entries)||req.body.entries.length<2||req.body.entries.length>500)throw new Error('Create between 2 and 500 meetings.');
      entries=req.body.entries.map(calendarEntry);
      const supplied=req.body.rule;
      if(!supplied||!['minutes','hours','days','weeks','months'].includes(supplied.unit)||!Number.isInteger(supplied.interval)||supplied.interval<1||supplied.interval>365)throw new Error('Choose a valid repeat schedule.');
      if(typeof supplied.timeZone!=='string'||supplied.timeZone.length>100)throw new Error('Choose a valid time zone.');
      new Intl.DateTimeFormat('en',{timeZone:supplied.timeZone});
      rule={unit:supplied.unit,interval:supplied.interval,timeZone:supplied.timeZone,count:entries.length,weekdays:Array.isArray(supplied.weekdays)?supplied.weekdays.filter(day=>Number.isInteger(day)&&day>=0&&day<=6).slice(0,7):[]};
    }catch(error){return res.status(400).json({message:error.message});}
    try{
      const combined=links(entries);
      if(Object.values(combined).some(ids=>ids.length>100)||!await linksOwned(combined,req.user.userId))return res.status(400).json({message:'Choose up to 100 linked tasks and documents from your account.'});
      const seriesId=randomUUID();
      const result=await history.mutate(req.user.userId,'create recurring meetings',async session=>{
        const created=await CalendarEntry.insertMany(entries.map(entry=>({...entry,user:req.user.userId,seriesId,seriesRule:rule})),{session});
        return {value:{entries:created,seriesId},kind:'series',seriesId,before:[],after:created.map(entry=>entry.toObject())};
      });
      res.status(201).json(result);
    }catch{res.status(500).json({message:'Could not create the recurring meetings. No partial series was saved.'});}
  });
  app.put('/api/calendar-series/:id',auth,async(req,res)=>{
    if(!/^[a-f\d-]{36}$/i.test(req.params.id))return res.status(400).json({message:'Invalid meeting series.'});
    try{
      const first=await CalendarEntry.findOne({seriesId:req.params.id,user:req.user.userId}).lean();
      if(!first)return res.status(404).json({message:'Meeting series not found.'});
      let fields;
      try{
        const allowed=Object.fromEntries(['title','notes','location','taskIds','documentIds','sports'].filter(key=>req.body[key]!==undefined).map(key=>[key,req.body[key]]));
        const validated=calendarEntry({...first,taskIds:(first.taskIds||[]).map(String),documentIds:(first.documentIds||[]).map(String),startAt:first.startAt?.toISOString(),endAt:first.endAt?.toISOString(),...allowed});
        fields=Object.fromEntries(Object.keys(allowed).map(key=>[key,validated[key]]));
      }catch(error){return res.status(400).json({message:error.message});}
      if(!await linksOwned(fields,req.user.userId,first))return res.status(400).json({message:'Choose task and document links from your account.'});
      const result=await history.mutate(req.user.userId,'edit recurring meeting details',async session=>{
        const filter={seriesId:req.params.id,user:req.user.userId},before=await CalendarEntry.find(filter).session(session).lean();
        if(!before.length)throw new Error('Series removed.');
        await CalendarEntry.updateMany(filter,{$set:fields},{session,runValidators:true});
        const after=await CalendarEntry.find(filter).session(session).lean();
        return {value:{entries:after,seriesId:req.params.id},kind:'series',seriesId:req.params.id,before,after};
      });
      res.json(result);
    }catch{res.status(500).json({message:'Could not update the meeting series.'});}
  });
  app.delete('/api/calendar-series/:id',auth,async(req,res)=>{
    if(!/^[a-f\d-]{36}$/i.test(req.params.id))return res.status(400).json({message:'Invalid meeting series.'});
    try{
      const result=await history.mutate(req.user.userId,'delete recurring meeting series',async session=>{
        const filter={seriesId:req.params.id,user:req.user.userId},before=await CalendarEntry.find(filter).session(session).lean();
        if(!before.length)throw new Error('Meeting series not found.');
        await CalendarEntry.deleteMany(filter,{session});
        return {value:{removed:before.length},kind:'series',seriesId:req.params.id,before,after:[]};
      });
      res.json(result);
    }catch(error){res.status(409).json({message:error.message||'Could not delete the series.'});}
  });
}
module.exports={registerCalendarSeries};
