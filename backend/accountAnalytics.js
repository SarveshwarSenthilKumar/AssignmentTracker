module.exports=(app,auth,mongoose)=>{
  const collections={Todo:'Tasks & Canvas events',Folder:'Task folders',PDF:'Documents',PDFFolder:'Document folders',CalendarEntry:'Calendar entries',AssistantConversation:'AI conversations',StudyItem:'Study stars',SavedJob:'Saved jobs',EventAttendance:'Attended events',ResumeDraft:'Resume drafts',CoverLetterDraft:'Cover-letter drafts',TaskDeletionRecovery:'Task recovery',CalendarChange:'Calendar history',DocumentSearchIndex:'Search indexes'};
  app.get('/api/account/analytics',auth,async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{
      const owner={user:new mongoose.Types.ObjectId(req.user.userId)},now=new Date();
      const profile=await mongoose.models.User.findById(owner.user).select('timeZone createdAt').lean();
      if(!profile)return res.status(404).json({message:'Account not found.'});
      const zone=profile.timeZone||'UTC',day=date=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
      const today=day(now),weekEnd=day(new Date(now.getTime()+7*86400000)),since=new Date(now.getTime()-90*86400000);
      const daily=[{$match:{createdAt:{$gte:since}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt',timezone:zone}},count:{$sum:1}}},{$sort:{_id:1}}];
      const totals=[{$group:{_id:null,count:{$sum:1},bytes:{$sum:{$bsonSize:'$$ROOT'}}}}];
      const dateOnly={$and:[{$eq:['$calendarAllDay',true]},{$ne:[{$ifNull:['$calendarDate',null]},null]}]};
      const dueDay={$cond:[dateOnly,'$calendarDate',{$dateToString:{format:'%Y-%m-%d',date:'$dueDate',timezone:zone,onNull:''}}]};
      const taskFacet={statuses:[{$match:{canvasType:{$ne:'calendar_event'}}},{$group:{_id:'$status',count:{$sum:1}}}],deadlines:[{$match:{canvasType:{$ne:'calendar_event'},status:{$ne:'completed'}}},{$group:{_id:null,undated:{$sum:{$cond:[{$eq:[{$ifNull:['$dueDate',null]},null]},1,0]}},overdue:{$sum:{$cond:[{$and:[{$ne:[{$ifNull:['$dueDate',null]},null]},{$cond:[dateOnly,{$lt:['$calendarDate',today]},{$lt:['$dueDate',now]}]}]},1,0]}},dueToday:{$sum:{$cond:[{$eq:[dueDay,today]},1,0]}},dueSoon:{$sum:{$cond:[{$and:[{$gte:[dueDay,today]},{$lte:[dueDay,weekEnd]}]},1,0]}}}}],completedDaily:[{$match:{status:'completed',completedAt:{$gte:since},canvasType:{$ne:'calendar_event'}}},{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$completedAt',timezone:zone}},count:{$sum:1}}},{$sort:{_id:1}}],folders:[{$match:{canvasType:{$ne:'calendar_event'}}},{$group:{_id:'$folder',count:{$sum:1},completed:{$sum:{$cond:[{$eq:['$status','completed']},1,0]}}}}]};
      const binarySize=field=>({$cond:[{$eq:[{$type:field},'binData']},{$binarySize:field},0]});
      const fileFacet={storage:[{$group:{_id:{$cond:[{$ne:[{$ifNull:['$deletedAt',null]},null]},'trash','active']},count:{$sum:1},bytes:{$sum:{$bsonSize:'$$ROOT'}},fileBytes:{$sum:binarySize('$pdfData')},backupBytes:{$sum:binarySize('$originalBackup')},annotations:{$sum:{$cond:[{$isArray:'$annotations'},{$size:'$annotations'},0]}}}}],types:[{$match:{deletedAt:null}},{$group:{_id:{$toLower:{$arrayElemAt:[{$split:[{$ifNull:['$originalName','unknown']},'.']},-1]}},count:{$sum:1},bytes:{$sum:binarySize('$pdfData')}}},{$sort:{bytes:-1}}],largest:[{$project:{name:1,originalName:1,deletedAt:1,bytes:{$bsonSize:'$$ROOT'},fileBytes:binarySize('$pdfData'),backupBytes:binarySize('$originalBackup')}},{$sort:{bytes:-1}},{$limit:10}],folders:[{$match:{deletedAt:null}},{$group:{_id:'$pdfFolder',count:{$sum:1},bytes:{$sum:binarySize('$pdfData')}}}],tags:[{$match:{deletedAt:null}},{$unwind:'$tags'},{$group:{_id:'$tags',count:{$sum:1}}},{$sort:{count:-1}},{$limit:15}]};
      const results=await Promise.all(Object.entries(collections).filter(([name])=>mongoose.models[name]).map(async([name,label])=>{
        const facets={totals,daily,...(name==='Todo'?taskFacet:{}),...(name==='PDF'?fileFacet:{})};
        const [data]=await mongoose.models[name].aggregate([{$match:owner},{$facet:facets}]).option({maxTimeMS:20000});
        return {name,label,...data};
      }));
      const [profileSize]=await mongoose.models.User.aggregate([{$match:{_id:owner.user}},{$project:{_id:0,bytes:{$bsonSize:'$$ROOT'}}}]).option({maxTimeMS:5000});
      const byName=Object.fromEntries(results.map(value=>[value.name,value]));
      const [taskFolders,documentFolders]=await Promise.all([mongoose.models.Folder.find(owner).select('name parent').lean(),mongoose.models.PDFFolder.find(owner).select('name parent').lean()]);
      res.json({generatedAt:now.toISOString(),timeZone:zone,storageBasis:'Logical BSON bytes for account-owned database records, including trash, backups, drafts, indexes and recovery/history records. Excludes database indexes, compression/replication overhead, shared caches, browser/desktop local storage, network traffic and provider token usage. Collections are sampled independently, not as a transactional snapshot.',profileBytes:profileSize?.bytes||0,totalBytes:(profileSize?.bytes||0)+results.reduce((sum,value)=>sum+(value.totals[0]?.bytes||0),0),collections:results.map(({name,label,totals,daily})=>({name,label,count:totals[0]?.count||0,bytes:totals[0]?.bytes||0,daily})),tasks:{statuses:byName.Todo?.statuses||[],deadlines:byName.Todo?.deadlines?.[0]||{},completedDaily:byName.Todo?.completedDaily||[],folders:byName.Todo?.folders||[]},documents:{storage:byName.PDF?.storage||[],types:byName.PDF?.types||[],largest:byName.PDF?.largest||[],folders:byName.PDF?.folders||[],tags:byName.PDF?.tags||[]},taskFolders,documentFolders});
    }catch{res.status(503).json({message:'Could not calculate account analytics. Check database availability and support for MongoDB $bsonSize/$binarySize, then retry.'});}
  });
};
