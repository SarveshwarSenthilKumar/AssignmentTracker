const {Worker}=require('node:worker_threads');
const path=require('node:path');
module.exports=function registerGlobalSearch(app,auth,{mongoose,User,Todo,PDF,Folder,PDFFolder,CalendarEntry,SavedJob,AssistantConversation}){
  const Index=mongoose.models.DocumentSearchIndex||mongoose.model('DocumentSearchIndex',new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,index:true},document:mongoose.Schema.Types.ObjectId,version:String,text:String,status:String,error:String}).index({user:1,document:1},{unique:true}));
  const states=new Map();
  let workers=0;const waiting=[];
  const extract=file=>new Promise(resolve=>{
    const data=Buffer.isBuffer(file.pdfData)||file.pdfData instanceof Uint8Array?file.pdfData:file.pdfData?.value?.(true)||file.pdfData?.buffer;
    const worker=new Worker(path.join(__dirname,'searchTextWorker.js'),{workerData:{name:file.originalName,data:new Uint8Array(data),annotations:file.annotations||[]},resourceLimits:{maxOldGenerationSizeMb:256}});
    let finished=false;const finish=value=>{if(finished)return;finished=true;clearTimeout(timer);worker.terminate();resolve(value)};
    const timer=setTimeout(()=>finish({status:'failed',text:'',error:'Text extraction timed out; metadata and text annotations remain searchable.'}),30000);
    worker.once('message',finish);worker.once('error',error=>finish({status:'failed',text:'',error:error.message.slice(0,200)}));worker.once('exit',()=>finish({status:'failed',text:'',error:'Text extraction stopped.'}));
  });
  const boundedExtract=async file=>{
    if(workers>=2)await new Promise(resolve=>waiting.push(resolve));else workers++;
    try{return await extract(file)}finally{const next=waiting.shift();if(next)next();else workers--}
  };
  const queue=user=>{
    const old=states.get(user);
    if(old?.running||old&&Date.now()-old.at<15000)return;
    for(const [key,state]of states)if(!state.running&&Date.now()-state.at>3600000)states.delete(key);
    const state={running:true,total:0,processed:0,failed:0,unsupported:0,empty:0,at:Date.now()};states.set(user,state);
    ;(async()=>{
      const files=await PDF.find({user}).select('_id updatedAt originalName').lean();state.total=files.length;
      await Index.deleteMany({user,document:{$nin:files.map(file=>file._id)}});
      const cached=await Index.find({user}).select('document version status').lean(),known=new Map(cached.map(item=>[String(item.document),item]));
      for(const metadata of files){
        const version=String(metadata.updatedAt),previous=known.get(String(metadata._id));let status=previous?.status;
        if(!previous||previous.version!==version){
          const file=await PDF.findOne({_id:metadata._id,user}).select('originalName pdfData annotations updatedAt').lean();
          if(!file){state.processed++;continue}
          const result=await boundedExtract(file);status=result.status;
          const session=await mongoose.startSession();
          try{await session.withTransaction(async()=>{
            const locked=await User.updateOne({_id:user},{$inc:{searchIndexRevision:1}},{session});
            if(locked.matchedCount&&await PDF.exists({_id:metadata._id,user,updatedAt:file.updatedAt}).session(session))await Index.updateOne({user,document:metadata._id},{$set:{version:String(file.updatedAt),...result}},{upsert:true,session});
          })}finally{await session.endSession()}
        }
        if(status==='failed')state.failed++;if(status==='unsupported')state.unsupported++;if(status==='empty')state.empty++;state.processed++;
      }
    })().catch(()=>{state.error='Some file contents could not be indexed. Metadata remains searchable.'}).finally(()=>{state.running=false;state.at=Date.now()});
  };
  const escape=value=>Array.from(value,char=>'.*+?^${}()|[]'.includes(char)||char.charCodeAt(0)===92?String.fromCharCode(92)+char:char).join('');
  app.post('/api/search/reindex',auth,async(req,res)=>{
    try{const user=String(req.user.userId);if(states.get(user)?.running)return res.status(409).json({message:'File indexing is already running.'});await Index.deleteMany({user});states.delete(user);queue(user);res.json({ok:true})}catch{res.status(503).json({message:'Could not restart file indexing.'})}
  });
  app.get('/api/search/tasks/:id',auth,async(req,res)=>{
    try{if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:'Invalid task.'});const task=await Todo.findOne({_id:req.params.id,user:req.user.userId});if(!task)return res.status(404).json({message:'This task was removed. Search again for the latest results.'});res.json(task)}catch{res.status(503).json({message:'Could not open this task.'})}
  });
  app.get('/api/search',auth,async(req,res)=>{
    try{
      const q=typeof req.query.q==='string'?req.query.q.trim():'';
      if(q.length<2||q.length>160)return res.status(400).json({message:'Enter between 2 and 160 characters.'});
      if(q.split(/\s+/).length>12)return res.status(400).json({message:'Use up to 12 search terms for a focused search.'});
      const user=req.user.userId,terms=q.split(/\s+/).slice(0,12).map(term=>new RegExp(escape(term),'i')),owner={user},offset=Math.max(0,Math.min(100000,parseInt(req.query.offset,10)||0)),limit=15;
      const match=fields=>({$and:terms.map(term=>({$or:fields.map(field=>({[field]:term}))}))});
      const userInfo=await User.findById(user).select('calendarCategories').lean();
      const [taskFolders,documentFolders]=await Promise.all([Folder.find(owner).select('name parentId').lean(),PDFFolder.find(owner).select('name parentId').lean()]);
      const paths=folders=>{
        const known=new Map(folders.map(folder=>[String(folder._id),folder]));
        return folders.map(folder=>{const names=[],seen=new Set();let next=folder;while(next&&!seen.has(String(next._id))){seen.add(String(next._id));names.unshift(next.name);next=known.get(String(next.parentId))}return {id:folder._id,path:names.join(' / ')}});
      };
      const taskPaths=paths(taskFolders),documentPaths=paths(documentFolders);
      const versions=new Map((await PDF.find(owner).select('_id updatedAt').lean()).map(file=>[String(file._id),String(file.updatedAt)]));
      const indexed=await Promise.all(terms.map(term=>Index.find({...owner,text:term}).select('document version').lean()));
      const docMatch={$and:terms.map((term,index)=>({$or:[...['name','originalName','tags','annotations.text'].map(field=>({[field]:term})),{pdfFolder:{$in:documentPaths.filter(folder=>term.test(folder.path)).map(folder=>folder.id)}},{_id:{$in:indexed[index].filter(item=>versions.get(String(item.document))===item.version).map(item=>item.document)}}]}))};
      const groups={
        tasks:[Todo,{...owner,$and:terms.map(term=>({$or:[...['text','description','status','calendarLocation','calendarContext','links.url','links.title'].map(field=>({[field]:term})),{folder:{$in:taskPaths.filter(folder=>term.test(folder.path)).map(folder=>folder.id)}}]}))},'text description status dueDate canvasType folder'],
        documents:[PDF,{...owner,...(req.query.trash==='true'?{}:{deletedAt:null}),...docMatch},'name originalName tags pdfFolder deletedAt'],
        events:[CalendarEntry,{...owner,$and:terms.map(term=>({$or:[...['title','notes','location','kind','startDate','endDate','sports.sport','sports.league','sports.team','sports.opponent'].map(field=>({[field]:term})),{categoryId:{$in:(userInfo?.calendarCategories||[]).filter(category=>term.test(category.name)).map(category=>category.id)}}]}))},'title notes location startAt startDate kind'],
        jobs:[SavedJob,{...owner,...match(['title','company','location','url','description','requirements','responsibilities','benefits','employmentType','salary','datePosted','validThrough','source'])},'title company location'],
        chats:[AssistantConversation,{...owner,...match(['title','messages.content','messages.attachments.name'])},'title archived'],
        taskFolders:[Folder,{...owner,_id:{$in:taskPaths.filter(folder=>terms.every(term=>term.test(folder.path))).map(folder=>folder.id)}},'name parentId'],
        documentFolders:[PDFFolder,{...owner,$or:[match(['name','description']),{_id:{$in:documentPaths.filter(folder=>terms.every(term=>term.test(folder.path))).map(folder=>folder.id)}}]},'name parentId'],
      };
      const selected=req.query.group?Object.entries(groups).filter(([key])=>key===req.query.group):Object.entries(groups);
      const results=await Promise.all(selected.map(async([type,[Model,filter,fields]])=>{
        const [records,total]=await Promise.all([Model.find(filter).select(fields).sort({_id:-1}).skip(offset).limit(limit).lean(),Model.countDocuments(filter)]);
        return {type,total,offset,hasMore:offset+records.length<total,items:records.map(record=>({id:String(record._id),type,title:record.text||record.title||record.name||record.originalName||'Untitled',detail:(record.description||record.notes||[record.company,record.location,record.originalName,record.status].filter(Boolean).join(' · ')||'').replace(/<[^>]*>/g,'').slice(0,200),trashed:!!record.deletedAt,archived:!!record.archived,folder:record.pdfFolder?String(record.pdfFolder):null}))};
      }));
      const categories=(userInfo?.calendarCategories||[]).filter(item=>terms.every(term=>term.test(item.name))).map(item=>({id:item.id,type:'categories',title:item.name,detail:'Calendar category'}));
      queue(String(user));
      res.set('Cache-Control','no-store').json({groups:results,categories,indexing:states.get(String(user))||{running:false}});
    }catch{res.status(503).json({message:'Could not search the workspace. Retry after checking the backend connection.'})}
  });
};
