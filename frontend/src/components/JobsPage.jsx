import {useEffect,useRef,useState} from 'react'
import {Link2,Save,Trash2,ArrowUpRight,Loader2} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import './JobsPage.css'
import JobFileImport from './JobFileImport'

const labels={title:'Job title',company:'Company',location:'Location / remote',employmentType:'Employment type',salary:'Salary',datePosted:'Date posted',validThrough:'Closing date',description:'Description',requirements:'Requirements / skills',responsibilities:'Responsibilities',benefits:'Benefits'}
const long=new Set(['description','requirements','responsibilities','benefits'])
const isHandshake=value=>{try{const host=new URL(value).hostname;return host==='joinhandshake.com'||host.endsWith('.joinhandshake.com')}catch{return false}}
const empty={url:'',...Object.fromEntries(Object.keys(labels).map(key=>[key,''])),source:'Manual entry'}
export default function JobsPage({token}){
  const [jobs,setJobs]=useState([]),[draft,setDraft]=useState({...empty}),[busy,setBusy]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const [pastedText,setPastedText]=useState(''),[needsHandshakeText,setNeedsHandshakeText]=useState(false)
  const pastePanel=useRef(null),pasteInput=useRef(null)
  const lock=useRef(false),fileController=useRef(null)
  const [fileProgress,setFileProgress]=useState(null),[selectionField,setSelectionField]=useState('title')
  useEffect(()=>()=>fileController.current?.abort(),[])
  useEffect(()=>{
    if(!needsHandshakeText||busy)return
    if(pastePanel.current)pastePanel.current.open=true
    pasteInput.current?.focus({preventScroll:true})
    pastePanel.current?.scrollIntoView({behavior:'auto',block:'nearest'})
  },[needsHandshakeText,busy])
  const request=async(url,options={})=>{
    const response=await fetch(url,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},cache:'no-store'})
    const data=await readApiJson(response);if(!response.ok){const error=new Error(data.message||'Could not complete this job action.');error.code=data.code;throw error}return data
  }
  useEffect(()=>{let canceled=false;setLoading(true);setJobs([]);request('/api/jobs').then(data=>{if(!canceled)setJobs(data)}).catch(e=>{if(!canceled)setError(e.message)}).finally(()=>{if(!canceled)setLoading(false)});return()=>{canceled=true}},[token])
  const run=async(kind,action)=>{if(lock.current)return;lock.current=true;setBusy(kind);setError('');setNotice('');try{await action()}catch(e){if(e.name==='AbortError'){setNotice('File import canceled.');return}setError(e.message);if(e.code==='HANDSHAKE_ACCESS_REQUIRED'){setNeedsHandshakeText(true);if(pastePanel.current)pastePanel.current.open=true;pasteInput.current?.focus({preventScroll:true});pastePanel.current?.scrollIntoView({behavior:'auto',block:'nearest'})}}finally{lock.current=false;setBusy('')}}
  const extract=event=>{event.preventDefault();run('extract',async()=>{const data=await request('/api/jobs/extract',{method:'POST',body:JSON.stringify({url:draft.url})});setNeedsHandshakeText(false);setDraft({...empty,...data});setNotice([`Imported using ${data.source||'page content'}. Review the details before saving.`,...(data.warnings||[])].join(' '))})}
  const importFile=file=>run('file',async()=>{
    const controller=new AbortController();fileController.current=controller;setFileProgress({message:'Reading file locally…'})
    try{
      const {readLocalJobFile}=await import('../lib/localJobFile')
      const extracted=await readLocalJobFile(file,{signal:controller.signal,onProgress:setFileProgress})
      setPastedText(extracted.text)
      setFileProgress({message:'Finding job fields in extracted text…'})
      const data=await request('/api/jobs/extract',{method:'POST',body:JSON.stringify({url:draft.url,text:extracted.text,method:extracted.method,layout:extracted.layout}),signal:controller.signal})
      setNeedsHandshakeText(false);setDraft({...empty,...data});setNotice([`Imported using ${data.source}. No AI tokens used. Review the draft before saving.`,...extracted.warnings,...(data.warnings||[])].join(' '))
    }finally{fileController.current=null;setFileProgress(null)}
  })
  const save=event=>{event.preventDefault();run('save',async()=>{const data=await request('/api/jobs',{method:'POST',body:JSON.stringify(draft)});setJobs(previous=>[data,...previous]);setDraft({...empty});setNotice('Job saved to your account.')})}
  const assignSelectedText=()=>{
    const area=pasteInput.current,value=area?.value.slice(area.selectionStart,area.selectionEnd).trim()
    if(!value){setError('Highlight the exact text in the recognized-text box first, then choose a field.');return}
    const max=long.has(selectionField)?selectionField==='benefits'?10000:30000:selectionField==='location'?1000:['salary','employmentType'].includes(selectionField)?500:['datePosted','validThrough'].includes(selectionField)?100:300
    if(value.length>max){setError(`Select less text for ${labels[selectionField]}.`);return}
    setDraft(previous=>({...previous,[selectionField]:value,fieldEvidence:{...previous.fieldEvidence,[selectionField]:{status:'manual',source:value}}}));setError('');setNotice(`Selected text assigned to ${labels[selectionField]}.`)
  }
  return <section className="jobs-page" aria-label="Jobs for your resumes">
    <nav className="jobs-tabs" aria-label="Resume tools"><a href="#/resumes">Your resumes</a><a href="#/cover-letters">Cover letters</a><a href="#/jobs" aria-current="page">Saved jobs</a></nav>
    <header><div><h2>Jobs &amp; posting details</h2><p>Import a direct job link, review the details, and keep it alongside your resumes.</p></div><span>{jobs.length} saved</span></header>
    <form className="jobs-import" onSubmit={extract}><label htmlFor="job-url">Job posting URL<input id="job-url" type="url" value={draft.url} maxLength={2048} onChange={e=>{setDraft(previous=>({...previous,url:e.target.value}));setNeedsHandshakeText(false)}} placeholder="https://company.com/careers/job…" disabled={!!busy} required/></label><button disabled={!!busy} type="submit">{busy==='extract'?<Loader2 size={16} className="animate-spin"/>:<Link2 size={16}/>}Get job details</button></form>
    <JobFileImport busy={busy} onImport={importFile} progress={fileProgress} onCancel={()=>fileController.current?.abort()}/>
    <p className="jobs-help">Imports try public posting APIs, structured data, embedded page data, and readable page content. For sites that require sign-in or block access, open the posting and paste its text below. Link and copied-text imports do not require AI; image/PDF extraction also uses local text reading and OCR without AI.</p>
    {isHandshake(draft.url)&&<div className="jobs-handshake-help"><strong>Handshake job import</strong><p>Use a direct job link from Handshake. Public postings import automatically when readable. For school-only postings, open the link while signed in, copy the title and full job details, and import the copied text below.</p><a href={draft.url} target="_blank" rel="noopener noreferrer">Open posting in Handshake</a>{needsHandshakeText&&<p role="status">This posting needs copied text. The import panel is open below.</p>}</div>}
    <details ref={pastePanel} className="jobs-paste"><summary>Review recognized text or import copied job text</summary><label htmlFor="job-pasted-text">Full source text (you can correct OCR errors here, then extract again)<textarea ref={pasteInput} id="job-pasted-text" value={pastedText} maxLength={60000} rows={8} disabled={!!busy} onChange={event=>setPastedText(event.target.value)} placeholder="Paste the job title, company, location, requirements and description…"/></label><button type="button" disabled={!!busy||pastedText.trim().length<100} onClick={()=>run('paste',async()=>{const data=await request('/api/jobs/extract',{method:'POST',body:JSON.stringify({url:draft.url,text:pastedText})});setNeedsHandshakeText(false);setDraft({...empty,...data});setNotice(`${data.source||'Copied job text'} imported. Review the title and fields before saving.`)})}>{busy==='paste'?'Reading text…':'Extract from this text'}</button><div className="jobs-text-assignment"><label>Assign highlighted text to<select value={selectionField} disabled={!!busy} onChange={event=>setSelectionField(event.target.value)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button type="button" disabled={!!busy||!pastedText} onClick={assignSelectedText}>Use highlighted text</button></div><p>Select an exact value in the text box to fill a field directly. This bypasses uncertain automatic matches.</p></details>
    {error&&<p className="jobs-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {!!draft.fieldEvidence&&<details className="jobs-evidence"><summary>Why these fields were filled</summary><dl>{Object.entries(draft.fieldEvidence).filter(([field])=>labels[field]).map(([field,item])=><div key={field}><dt>{labels[field]} · {item.status==='conflicting'?'Conflicting values — left blank':item.status==='uncertain'?'Low OCR confidence — left blank':item.status==='suggested'?'Suggested — verify':item.status==='manual'?'Your selection / edit':'Matched source'}</dt><dd>{item.source}</dd></div>)}</dl></details>}
    <details className="jobs-draft" open><summary>Review or enter job details</summary><form onSubmit={save}><div className="jobs-fields">{Object.entries(labels).map(([key,label])=><label key={key} className={long.has(key)?'is-long':''}>{label}{long.has(key)?<textarea value={draft[key]} rows={key==='description'?7:3} maxLength={key==='benefits'?10000:30000} onChange={e=>setDraft(previous=>({...previous,[key]:e.target.value,fieldEvidence:{...previous.fieldEvidence,[key]:{status:'manual',source:e.target.value}}}))} disabled={!!busy}/>:<input value={draft[key]} maxLength={key==='location'?1000:key==='employmentType'||key==='salary'?500:key==='datePosted'||key==='validThrough'?100:300} onChange={e=>setDraft(previous=>({...previous,[key]:e.target.value,fieldEvidence:{...previous.fieldEvidence,[key]:{status:'manual',source:e.target.value}}}))} required={key==='title'} disabled={!!busy}/>}</label>)}</div><div className="jobs-actions"><button type="submit" disabled={!!busy||!draft.title.trim()}><Save size={16}/>{busy==='save'?'Saving…':'Save job'}</button><button type="button" disabled={!!busy} onClick={()=>{setDraft({...empty});setError('');setNotice('')}}>Clear form</button></div></form></details>
    <div className="jobs-list">{loading?<p role="status">Loading saved jobs…</p>:!jobs.length?<p>No jobs saved yet. Import a link or add a posting manually.</p>:jobs.map(job=><article key={job._id}><header><div><h3>{job.title}</h3><p>{[job.company,job.location].filter(Boolean).join(' · ')}</p></div><div className="jobs-actions">{job.url&&<a href={job.url} target="_blank" rel="noopener noreferrer"><ArrowUpRight size={15}/>Original posting</a>}<button type="button" disabled={!!busy} aria-label={`Remove ${job.title}`} onClick={()=>run(job._id,async()=>{await request(`/api/jobs/${job._id}`,{method:'DELETE'});setJobs(previous=>previous.filter(item=>item._id!==job._id));setNotice('Saved job removed.')})}><Trash2 size={15}/></button></div></header><dl>{['employmentType','salary','datePosted','validThrough'].filter(key=>job[key]).map(key=><div key={key}><dt>{labels[key]}</dt><dd>{job[key]}</dd></div>)}</dl><details><summary>View full details</summary>{[...long].filter(key=>job[key]).map(key=><section key={key}><h4>{labels[key]}</h4><p className="jobs-description">{job[key]}</p></section>)}<small>Source: {job.source||'Manual entry'} · Saved {new Date(job.createdAt).toLocaleDateString()}</small></details></article>)}</div>
  </section>
}
