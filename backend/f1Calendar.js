const {calendarEntry,validDay}=require('./calendarEntries');
const SOURCE='https://api.jolpi.ca';
const sessions=[['FirstPractice','Practice 1',60],['SecondPractice','Practice 2',60],['ThirdPractice','Practice 3',60],['SprintQualifying','Sprint qualifying',45],['Sprint','Sprint',45],['Qualifying','Qualifying',60],['Race','Grand Prix',120]];
const cache=new Map();
const pending=new Map();

async function fetchSeason(year){
  const previous=cache.get(year);
  if(previous&&Date.now()-previous.at<15*60000)return previous.value;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  try{
    const response=await fetch(`${SOURCE}/ergast/f1/${year}/races/?limit=100`,{headers:{Accept:'application/json','User-Agent':'AssignmentTracker/1.0'},signal:controller.signal,redirect:'error'});
    if(!response.ok)throw new Error(response.status===429?'The F1 schedule provider is busy. Wait a minute and try again.':'The F1 schedule provider is unavailable. Try again later.');
    const reader=response.body.getReader();let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2000000)throw new Error('The F1 schedule response was too large.');chunks.push(Buffer.from(value))}}finally{await reader.cancel().catch(()=>{})}
    let data;
    try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw new Error('The F1 provider returned an unreadable schedule. Please retry later.')}
    const races=data.MRData?.RaceTable?.Races;
    if(!Array.isArray(races)||races.length>100||Number(data.MRData.total)!==races.length)throw new Error('The provider returned an incomplete F1 season. Please retry later.');
    if(!races.length)throw new Error(`No F1 schedule is available for ${year} yet.`);
    const entries=[],warnings=[];
    for(const race of races){
      if(String(race.season)!==String(year)||!/^\d+$/.test(String(race.round))||typeof race.raceName!=='string'||!race.Circuit?.circuitId)throw new Error('The provider returned an invalid F1 race. No events were imported.');
      for(const [field,label,minutes]of sessions){
        const value=field==='Race'?race:field==='SprintQualifying'?(race.SprintQualifying||race.SprintShootout):race[field];
        if(!value)continue;
        if(!validDay(value.date)){warnings.push(`${race.raceName}: ${label} has no confirmed date and was omitted.`);continue}
        const timed=typeof value.time==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\dZ$/.test(value.time);
        const startAt=timed?`${value.date}T${value.time}`:null;
        const location=[race.Circuit.circuitName,race.Circuit.Location?.locality,race.Circuit.Location?.country].filter(value=>typeof value==='string').join(', ').slice(0,300);
        const title=`F1 ${race.raceName} — ${label}`.slice(0,200);
        const externalId=`f1:${year}:${race.round}:${race.Circuit.circuitId}:${field}`;
        const notes=`Formula 1 ${year} · Round ${race.round} · ${label}\nSource: Jolpica F1 (${SOURCE}/ergast/f1/${year}/races/)\n${timed?`Start time supplied in UTC and displayed in your calendar time zone. End time is an estimated ${minutes}-minute calendar block, not an official finish time.`:'Start time is not confirmed. Added as an all-day date placeholder; check the official schedule before attending.'}\nSchedule changes are not synced automatically. Re-import skips existing sessions; edit existing entries to correct changed times.`;
        const entry=calendarEntry({title,kind:'sports',sports:{sport:'Motorsport',league:'Formula 1',team:'',opponent:''},location,notes,allDay:!timed,...(timed?{startAt,endAt:new Date(Date.parse(startAt)+minutes*60000).toISOString()}:{startDate:value.date,endDate:value.date})});
        entries.push({...entry,externalId,session:field});
      }
    }
    if(!entries.length)throw new Error('No confirmed F1 event dates are available for this season.');
    const value={year,races:races.length,entries,warnings,source:'Jolpica F1',sourceUrl:`https://github.com/jolpica/jolpica-f1/blob/main/docs/endpoints/races.md`,fetchedAt:new Date().toISOString()};
    cache.set(year,{at:Date.now(),value});return value;
  }catch(error){if(controller.signal.aborted)throw new Error('The F1 schedule request timed out. Please retry.');throw error}finally{clearTimeout(timer)}
}

