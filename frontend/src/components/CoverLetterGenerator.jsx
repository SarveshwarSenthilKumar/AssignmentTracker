import {useEffect,useRef,useState} from 'react'
import {pdfjs} from 'react-pdf'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import {readApiJson} from '../lib/apiResponse'
import {existingTextRuns,makeSourceReplacement} from '../lib/pdfExistingText'
import './CoverLetterGenerator.css'
import CoverLetterError from './CoverLetterError'
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl

export default function CoverLetterGenerator({token,documents,onDocumentsChange,onOpen}){
  const [templateId,setTemplateId]=useState(''),[references,setReferences]=useState([]),[jobs,setJobs]=useState([]),[jobId,setJobId]=useState(''),[role,setRole]=useState(''),[name,setName]=useState(''),[draft,setDraft]=useState(null),[changes,setChanges]=useState([]),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const runs=useRef(new Map()),lock=useRef(false),referenceCache=useRef(new Map()),errorPanel=useRef(null)
  const [generationStage,setGenerationStage]=useState('')
  const [fitText,setFitText]=useState(true)
  useEffect(()=>{if(error)errorPanel.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[error])
  const letters=documents.filter(d=>!d.deletedAt&&d.tags?.includes('cover-letter'))
  const sources=documents.filter(d=>!d.deletedAt&&d._id!==templateId&&d.tags?.some(t=>['resume','cover-letter'].includes(t)))
  const reportError=(e,stage)=>setError({message:e.message||'Could not complete this operation.',diagnostics:{source:'browser',stage,timestamp:new Date().toISOString(),...e.diagnostics}})
  const request=async(url,options={})=>{
    let response
    try{
      response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},cache:'no-store'})
      const data=await readApiJson(response)
      if(!response.ok){const failure=new Error(data.message||'Could not complete this request.');failure.diagnostics=data.diagnostics;throw failure}
      return data
    }catch(e){e.diagnostics={source:response?'application':'network',action:response?'Review the error message and retry after correcting the issue.':'Check your connection and that the backend is running, then retry.',...e.diagnostics,httpStatus:response?.status,traceId:e.diagnostics?.traceId||response?.headers.get('X-Request-Id')};throw e}
  }
  useEffect(()=>{let canceled=false;request('/api/jobs').then(data=>{if(!canceled)setJobs(data)}).catch(e=>{if(!canceled)reportError(e,'Loading saved jobs')});return()=>{canceled=true}},[token])
  const reset=()=>{setDraft(null);setChanges([]);setReviewed(false);setError('')}
  const generate=async event=>{
    event.preventDefault();if(lock.current)return;lock.current=true;setBusy('generate');reset();setGenerationStage('Reading template…')
    let stage='Reading template'
    try{
      const file=await request(`/api/pdfs/${templateId}`);runs.current=new Map();let slots
      if(/\.pdf$/i.test(file.originalName)){
        const bytes=Uint8Array.from(atob(file.pdfData),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:'application/pdf'}),task=pdfjs.getDocument({data:bytes})
        try{const pdf=await task.promise;if(pdf.numPages>4)throw new Error('Choose a cover letter template of four pages or fewer.');for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const items=await existingTextRuns(page,pdfjs,blob);for(const run of items)runs.current.set(run.key,{...run,page:n})}slots=[...runs.current.values()].map(run=>({id:run.key,text:run.text}));if(!slots.length)throw new Error('This PDF has no editable text. Use a text-based PDF or Word template.')}finally{await task.destroy()}
      }
      const referenceTexts={}
      setGenerationStage('Preparing readable reference text…')
      stage='Preparing readable reference text'
      await Promise.all(references.filter(id=>id!==templateId).map(async id=>{
        const metadata=documents.find(file=>file._id===id)
        if(!/\.pdf$/i.test(metadata?.originalName||''))return
        const key=`${id}:${metadata.updatedAt||''}`
        if(referenceCache.current.has(key)){referenceTexts[id]=referenceCache.current.get(key);return}
        const file=await request(`/api/pdfs/${id}`)
        const task=pdfjs.getDocument({data:Uint8Array.from(atob(file.pdfData),c=>c.charCodeAt(0)),isEvalSupported:false})
        let text=''
        try{
          const pdf=await task.promise
          for(let page=1;page<=Math.min(pdf.numPages,20)&&text.length<30000;page++){
            const content=await(await pdf.getPage(page)).getTextContent()
            text+=content.items.map(item=>item.str?item.str+(item.hasEOL?'\n':' '):'').join('')+'\n'
          }
        }finally{await task.destroy()}
        if(text.trim().length>=80){referenceTexts[id]=text.slice(0,30000);if(referenceCache.current.size>=20)referenceCache.current.delete(referenceCache.current.keys().next().value);referenceCache.current.set(key,referenceTexts[id])}
      }))
      setGenerationStage('Adapting your phrases to the role…')
      stage='Generating cover letter'
      const result=await request('/api/cover-letters/generate',{method:'POST',body:JSON.stringify({templateId,referenceIds:references.filter(id=>id!==templateId),referenceTexts,jobId:jobId||undefined,role,slots})})
      setDraft(result);setChanges(result.replacements);setName(`${jobs.find(j=>j._id===jobId)?.title||'Tailored'} cover letter`.slice(0,120))
    }catch(e){reportError(e,stage)}finally{lock.current=false;setBusy('');setGenerationStage('')}
  }
  const annotationsFor=()=>{
    const context=document.createElement('canvas').getContext('2d')
    return changes.filter(item=>item.text!==draft.slots.find(s=>s.id===item.id)?.text).map(item=>{
      const run=runs.current.get(item.id);if(!run)throw new Error('Template layout is unavailable. Generate the letter again.')
      const style=run.textStyle
      if(style.approximate&&!fitText)throw new Error(`The original font (${style.fontName}) is not embedded in this PDF. Enable “Fit PDF replacements” to use the detected substitute font, or use a Word template.`)
      context.font=`${style.embedded?'normal':style.italic?'italic':'normal'} ${style.embedded?400:style.fontWeight||400} ${run.fontSize}px ${style.fontFamily}`
      const text=fitText?item.text.replace(/[\r\n]+/g,' '):item.text
      const width=(context.measureText(text).width+(style.letterSpacing||0)*Math.max(0,text.length-1))*(style.horizontalScale||1)
      if(!fitText&&(text.includes('\n')||width>run.width+1))throw new Error(`This replacement does not fit its original PDF position: “${text.slice(0,65)}”. Enable “Fit PDF replacements” or shorten the wording.`)
      const replacement=makeSourceReplacement(run,run.page,crypto.randomUUID())
      return {...replacement,text,textStyle:{...replacement.textStyle,horizontalScale:(style.horizontalScale||1)*(fitText&&width>run.width?run.width/width:1)}}
    })
  }
  const save=async()=>{
    if(lock.current||!reviewed)return;lock.current=true;setBusy('save');setError('')
    try{
      const replacements=changes.filter(item=>item.text!==draft.slots.find(s=>s.id===item.id)?.text).map(item=>({...item,text:!draft.isWord&&fitText?item.text.replace(/[\r\n]+/g,' '):item.text}))
      const annotations=draft.isWord?undefined:annotationsFor()
      const result=await request('/api/cover-letters/save-draft',{method:'POST',body:JSON.stringify({draftId:draft.draftId,name,replacements,annotations,reviewed})})
      if(!result?._id)throw new Error('The server did not return a saved document. Your reviewed draft is still available; retry saving.')
      onDocumentsChange(previous=>[result,...previous.filter(d=>d._id!==result._id)]);onOpen(result._id);reset()
    }catch(e){reportError(e,'Preparing and saving the reviewed draft')}finally{lock.current=false;setBusy('')}
  }
  const normalizePhrase=value=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()
  const currentLetter=draft?normalizePhrase(draft.slots.map(slot=>changes.find(item=>item.id===slot.id)?.text??slot.text).join(' ')):''
  const reusedPhrases=(draft?.phraseReuse||[]).filter(item=>currentLetter.includes(normalizePhrase(item.quote)))
  return <details className="cover-letter-generator"><summary>Create a tailored cover letter from your existing letters</summary>
    <p>Your existing wording comes first: reuse sentences, phrases, transitions and closings from your selected cover letters, changing only what the role and supported facts require. Resumes and job descriptions provide facts, not the writing voice. Only selected documents and job details are sent to your configured AI.</p>
    <form onSubmit={generate}><div className="cover-generator-fields">
      <label>Layout and primary voice template<select value={templateId} required disabled={!!busy} onChange={e=>{setTemplateId(e.target.value);setReferences(previous=>previous.filter(id=>id!==e.target.value));reset()}}><option value="">Choose a saved cover letter</option>{letters.map(file=><option key={file._id} value={file._id}>{file.name}</option>)}</select></label>
      <label>Target role<select value={jobId} disabled={!!busy} onChange={e=>{setJobId(e.target.value);reset()}}><option value="">Paste role details below</option>{jobs.map(job=><option key={job._id} value={job._id}>{job.title}{job.company?` · ${job.company}`:''}</option>)}</select></label>
      {!jobId&&<label className="cover-generator-wide">Role and company details<textarea rows={5} value={role} minLength={20} maxLength={15000} required disabled={!!busy} onChange={e=>{setRole(e.target.value);reset()}} placeholder="Paste the role, company, and job description. Applicant facts must come from your documents."/></label>}
      <fieldset className="cover-generator-wide" disabled={!!busy}><legend>Additional letters for voice and resumes for factual project details (up to 5)</legend>{sources.map(file=><label className="cover-generator-check" key={file._id}><input type="checkbox" checked={references.includes(file._id)} disabled={!references.includes(file._id)&&references.length>=5} onChange={e=>{setReferences(previous=>e.target.checked?[...previous,file._id]:previous.filter(id=>id!==file._id));reset()}}/>{file.name} · {file.tags.includes('resume')?'Resume':'Cover letter'}</label>)}{!sources.length&&<p>Add a resume or more letters to provide factual projects and additional voice examples.</p>}</fieldset>
    </div><button type="submit" disabled={!!busy||!templateId}>{busy==='generate'?generationStage||'Adapting your existing wording…':'Generate using my existing phrases'}</button>{busy==='generate'&&<p role="status">{generationStage} Readable PDFs use text instead of slower vision processing.</p>}</form>
    {error&&<div ref={errorPanel}><CoverLetterError key={error.diagnostics.timestamp} error={error}/></div>}
    {draft&&<div className="cover-letter-draft"><h3>Review changes in template order</h3><p>{draft.isWord?'The Word file’s existing formatting, runs, margins, headers and paragraph structure are retained. Text changes can still affect wrapping and pagination.':'PDF replacements keep their original positions and font sizes. Fitting can compress longer text horizontally and use substitute fonts when originals are unavailable. Shorten long replacements for better readability. Original text is visually covered, not redacted.'}</p>
      <div className="cover-letter-slot-list">{draft.slots.map(slot=>{const change=changes.find(item=>item.id===slot.id);return <div key={slot.id} className={change?'is-changed':''}><span>{change?'Proposed replacement':'Unchanged template text'}</span>{change?<><small>Original: {slot.text}</small><textarea rows={Math.min(7,Math.max(2,Math.ceil(change.text.length/90)))} value={change.text} maxLength={6000} disabled={!!busy} onChange={e=>{setChanges(previous=>previous.map(item=>item.id===slot.id?{...item,text:e.target.value}:item));setReviewed(false)}}/><button type="button" disabled={!!busy} onClick={()=>{setChanges(previous=>previous.filter(item=>item.id!==slot.id));setReviewed(false)}}>Keep original</button></>:<p>{slot.text}</p>}</div>})}</div>
      {!!reusedPhrases.length&&<details open><summary>Reused phrases checked against your letters</summary><p>These excerpts occur in both the current draft and the template or readable reference text. Case and whitespace are normalized for matching.</p><ul>{reusedPhrases.map((item,i)=><li key={i}><q>{item.quote}</q> — {item.source}</li>)}</ul></details>}
      {!!draft.evidence?.length&&<details><summary>Factual source notes</summary><ul>{draft.evidence.map((item,i)=><li key={i}>{item}</li>)}</ul></details>}
      {!!draft.warnings?.length&&<div role="status"><h4>Information to review</h4><ul>{draft.warnings.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
      <label>New cover letter name<input value={name} maxLength={120} disabled={!!busy} onChange={e=>setName(e.target.value)}/></label>
      {!draft.isWord&&<label className="cover-generator-check"><input type="checkbox" checked={fitText} disabled={!!busy} onChange={e=>{setFitText(e.target.checked);setReviewed(false)}}/>Fit PDF replacements into their original lines (use detected substitute fonts when needed).</label>}
      <label className="cover-generator-check"><input type="checkbox" checked={reviewed} disabled={!!busy} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the voice, role details, and factual claims against my documents.</label>
      {!busy&&(!reviewed||!name.trim()||changes.some(item=>!item.text.trim()))&&<p role="status">{!name.trim()?'Enter a name for the new copy.':changes.some(item=>!item.text.trim())?'Fill in empty replacements or choose Keep original.':'Select the review checkbox above to enable saving.'}</p>}
      <button type="button" disabled={!!busy||!reviewed||!name.trim()||changes.some(item=>!item.text.trim())} onClick={save}>{busy==='save'?'Saving…':'Save separate copy & open editor'}</button>
    </div>}
  </details>
}
