const { PDFDocument, StandardFonts } = require('pdf-lib');
const { randomUUID } = require('node:crypto');
const {callAssistantAPI,AssistantAPIError}=require('./assistantDiagnostics');
const {responseText}=require('./assistant');

async function notesPDF(title,text){
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),annotations=[];
  let page=0,y=54,replacements=0;
  const clean=value=>[...value.normalize('NFKD').replace(/\r\n?/g,'\n').replace(/[\u0300-\u036f]/g,'').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[–—]/g,'-').replace(/\t/g,'    ')].map(char=>{if(char==='\n')return char;try{font.encodeText(char);return char}catch{replacements++;return '?'}}).join('');
  const addPage=()=>{if(page>=30)throw new Error('This draft is too long. Shorten it to fit within 30 pages.');pdf.addPage([612,792]);page++;y=54;};
  const wrap=(line,size)=>{
    const lines=[];let current='';
    for(const word of line.split(/\s+/).filter(Boolean)){
      if(font.widthOfTextAtSize(current?current+' '+word:word,size)<=496){current=current?current+' '+word:word;continue}
      if(current){lines.push(current);current='';}
      for(const char of word){if(font.widthOfTextAtSize(current+char,size)>496){lines.push(current);current='';}current+=char;}
    }
    if(current)lines.push(current);return lines;
  };
  const write=(value,size)=>{
    const lines=wrap(value,size),lineHeight=size*1.2;
    while(lines.length){
      if(y+lineHeight>730)addPage();
      const count=Math.max(1,Math.floor((730-y)/lineHeight)),chunk=lines.splice(0,count);
      annotations.push({id:`a_${randomUUID()}`,tool:'text',page,x:54,y,text:chunk.join('\n'),fontSize:size,color:'#202a35'});
      y+=chunk.length*lineHeight;
      if(lines.length)addPage();
    }
  };
  addPage();write(clean(title),22);y+=20;
  for(const paragraph of clean(text).split('\n')){if(!paragraph.trim()){y+=10;continue}write(paragraph,12);y+=6;}
  pdf.setTitle(title);pdf.setCreator('Assignment Tracker');
  return {bytes:Buffer.from(await pdf.save()),annotations,pages:page,replacements};
}

function registerGeneratedDocuments(app,auth,{credentials,model,PDF,PDFFolder,mongoose}){
  const active=new Set(),limits=new Map();
  app.post('/api/documents/generate',auth,async(req,res)=>{
    res.set('Cache-Control','no-store');
    const {prompt}=req.body||{},userId=String(req.user.userId);
    if(typeof prompt!=='string'||!prompt.trim()||prompt.length>6000)return res.status(400).json({message:'Describe your document in 1–6,000 characters.'});
    if(active.has(userId))return res.status(409).json({message:'A document is already being generated. Wait or cancel it first.'});
    const now=Date.now(),previous=limits.get(userId),limit=previous&&now-previous.start<300000?previous:{start:now,count:0};
    if(limit.count>=5)return res.status(429).json({message:'Please wait a few minutes before generating more documents.'});
    limit.count++;limits.set(userId,limit);active.add(userId);
    if(limits.size>1000)for(const [id,value]of limits)if(now-value.start>300000)limits.delete(id);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
    const disconnected=()=>{if(!res.writableEnded)controller.abort()};res.on('close',disconnected);
    try{
      const credential=await credentials.resolve(userId);
      if(!credential.apiKey)return res.status(400).json({message:'Save a Gemini API key in Account → AI settings before generating documents.'});
      const result=await callAssistantAPI({model:model(),systemInstruction:{parts:[{text:'Draft a useful document matching the user request. Return only JSON with title (string, at most 120 characters) and text (string, at most 20000 characters). The user will review and edit this before creating a PDF. Write plain text with clear section headings and short paragraphs. Use ASCII characters for PDF compatibility, simple hyphen bullet lists, and readable plain-text notation for math. Do not use Markdown fences, LaTeX, HTML, or tables. Do not invent personal details, citations, research sources, or claim to have read files. Do not promise that a document has been saved or created. If the request lacks details, make a useful template with labeled placeholders.'}]},contents:[{role:'user',parts:[{text:prompt.trim()}]}],generationConfig:{responseMimeType:'application/json',maxOutputTokens:6000,temperature:0.4}},{apiKey:credential.apiKey,signal:controller.signal,metadata:{kind:'document_generation'}});
      let draft;try{draft=JSON.parse(responseText(result.data))}catch{throw new Error('invalid draft');}
      if(typeof draft?.title!=='string'||!draft.title.trim()||typeof draft.text!=='string'||!draft.text.trim()||draft.text.length>20000)throw new Error('invalid draft');
      res.json({title:draft.title.trim().slice(0,120),text:draft.text});
    }catch(error){if(!res.destroyed)res.status(error instanceof AssistantAPIError?error.status:502).json({message:error instanceof AssistantAPIError?error.message:'The AI draft was incomplete or unavailable. Try generating a shorter document.'});}
    finally{clearTimeout(timeout);active.delete(userId);res.off('close',disconnected);}
  });
  app.post('/api/documents/create-generated',auth,async(req,res)=>{
    const {title,text,folderId}=req.body||{};
    if(typeof title!=='string'||!title.trim()||title.length>120||typeof text!=='string'||!text.trim()||text.length>20000)return res.status(400).json({message:'Enter a title (up to 120 characters) and draft text (up to 20,000 characters).'});
    try{
      if(folderId&&(!mongoose.isValidObjectId(folderId)||!await PDFFolder.exists({_id:folderId,user:req.user.userId})))return res.status(400).json({message:'Choose one of your document folders.'});
      const built=await notesPDF(title.trim(),text);
      const filename=(title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/\.pdf$/i,'').trim()||'Generated document')+'.pdf';
      const file=await PDF.create({name:title.trim(),originalName:filename,mimeType:'application/pdf',pdfData:built.bytes,annotations:built.annotations,user:req.user.userId,pdfFolder:folderId||null,tags:['ai-generated']});
      const metadata=file.toObject();delete metadata.pdfData;delete metadata.originalBackup;
      res.status(201).json({...metadata,generationNotice:built.replacements?`${built.replacements} unsupported characters were replaced with ?. Review the text in the editor.`:''});
    }catch(error){res.status(500).json({message:error.message?.startsWith('This draft')?error.message:'Could not create the PDF. Your draft is still available to copy or retry.'});}
  });
}
module.exports={registerGeneratedDocuments};
