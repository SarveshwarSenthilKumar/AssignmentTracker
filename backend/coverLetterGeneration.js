const {randomUUID}=require('node:crypto');
const JSZip=require('jszip');
const cheerio=require('cheerio');
const {documentInput}=require('./assistant');
const {callAssistantAPI,AssistantAPIError,diagnostic,safeMessage}=require('./assistantDiagnostics');
const {instruction,compactText,generationConfig}=require('./coverLetterPrompt');

async function wordTemplate(bytes){
  const zip=await JSZip.loadAsync(bytes),entry=zip.file('word/document.xml');
  if(!entry||entry._data?.uncompressedSize>2*1024*1024)throw new Error('Choose a smaller, readable Word template.');
  const xml=await entry.async('string'),$=cheerio.load(xml,{xmlMode:true}),slots=[];
  let previousParagraph;
  $('w\\:t').each((index,node)=>{const value=$(node).text();if(value.trim()){const paragraph=$(node).closest('w\\:p')[0];slots.push({id:String(index),text:value,separatorBefore:slots.length&&paragraph!==previousParagraph?'\n\n':''});previousParagraph=paragraph}});
  return {zip,$,slots};
}
module.exports=function registerCoverLetterGeneration(app,auth,{PDF,SavedJob,mongoose,credentials,model,requireAIAccess}){
  const drafts=new Map(),active=new Set(),usage=new Map();
  const Draft=mongoose.models.CoverLetterDraft||mongoose.model('CoverLetterDraft',new mongoose.Schema({
    _id:String,user:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},
    expiresAt:{type:Date,required:true,index:{expires:0}},payload:{type:mongoose.Schema.Types.Mixed,required:true}
  }));
  const access=[auth,requireAIAccess('generation'),(req,res,next)=>req.aiAccess.resumes?next():res.status(403).json({message:'Enable Resumes and cover letters in Account → AI access.'})];
  const owned=async(id,user)=>{
    if(!mongoose.isValidObjectId(id))throw new Error('Choose one of your saved documents.');
    const doc=await PDF.findOne({_id:id,user,deletedAt:null});
    if(!doc||!doc.tags?.some(tag=>['resume','cover-letter'].includes(tag)))throw new Error('Choose an available resume or cover letter from your account.');
    return doc;
  };
  app.post('/api/cover-letters/generate',...access,async(req,res)=>{
    const user=String(req.user.userId);res.set('Cache-Control','no-store');
    if(active.has(user))return res.status(409).json({message:'A cover letter is already being generated.'});
    const now=Date.now(),limit=usage.get(user);if(limit&&now-limit.start<300000&&limit.count>=5)return res.status(429).json({message:'Wait a few minutes before generating more letters.'});
    if(!limit||now-limit.start>=300000)usage.set(user,{start:now,count:1});else limit.count++;
    for(const [id,draft]of drafts)if(draft.expires<now)drafts.delete(id);
    for(const [id,value]of usage)if(now-value.start>300000)usage.delete(id);
    active.add(user);const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),120000);
    let stage='Reading template and references',apiDiagnostics;
    const disconnected=()=>{if(!res.writableEnded)controller.abort()};res.on('close',disconnected);
    try{
      const template=await owned(req.body.templateId,user);
      if(!template.tags.includes('cover-letter'))throw new Error('Use a cover letter as the layout template.');
      const isWord=/\.docx$/i.test(template.originalName),isPDF=/\.pdf$/i.test(template.originalName);
      if(!isWord&&!isPDF)throw new Error('Choose a PDF or DOCX cover letter template.');
      if(template.annotations?.length)throw new Error('This template has editor annotations. Export the annotated version from the editor and upload that file first so its visible text is included.');
      const ids=req.body.referenceIds;
      if(!Array.isArray(ids)||ids.length>5||ids.some(id=>typeof id!=='string'))throw new Error('Choose up to five supporting documents.');
      const references=await Promise.all([...new Set(ids.filter(id=>id!==String(template._id)))].map(id=>owned(id,user)));
      const files=[template,...references];
      if(files.reduce((n,file)=>n+file.pdfData.length,0)>16*1024*1024)throw new Error('Choose fewer or smaller references (up to 16 MB total).');
      let slots;
      if(isWord)slots=(await wordTemplate(template.pdfData)).slots;
      else slots=req.body.slots;
      if(!Array.isArray(slots)||!slots.length||slots.length>600||slots.some(s=>typeof s.id!=='string'||typeof s.text!=='string'||!s.text.trim()||s.text.length>6000)||new Set(slots.map(s=>s.id)).size!==slots.length||slots.reduce((n,s)=>n+s.text.length,0)>30000)throw new Error('Use a text-based cover letter template with up to 600 text regions and 30,000 characters. Scanned templates need a Word or text-based PDF version.');
      slots=slots.map(({id,text,separatorBefore})=>({id,text,...(isWord?{separatorBefore}:{} )}));
      let role;
      if(req.body.jobId){if(!mongoose.isValidObjectId(req.body.jobId))throw new Error('Choose a saved job.');role=await SavedJob.findOne({_id:req.body.jobId,user}).lean();if(!role)throw new Error('The selected job is unavailable.');role=Object.fromEntries(['title','company','location','description','requirements','responsibilities'].map(key=>[key,role[key]||'']));}
      else{if(typeof req.body.role!=='string'||req.body.role.trim().length<20||req.body.role.length>15000)throw new Error('Choose a saved job or enter 20–15,000 characters describing the role.');role={description:req.body.role.trim()};}
      const credential=await credentials.resolve(user);if(!credential.apiKey)throw new Error('Save a Gemini API key in Account → AI settings.');
      const contextWarnings=[],phraseSources=new Map([[String(template._id),{name:template.name,text:slots.map(slot=>slot.text).join(' ')}]]);
      const briefRole={};
      for(const [field,value]of Object.entries(role)){
        const compact=compactText(value,field==='description'?5500:field==='requirements'?3000:field==='responsibilities'?2000:500);
        if(compact.text)briefRole[field]=compact.text;
        if(compact.trimmed)contextWarnings.push(`The job ${field} was shortened for a faster request. Check relevance to the full posting.`);
      }
      const parts=[{text:JSON.stringify({templateId:String(template._id),format:isWord?'Word text runs':'PDF positioned lines',role:briefRole,slots})}];
      const suppliedTexts=req.body.referenceTexts;
      if(suppliedTexts!==undefined&&(!suppliedTexts||typeof suppliedTexts!=='object'||Array.isArray(suppliedTexts)||Object.entries(suppliedTexts).some(([id,text])=>!references.some(file=>String(file._id)===id)||typeof text!=='string'||text.length>30000)))throw new Error('Invalid reference text. Select your documents again.');
      let remaining=32000,visualCount=0;
      // The complete template is already present in slots. Do not attach it again.
      for(const file of references){
        const id=String(file._id),kind=file.tags.includes('cover-letter')?'cover-letter wording':'resume facts';
        let referenceText='';
        if(/\.docx$/i.test(file.originalName)){const letter=await wordTemplate(file.pdfData);referenceText=letter.slots.map(slot=>slot.text).join(' ');}
        else if(typeof suppliedTexts?.[id]==='string')referenceText=suppliedTexts[id];
        if(referenceText.trim().length>=80){
          const compact=compactText(referenceText,Math.min(remaining,Math.floor(32000/Math.max(1,references.length)),kind==='resume facts'?12000:8000));
          remaining-=compact.text.length;
          parts.push({text:JSON.stringify({referenceId:id,name:file.name,kind,text:compact.text})});
          if(kind==='cover-letter wording')phraseSources.set(id,{name:file.name,text:compact.text});
          if(compact.trimmed)contextWarnings.push(`${file.name} was excerpted to keep generation fast; only included facts/phrases can be used.`);
        }else{
          if(++visualCount>2)throw new Error('For faster generation, choose at most two scanned PDF references. Text-based PDFs and Word files do not have this restriction.');
          const input=await documentInput(file);if(!input.content)throw new Error(`Could not read ${file.name}. Choose a readable PDF or DOCX.`);
          parts.push({text:JSON.stringify({referenceId:id,name:file.name,kind})},input.content);
          contextWarnings.push(`${file.name} required PDF vision because readable reference text was unavailable; this can take longer.`);
        }
      }
      const selectedModel=process.env.COVER_LETTER_MODEL?.trim()||model();
      stage='Generating with Gemini';
      const result=await callAssistantAPI({model:selectedModel,systemInstruction:{parts:[{text:instruction}]},contents:[{role:'user',parts}],generationConfig:generationConfig(selectedModel,slots.reduce((n,slot)=>n+slot.text.length,0))},{apiKey:credential.apiKey,signal:controller.signal,metadata:{kind:'cover_letter_tailoring',referenceCount:references.length,visualReferenceCount:visualCount}});
      apiDiagnostics=result.diagnostics;stage='Reading and validating generated draft';
      const response=(result.data.candidates?.[0]?.content?.parts||[]).filter(part=>!part.thought&&typeof part.text==='string').map(part=>part.text).join('');
      if(!response||response.length>100000||result.data.candidates?.[0]?.finishReason==='MAX_TOKENS')throw new Error('The AI draft was incomplete. Try a shorter template or fewer references.');
      const draft=JSON.parse(response),allowed=new Map(slots.map(s=>[s.id,s.text]));
      if(!Array.isArray(draft.replacements)||draft.replacements.length>slots.length||new Set(draft.replacements.map(s=>s.id)).size!==draft.replacements.length||draft.replacements.some(s=>!allowed.has(s.id)||typeof s.text!=='string'||!s.text.trim()||s.text.length>6000))throw new Error('The generated draft did not match the template regions. Try again with a simpler template.');
      if(!draft.replacements.length)contextWarnings.push('No wording changes were proposed. Check the target role and keep the original only if it is already appropriate.');
      const replacements=draft.replacements.map(({id,text})=>({id,text})),draftId=randomUUID();
      const normalizePhrase=value=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
      const proposed=new Map(replacements.map(item=>[item.id,item.text]));
      const letterText=normalizePhrase(slots.map(slot=>proposed.get(slot.id)??slot.text).join(' '));
      const phraseReuse=[],seenPhrases=new Set();
      for(const item of Array.isArray(draft.phraseReuse)?draft.phraseReuse.slice(0,50):[]){
        if(typeof item?.sourceId!=='string'||typeof item.quote!=='string'||item.quote.length>700||item.quote.trim().split(/\s+/).length<4)continue;
        const source=phraseSources.get(item.sourceId),quote=normalizePhrase(item.quote);
        if(source&&normalizePhrase(source.text).includes(quote)&&letterText.includes(quote)&&!seenPhrases.has(quote)){seenPhrases.add(quote);phraseReuse.push({source:source.name,quote:item.quote})}
      }
      const warnings=[...contextWarnings,...(Array.isArray(draft.warnings)?draft.warnings.filter(s=>typeof s==='string').slice(0,4).map(s=>s.slice(0,1000)):[])];
      if(!phraseReuse.length)warnings.push('No reused phrase could be verified against the template or supplied reference text. Compare the proposed wording with your previous letters before saving.');
      if(references.some(file=>file.tags.includes('cover-letter')&&!phraseSources.has(String(file._id))))warnings.push('Additional PDF letters are provided to AI as wording references. Verified phrase notes below cover the template and readable text references only.');
      const storedDraft={user,expires:Date.now()+3600000,templateId:String(template._id),updatedAt:String(template.updatedAt),slots,replacements,isWord};
      await Draft.create({_id:draftId,user,expiresAt:new Date(storedDraft.expires),payload:storedDraft});
      drafts.set(draftId,storedDraft);
      res.json({draftId,slots,replacements,isWord,evidence:Array.isArray(draft.evidence)?draft.evidence.filter(s=>typeof s==='string').slice(0,30).map(s=>s.slice(0,1000)):[],warnings,phraseReuse});
    }catch(error){
      if(!res.destroyed){
        const status=controller.signal.aborted?504:error instanceof AssistantAPIError?error.status:422;
        const message=controller.signal.aborted?'Cover-letter generation exceeded the two-minute limit. Try fewer references or text-based PDFs; your original documents are unchanged.':error instanceof SyntaxError?'The AI response was incomplete or unreadable. Try again with fewer references.':safeMessage(error.message)||'Could not generate this cover letter.';
        const details=error instanceof AssistantAPIError?{...error.diagnostics}:diagnostic(controller.signal.aborted?'timeout':error instanceof SyntaxError?'invalid_response':'document_processing',message,'Review the template and references, then try again.',{stage,...(apiDiagnostics?{model:apiDiagnostics.model,providerStatus:apiDiagnostics.providerStatus,providerRequestId:apiDiagnostics.providerRequestId,traceId:apiDiagnostics.traceId}:{} )});
        details.httpStatus=status;
        res.set('X-Request-Id',details.traceId).status(status).json({message,diagnostics:details});
      }
    }
    finally{clearTimeout(timer);res.off('close',disconnected);active.delete(user)}
  });
  app.post('/api/cover-letters/save-draft',...access,async(req,res)=>{
    res.set('Cache-Control','no-store');
    let draft;
    try{
      if(typeof req.body.draftId!=='string')return res.status(400).json({message:'Generate a cover letter before saving.'});
      draft=drafts.get(req.body.draftId);
      if(!draft){const stored=await Draft.findOne({_id:req.body.draftId,user:req.user.userId,expiresAt:{$gt:new Date()}}).lean();if(stored){draft=stored.payload;drafts.set(req.body.draftId,draft)}}
    }catch(error){return res.status(503).json({message:'Could not load the saved draft. Keep this page open and retry saving.'})}
    if(!draft||draft.user!==String(req.user.userId)||draft.expires<Date.now())return res.status(410).json({message:'This draft expired. Generate it again.'});
    if(draft.saving)return res.status(409).json({message:'This draft is being saved.'});
    draft.saving=true;
    try{
      if(draft.savedId){const previous=await PDF.findOne({_id:draft.savedId,user:req.user.userId,deletedAt:null}).select('-pdfData -originalBackup');return previous?res.json(previous):res.status(410).json({message:'The saved draft is no longer available.'});}
      const template=await owned(draft.templateId,draft.user);if(String(template.updatedAt)!==draft.updatedAt)throw new Error('The template changed. Generate again from the current version.');
      const name=typeof req.body.name==='string'?req.body.name.trim():'';if(!name||name.length>120)throw new Error('Enter a document name up to 120 characters.');
      const changes=req.body.replacements,allowed=new Map(draft.slots.map(s=>[s.id,s.text]));
      if(req.body.reviewed!==true||!Array.isArray(changes)||changes.length>600||new Set(changes.map(s=>s.id)).size!==changes.length||changes.some(s=>!allowed.has(s.id)||typeof s.text!=='string'||s.text.length>30000))throw new Error('Review the draft and use only the original template text regions.');
      let bytes=template.pdfData,annotations=[];
      if(draft.isWord){const {zip,$}=await wordTemplate(bytes),map=new Map(changes.map(s=>[s.id,s.text]));$('w\\:t').each((index,node)=>{if(map.has(String(index)))$(node).attr('xml:space','preserve').text(map.get(String(index)))});zip.file('word/document.xml',$.xml());bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});}
      else{
        const supplied=req.body.annotations;if(!Array.isArray(supplied)||supplied.length!==changes.length||new Set(supplied.map(item=>item.sourceText?.key)).size!==supplied.length||JSON.stringify(supplied).length>1500000)throw new Error('The PDF layout is incomplete. Generate the draft again.');
        const {PDFDocument}=require('pdf-lib'),pdf=await PDFDocument.load(bytes),map=new Map(changes.map(s=>[s.id,s.text]));
        annotations=supplied.map(item=>{const source=item.sourceText,key=source?.key,page=pdf.getPage((item.page||1)-1),size=page.getSize();if(item.tool!=='text'||!map.has(key)||item.text!==map.get(key)||source.originalText!==allowed.get(key)||![item.x,item.y,item.fontSize,source.x,source.y,source.width,source.height].every(Number.isFinite)||item.fontSize<1||item.fontSize>200||item.x< -10||item.y< -10||source.x< -2||source.y< -2||source.x+source.width>size.width+2||source.y+source.height>size.height+2||source.width<=0||source.height<=0)throw new Error('Invalid PDF text region.');return {...item,id:randomUUID()};});
      }
      const file=await PDF.create({user:draft.user,name,originalName:name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-')+(draft.isWord?'.docx':'.pdf'),mimeType:draft.isWord?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'application/pdf',pdfData:bytes,annotations,tags:['cover-letter','ai-tailored']});
      draft.savedId=String(file._id);
      await Draft.updateOne({_id:req.body.draftId,user:req.user.userId},{$set:{'payload.savedId':draft.savedId}});
      const metadata=file.toObject();delete metadata.pdfData;delete metadata.originalBackup;res.status(201).json(metadata);
    }catch(error){const message=safeMessage(error.message)||'Could not save this draft.';const details=diagnostic('save_failed',message,'Your reviewed draft is retained. Correct the issue and retry saving.',{stage:'Saving cover letter',httpStatus:422});res.status(422).json({message,diagnostics:details})}finally{draft.saving=false}
  });
};
