import {useEffect,useRef,useState} from 'react'
import {pdfjs} from 'react-pdf'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import {readApiJson} from '../lib/apiResponse'
import {existingTextRuns,makeSourceReplacement} from '../lib/pdfExistingText'
import './CoverLetterGenerator.css'
import CoverLetterError from './CoverLetterError'
import {letterRegions,letterText,editLetter} from '../lib/coverLetterText'
import {layoutCoverLetter} from '../lib/coverLetterPdfLayout'
import {tailoringTemplateRuns} from '../lib/tailoringTemplateRuns'
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl

export default function CoverLetterGenerator({token,documents,onDocumentsChange,onOpen,documentType='cover-letter'}){
  const isResume=documentType==='resume',label=isResume?'resume':'cover letter',heading=isResume?'Resume':'Cover letter',apiBase=isResume?'/api/resumes':'/api/cover-letters'
  const [templateId,setTemplateId]=useState(''),[references,setReferences]=useState([]),[jobs,setJobs]=useState([]),[jobId,setJobId]=useState(''),[role,setRole]=useState(''),[name,setName]=useState(''),[draft,setDraft]=useState(null),[changes,setChanges]=useState([]),[reviewed,setReviewed]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const runs=useRef(new Map()),lock=useRef(false),referenceCache=useRef(new Map()),errorPanel=useRef(null)
  const [generationStage,setGenerationStage]=useState('')
  const [draftText,setDraftText]=useState('')
  const [mode,setMode]=useState('tailor'),[cleanupComments,setCleanupComments]=useState('')
  const cleanup=mode==='cleanup'
  const textRegions=useRef([])
  useEffect(()=>{if(error)errorPanel.current?.scrollIntoView({behavior:'smooth',block:'nearest'})},[error])
  const letters=documents.filter(d=>!d.deletedAt&&d.tags?.includes(documentType))
  const sources=documents.filter(d=>!d.deletedAt&&d._id!==templateId&&d.tags?.some(t=>(isResume?['resume']:['resume','cover-letter']).includes(t)))
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
      if(file.annotations?.length){setGenerationStage('Reading template and saved text edits…');stage='Reading template and saved text edits'}
      if(/\.pdf$/i.test(file.originalName)){
        const bytes=Uint8Array.from(atob(file.pdfData),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:'application/pdf'}),task=pdfjs.getDocument({data:bytes})
        try{const pdf=await task.promise;if(pdf.numPages>(isResume?8:4))throw new Error(`Choose a ${label} template of ${isResume?'eight':'four'} pages or fewer.`);for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const items=tailoringTemplateRuns(await existingTextRuns(page,pdfjs,blob),file.annotations||[],n);for(const run of items)runs.current.set(run.key,run)}slots=[...runs.current.values()].map(run=>({id:run.key,text:run.text}));if(!slots.length)throw new Error('This PDF has no editable text. Use a text-based PDF or Word template.')}finally{await task.destroy()}
      }
      const referenceTexts={}
      setGenerationStage('Preparing readable reference text…')
      stage='Preparing readable reference text'
      await Promise.all((cleanup?[]:references.filter(id=>id!==templateId)).map(async id=>{
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
            const sheet=await pdf.getPage(page)
            const content=file.annotations?.length?await(await import('./PDFSelectableLayer')).pdfSelectionContent(sheet,file.annotations.filter(item=>(item.page||1)===page)):await sheet.getTextContent()
            text+=content.items.map(item=>item.str?item.str+(item.hasEOL?'\n':' '):'').join('')+'\n'
          }
        }finally{await task.destroy()}
        if(text.trim().length>=80){referenceTexts[id]=text.slice(0,30000);if(referenceCache.current.size>=20)referenceCache.current.delete(referenceCache.current.keys().next().value);referenceCache.current.set(key,referenceTexts[id])}
      }))
      setGenerationStage(cleanup?'Cleaning up your letter from your comments…':isResume?'Tailoring supported experience to the role…':'Adapting your phrases to the role…')
      stage=cleanup?'Cleaning up cover letter':`Generating ${label}`
      const result=await request(`${apiBase}/generate`,{method:'POST',body:JSON.stringify({templateId,templateVersion:file.updatedAt,mode,referenceIds:cleanup?[]:references.filter(id=>id!==templateId),...(cleanup?{cleanupComments}:{referenceTexts,jobId:jobId||undefined,role}),slots})})
      setDraft(result);setChanges(result.replacements);setName((cleanup?`${documents.find(file=>file._id===templateId)?.name||heading} — cleaned up`:`${jobs.find(j=>j._id===jobId)?.title||'Tailored'} ${label}`).slice(0,120))
      textRegions.current=letterRegions(result.slots,result.replacements,runs.current)
      setDraftText(letterText(textRegions.current))
    }catch(e){reportError(e,stage)}finally{lock.current=false;setBusy('');setGenerationStage('')}
  }
  const annotationsFor=(replacements)=>{
    const context=document.createElement('canvas').getContext('2d')
    return replacements.map(item=>{
      const run=runs.current.get(item.id);if(!run)throw new Error(`Template layout is unavailable. Generate the ${label} again.`)
      const style=run.textStyle
      if(style.approximate)throw new Error(`The original font (${style.fontName}) is not embedded in this PDF. Upload the Word original or a PDF with embedded fonts to keep the exact font.`)
      context.font=`${style.embedded?'normal':style.italic?'italic':'normal'} ${style.embedded?400:style.fontWeight||400} ${run.fontSize}px ${style.fontFamily}`
      const text=item.text
      const width=(context.measureText(text).width+(style.letterSpacing||0)*Math.max(0,text.length-1))*(style.horizontalScale||1)
      if(/[\r\n]/.test(text)||width>run.width+1)throw new Error(`This replacement is too long for its original PDF line: “${text.slice(0,65)}”. Shorten this line or use the Word original, which can wrap naturally. The font, size and spacing will not be compressed.`)
      const replacement=makeSourceReplacement(run,run.page,crypto.randomUUID())
      return {...replacement,text}
    })
  }
  const save=async()=>{
    if(lock.current||!reviewed)return;lock.current=true;setBusy('save');setError('')
    try{
      const replacements=draft.isWord?changes.filter(item=>item.text!==draft.slots.find(s=>s.id===item.id)?.text):layoutCoverLetter(draft.slots,changes,runs.current,{preserveBullets:isResume})
      const annotations=draft.isWord?undefined:annotationsFor(replacements)
      const result=await request(`${apiBase}/save-draft`,{method:'POST',body:JSON.stringify({draftId:draft.draftId,name,replacements,annotations,reviewed})})
      if(!result?._id)throw new Error('The server did not return a saved document. Your reviewed draft is still available; retry saving.')
      onDocumentsChange(previous=>[result,...previous.filter(d=>d._id!==result._id)]);onOpen(result._id);reset()
    }catch(e){reportError(e,'Preparing and saving the reviewed draft')}finally{lock.current=false;setBusy('')}
  }
  const normalizePhrase=value=>value.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()
  const currentLetter=draft?normalizePhrase(draftText):''
  const reusedPhrases=(draft?.phraseReuse||[]).filter(item=>currentLetter.includes(normalizePhrase(item.quote)))
  return <details className="cover-letter-generator"><summary>{isResume?'Tailor a resume using your previous resumes':'Create or clean up a cover letter'}</summary>
    {!isResume&&<div className="cover-letter-mode" role="group" aria-label="Cover letter action"><button type="button" aria-pressed={!cleanup} disabled={!!busy} onClick={()=>{setMode('tailor');reset()}}>Tailor for a role</button><button type="button" aria-pressed={cleanup} disabled={!!busy} onClick={()=>{setMode('cleanup');reset()}}>Clean up a letter</button></div>}
    <p>{isResume?'Choose a resume as the layout template and optionally select previous resumes for supporting facts and wording. AI adapts existing bullets and descriptions to the job using only supported projects, skills and experience. Identity, employers, dates, official titles and qualifications must stay accurate. Review the proposed wording and source notes, then save a separate copy. Only selected documents and job details are sent to your configured AI.':cleanup?'Choose an uploaded letter and describe what to clean up. AI makes focused corrections using your comments and existing wording, with the original file supplying formatting. Only that letter and your comments are sent to your configured AI. Review the draft, then save a separate copy.':'Your existing wording comes first: reuse sentences, phrases, transitions and closings from your selected cover letters, changing only what the role and supported facts require. Resumes and job descriptions provide facts, not the writing voice. Only selected documents and job details are sent to your configured AI.'}</p>
    <form onSubmit={generate}><div className="cover-generator-fields">
      <label>{isResume?'Resume layout and wording template':cleanup?'Letter to clean up':'Layout and primary voice template'}<select value={templateId} required disabled={!!busy} onChange={e=>{setTemplateId(e.target.value);setReferences(previous=>previous.filter(id=>id!==e.target.value));reset()}}><option value="">Choose a saved {label}</option>{letters.map(file=><option key={file._id} value={file._id}>{file.name}</option>)}</select></label>
      {!cleanup&&<label>Target role<select value={jobId} disabled={!!busy} onChange={e=>{setJobId(e.target.value);reset()}}><option value="">Paste role details below</option>{jobs.map(job=><option key={job._id} value={job._id}>{job.title}{job.company?` · ${job.company}`:''}</option>)}</select></label>}
      {!cleanup&&!jobId&&<label className="cover-generator-wide">Role and company details<textarea rows={5} value={role} minLength={20} maxLength={15000} required disabled={!!busy} onChange={e=>{setRole(e.target.value);reset()}} placeholder="Paste the role, company, and job description. Applicant facts must come from your documents."/></label>}
      {cleanup&&<label className="cover-generator-wide">Your cleanup comments<textarea rows={5} value={cleanupComments} maxLength={6000} required disabled={!!busy} onChange={e=>{setCleanupComments(e.target.value);reset()}} placeholder="For example: Fix grammar and punctuation, remove repeated wording, and make the second paragraph clearer. Keep my voice and the original formatting."/><small>{cleanupComments.length.toLocaleString()} / 6,000 characters</small></label>}
      {!cleanup&&<fieldset className="cover-generator-wide" disabled={!!busy}><legend>{isResume?'Previous resumes for supported facts, projects and phrasing (up to 5)':'Additional letters for voice and resumes for factual project details (up to 5)'}</legend>{sources.map(file=><label className="cover-generator-check" key={file._id}><input type="checkbox" checked={references.includes(file._id)} disabled={!references.includes(file._id)&&references.length>=5} onChange={e=>{setReferences(previous=>e.target.checked?[...previous,file._id]:previous.filter(id=>id!==file._id));reset()}}/>{file.name} · {file.tags.includes('resume')?'Resume':'Cover letter'}</label>)}{!sources.length&&<p>{isResume?'You can tailor using the template alone. Upload previous resumes to supply additional supported projects and phrasing.':'Add a resume or more letters to provide factual projects and additional voice examples.'}</p>}</fieldset>}
    </div><button type="submit" disabled={!!busy||!templateId||(cleanup&&!cleanupComments.trim())}>{busy==='generate'?generationStage||`Preparing your ${label}…`:isResume?'Tailor resume for this role':cleanup?'Clean up using my comments':'Generate using my existing phrases'}</button>{busy==='generate'&&<p role="status">{generationStage} Readable PDFs use text instead of slower vision processing.</p>}</form>
    {error&&<div ref={errorPanel}><CoverLetterError key={error.diagnostics.timestamp} error={error}/></div>}
    {draft&&<div className="cover-letter-draft"><h3>Review your {label}</h3><p>{draft.isWord?'Your original Word package, fonts, sizes, paragraph styles, margins, headers and layout settings are retained. Longer wording can naturally change line wrapping and pagination.':'Your original PDF stays intact. Replacements use its fonts, font sizes, character spacing and line positions. A line that is too long or has an unavailable original font must be corrected before saving. Original text is visually covered, not redacted.'}</p>
      <div className="cover-letter-writing-area">
        <div className="cover-letter-writing-toolbar"><span>{heading} draft</span><button type="button" disabled={!!busy} onClick={()=>{setChanges(draft.replacements);textRegions.current=letterRegions(draft.slots,draft.replacements,runs.current);setDraftText(letterText(textRegions.current));setReviewed(false)}}>Reset to generated draft</button></div>
        <label>Review and edit your {label}<textarea className="cover-letter-full-text" aria-describedby="cover-letter-edit-help" rows={22} maxLength={30000} value={draftText} disabled={!!busy} onChange={e=>{try{const updated=editLetter(textRegions.current,e.target.value);textRegions.current=textRegions.current.map((region,index)=>({...region,text:updated[index].text}));setDraftText(e.target.value);setChanges(updated);setReviewed(false);setError('')}catch(error){reportError(error,'Preserving template formatting')}}}/></label>
        <p id="cover-letter-edit-help">This is a text review, not a rendered layout preview. Edit within the existing text regions and keep paragraph breaks. Reused phrases update as you type. The saved document uses your uploaded template’s formatting.</p>
        <details><summary>Compare with original template</summary><textarea className="cover-letter-full-text" aria-label="Original template text" rows={14} readOnly value={letterText(letterRegions(draft.slots,[],runs.current))}/><button type="button" disabled={!!busy} onClick={()=>{textRegions.current=letterRegions(draft.slots,[],runs.current);setDraftText(letterText(textRegions.current));setChanges([]);setReviewed(false)}}>Use original wording</button></details>
      </div>
      {!!reusedPhrases.length&&<details open><summary>Reused phrases checked against your {isResume?'resumes':'letters'}</summary><p>These excerpts occur in both the current draft and the template or readable reference text. Case and whitespace are normalized for matching.</p><ul>{reusedPhrases.map((item,i)=><li key={i}><q>{item.quote}</q> — {item.source}</li>)}</ul></details>}
      {!!draft.evidence?.length&&<details><summary>{isResume?'Why these changes / factual source notes':draft.mode==='cleanup'?'Cleanup notes':'Factual source notes'}</summary>{isResume&&<p>These are AI-provided explanations. Check every skill, project and accomplishment against the cited resume before saving.</p>}<ul>{draft.evidence.map((item,i)=><li key={i}>{item}</li>)}</ul></details>}
      {!!draft.warnings?.length&&<div role="status"><h4>Information to review</h4><ul>{draft.warnings.map((item,i)=><li key={i}>{item}</li>)}</ul></div>}
      <label>New {label} name<input value={name} maxLength={120} disabled={!!busy} onChange={e=>setName(e.target.value)}/></label>
      <label className="cover-generator-check"><input type="checkbox" checked={reviewed} disabled={!!busy} onChange={e=>setReviewed(e.target.checked)}/>{draft.mode==='cleanup'?'I reviewed the cleanup against my comments and the original letter.':'I reviewed the voice, role details, and factual claims against my documents.'}</label>
      {!busy&&(!reviewed||!name.trim()||!draftText.trim())&&<p role="status">{!name.trim()?'Enter a name for the new copy.':!draftText.trim()?`Enter your ${label} text.`:'Select the review checkbox above to enable saving.'}</p>}
      <button type="button" disabled={!!busy||!reviewed||!name.trim()||!draftText.trim()} onClick={save}>{busy==='save'?'Saving…':'Save separate copy & open editor'}</button>
    </div>}
  </details>
}