async function seasonSchedule(year){
  if(pending.has(year))return pending.get(year);
  const request=fetchSeason(year);pending.set(year,request);
  try{return await request}finally{pending.delete(year)}
}

module.exports=function registerF1Calendar(app,auth,{CalendarEntry,history}){
  const active=new Set(),limits=new Map();
  const options=req=>{
    const year=Number(req.method==='GET'?req.query.year:req.body.year);
    if(!Number.isInteger(year)||year<1950||year>new Date().getUTCFullYear()+1)throw new Error('Choose a season between 1950 and next year.');
    return year;
  };
  app.get('/api/calendar/sports/f1',auth,async(req,res)=>{
    try{res.set('Cache-Control','no-store').json(await seasonSchedule(options(req)))}catch(error){res.status(422).json({message:error.message||'Could not load the F1 season.'})}
  });
  app.post('/api/calendar/sports/f1/import',auth,async(req,res)=>{
    const user=String(req.user.userId);
    if(active.has(user))return res.status(409).json({message:'An F1 import is already running.'});
    const now=Date.now();for(const [id,at]of limits)if(now-at>10000)limits.delete(id);
    if(limits.has(user))return res.status(429).json({message:'Wait a few seconds before importing again.'});
    active.add(user);limits.set(user,now);
    try{
      const schedule=await seasonSchedule(options(req)),keys=req.body.keys;
      const categoryId=req.body.categoryId||null;
      const categorizeExisting=req.body.categorizeExisting===true;
      if(categoryId&&(typeof categoryId!=='string'||!/^[a-f\d-]{36}$/i.test(categoryId)))throw new Error('Choose a valid calendar category.');
      if(!Array.isArray(keys)||!keys.length||keys.length>700||keys.some(key=>typeof key!=='string'))throw new Error('Select at least one F1 session to import.');
      const selected=new Set(keys),known=new Set(schedule.entries.map(entry=>entry.externalId));
      if([...selected].some(key=>!known.has(key)))throw new Error('The schedule changed. Reload the preview and select events again.');
      const prior=await CalendarEntry.find({user,externalId:{$in:[...selected]}}).select('categoryId').lean();
      if(prior.length===selected.size&&(!categorizeExisting||prior.every(entry=>(entry.categoryId||null)===categoryId)))return res.json({entries:[],added:0,updated:0,skipped:prior.length,year:schedule.year});
      const result=await history.mutate(user,`import F1 ${schedule.year} season`,async session=>{
        const existing=await CalendarEntry.find({user,externalId:{$in:[...selected]}}).session(session).lean();
        const saved=new Set(existing.map(entry=>entry.externalId));
        const fresh=schedule.entries.filter(entry=>selected.has(entry.externalId)&&!saved.has(entry.externalId)).map(({session:sessionName,...entry})=>({...entry,user,categoryId}));
        const created=fresh.length?await CalendarEntry.insertMany(fresh,{session}):[];
        const before=categorizeExisting?existing.filter(entry=>(entry.categoryId||null)!==categoryId):[];
        if(before.length)await CalendarEntry.updateMany({_id:{$in:before.map(entry=>entry._id)},user},{$set:{categoryId}},{session});
        const updated=before.length?await CalendarEntry.find({_id:{$in:before.map(entry=>entry._id)},user}).session(session).lean():[];
        const after=[...created.map(entry=>entry.toObject()),...updated];
        return {value:{entries:after,added:created.length,updated:updated.length,skipped:saved.size-updated.length,year:schedule.year},kind:'calendar_import',before,after};
      });
      res.status(201).json(result);
    }catch(error){res.status(422).json({message:error.message||'Could not import the F1 season. No partial import was saved.'})}finally{active.delete(user)}
  });
};
