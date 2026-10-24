const keys=['enabled','profile','tasks','calendar','documentLibrary','resumes','notes','documentFiles','screen','history','editorRead','editorWrite','generation','recognition'];
const normalize=value=>Object.fromEntries(keys.map(key=>[key,value?.[key]!==false]));
const category=file=>(file.tags?.includes('resume')||file.tags?.includes('cover-letter'))?'resumes':file.tags?.includes('notes')?'notes':'documentFiles';
const contentScopes=['profile','tasks','calendar','documentLibrary','resumes','notes','documentFiles'];
function restrictRequest(request,access){
  const screenAllowed=access.screen&&access.editorRead&&contentScopes.every(key=>access[key]);
  request.includeScreen=request.includeScreen&&screenAllowed;
  if(!request.includeScreen)request.screen='';
  if(!access.editorRead)request.editor=null;
  else if(request.editor&&!access.editorWrite)request.editor.readOnly=true;
  if(!access.history||contentScopes.some(key=>!access[key])||!access.screen||!access.editorRead)request.messages=request.messages.slice(-1);
  request.access=access;
}
function restrictContext(context,access){
  if(!access.profile)delete context.profile;
  if(!access.tasks){delete context.tasks;delete context.folders;delete context.totals?.tasks;delete context.totals?.includedTasks;}
  if(!access.calendar){delete context.calendar;delete context.totals?.calendarEntries;delete context.totals?.includedCalendarEntries;}
  if(!access.documentLibrary){delete context.documents;delete context.documentFolders;delete context.totals?.documents;delete context.totals?.includedDocuments;}
  // Counts were calculated before document-category filtering, so don't disclose them.
  if(!access.resumes||!access.notes||!access.documentFiles){delete context.totals?.documents;delete context.totals?.includedDocuments;}
  if(!access.tasks){for(const entry of context.calendar||[])delete entry.taskIds;for(const file of context.documents||[]){delete file.taskIds;delete file.legacyTaskId;}}
  if(!access.documentLibrary||!access.resumes||!access.notes||!access.documentFiles){for(const entry of context.calendar||[])delete entry.documentIds;}
  return context;
}
function registerAIAccess(app,auth,User){
  app.get('/api/account/ai-access',auth,async(req,res)=>{try{const user=await User.findById(req.user.userId).select('aiAccess').lean();if(!user)return res.status(404).json({message:'Account not found.'});res.json(normalize(user.aiAccess));}catch{res.status(500).json({message:'Could not load AI access settings.'});}});
  app.put('/api/account/ai-access',auth,async(req,res)=>{
    if(!req.body||Array.isArray(req.body)||!Object.keys(req.body).length||Object.entries(req.body).some(([key,value])=>!keys.includes(key)||typeof value!=='boolean'))return res.status(400).json({message:'Choose valid AI access settings.'});
    try{const update=Object.fromEntries(Object.entries(req.body).map(([key,value])=>[`aiAccess.${key}`,value]));const user=await User.findByIdAndUpdate(req.user.userId,{$set:update},{new:true}).select('aiAccess').lean();if(!user)return res.status(404).json({message:'Account not found.'});res.json(normalize(user.aiAccess));}catch{res.status(500).json({message:'Could not save AI access settings.'});}
  });
  return feature=>async(req,res,next)=>{
    try{const user=await User.findById(req.user.userId).select('aiAccess').lean();if(!user)return res.status(404).json({message:'Account not found.'});const access=normalize(user.aiAccess);if(!access.enabled||(feature&&!access[feature]))return res.status(403).json({message:'This AI feature is disabled in Account → AI access.'});req.aiAccess=access;next();}catch{res.status(503).json({message:'Could not verify AI access settings. No AI request was sent.'});}
  };
}
module.exports={normalize,category,restrictRequest,restrictContext,registerAIAccess};
