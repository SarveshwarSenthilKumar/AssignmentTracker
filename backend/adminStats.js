const access=require('./adminAccess');

const collections={Todo:'Tasks & Canvas events',PDF:'Documents',CalendarEntry:'Calendar entries',AssistantConversation:'AI conversations',StudyItem:'Study items',SavedJob:'Saved jobs',ResumeDraft:'Resume drafts',CoverLetterDraft:'Cover-letter drafts',EventAttendance:'Attendance records',BugReport:'Bug reports',FeatureSuggestion:'Feature suggestions',Folder:'Task folders',PDFFolder:'Document folders',TaskDeletionRecovery:'Task recovery',CalendarChange:'Calendar history',DocumentSearchIndex:'Search indexes'};
const sumIf=condition=>({$sum:{$cond:[condition,1,0]}});
const countRows=rows=>rows?.[0]?.count||0;

module.exports=(app,auth,mongoose)=>{
  app.get('/api/admin/stats',auth,async(req,res)=>{
    res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'});
    try{
      if(!(await access(mongoose,req.user.userId)).stats)return res.status(403).json({message:'Advanced statistics are available only to configured full administrators.'});
      const days=Number(req.query.days??30);
      if(![7,30,90].includes(days))return res.status(400).json({message:'Choose a 7, 30 or 90 day window.'});
      const now=new Date(),since=new Date(now);since.setUTCHours(0,0,0,0);since.setUTCDate(since.getUTCDate()-days+1);
      const until=new Date(now);until.setUTCHours(0,0,0,0);until.setUTCDate(until.getUTCDate()+1);
      const window={createdAt:{$gte:since,$lt:until}};
      const daily=[{$match:window},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt',timezone:'UTC'}},count:{$sum:1}}},{$sort:{_id:1}}];
      const run=(name,pipeline)=>mongoose.models[name].aggregate(pipeline).option({maxTimeMS:15000});
      const entries=Object.entries(collections).filter(([name])=>mongoose.models[name]);
      const [accounts,records]=await Promise.all([
        run('User',[{$facet:{
          totals:[{$group:{_id:null,count:{$sum:1},bytes:{$sum:{$bsonSize:'$$ROOT'}},canvas:sumIf({$ne:[{$ifNull:['$canvasUrl',null]},null]}),personalAIKey:sumIf({$ne:[{$ifNull:['$geminiApiKeyEncrypted',null]},null]}),aiEnabled:sumIf({$ne:[{$ifNull:['$aiAccess.enabled',true]},false]}),appOnly:sumIf({$ne:[{$ifNull:['$aiAccess.appOnly',true]},false]})}}],
          signups:daily
        }}]),
        Promise.all(entries.map(async([name,label])=>{
          const facets={totals:[{$group:{_id:null,count:{$sum:1},bytes:{$sum:{$bsonSize:'$$ROOT'}}}}],daily};
          if(name==='Todo')facets.statuses=[{$match:{canvasType:{$ne:'calendar_event'}}},{$group:{_id:'$status',count:{$sum:1}}}];
          if(name==='Todo')facets.completed=[{$match:{canvasType:{$ne:'calendar_event'},status:'completed',completedAt:{$gte:since,$lt:until}}},{$count:'count'}];
          if(name==='PDF')facets.storage=[{$group:{_id:{$cond:[{$ne:[{$ifNull:['$deletedAt',null]},null]},'trash','active']},count:{$sum:1},bytes:{$sum:{$bsonSize:'$$ROOT'}}}}];
          if(name==='AssistantConversation'){
            facets.messages=[{$unwind:'$messages'},{$match:{'messages.createdAt':{$gte:since,$lt:until}}},{$group:{_id:'$messages.role',count:{$sum:1},failed:sumIf({$eq:['$messages.failed',true]}),partial:sumIf({$eq:['$messages.partial',true]})}}];
            facets.contributors=[{$match:{'messages.createdAt':{$gte:since,$lt:until}}},{$group:{_id:'$user'}},{$count:'count'}];
          }
          const [data]=await run(name,[{$facet:facets}]);
          return {name,label,count:data.totals[0]?.count||0,bytes:data.totals[0]?.bytes||0,daily:data.daily,...(data.statuses?{statuses:data.statuses,completed:countRows(data.completed)}:{}),...(data.storage?{storage:data.storage}:{}),...(data.messages?{messages:data.messages,contributors:countRows(data.contributors)}:{})};
        }))
      ]);
      // Aggregate unique creators inside MongoDB; no account IDs leave this query.
      const activityNames=['Todo','PDF','CalendarEntry','AssistantConversation','StudyItem','SavedJob','ResumeDraft','CoverLetterDraft','EventAttendance','BugReport','FeatureSuggestion'].filter(name=>mongoose.models[name]);
      const activityPipeline=[{$match:window},{$project:{_id:0,user:1}},...activityNames.slice(1).map(name=>({$unionWith:{coll:mongoose.models[name].collection.name,pipeline:[{$match:window},{$project:{_id:0,user:1}}]}})),{$match:{user:{$ne:null}}},{$group:{_id:'$user'}},{$count:'count'}];
      const creators=activityNames.length?countRows(await run(activityNames[0],activityPipeline)):0;
      const profile=accounts[0]?.totals[0]||{};
      delete profile._id;
      res.json({generatedAt:now.toISOString(),days,timeZone:'UTC',since:since.toISOString(),accounts:profile,signups:accounts[0]?.signups||[],creators,collections:records,totalBytes:(profile.bytes||0)+records.reduce((sum,item)=>sum+item.bytes,0)});
    }catch{res.status(503).json({message:'Could not calculate advanced statistics. Retry later and confirm MongoDB supports $bsonSize and $unionWith.'});}
  });
};
