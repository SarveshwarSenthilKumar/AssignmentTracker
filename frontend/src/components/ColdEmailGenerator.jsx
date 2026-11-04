import {useEffect,useRef,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import {downloadBlob} from '../lib/documentFormats'
import './ColdEmailGenerator.css'

const initial={recipient:'',company:'',role:'',sender:'',goal:'',background:'',personalization:'',tone:'professional',documentId:'',writingSample:'',writingDocumentId:'',voicePreferences:''}
export default function ColdEmailGenerator({token,documents=[]}){
  const [fields,setFields]=useState(initial),[draft,setDraft]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false),request=useRef(null),output=useRef(null)
  useEffect(()=>()=>request.current?.abort(),[])
  const resumes=documents.filter(file=>!file.deletedAt&&file.tags?.includes('resume'))
  const writingDocuments=documents.filter(file=>!file.deletedAt&&!file.tags?.includes('resume'))
  const change=(key,value)=>setFields(previous=>({...previous,[key]:value}))
  const generate=async event=>{
    event.preventDefault();if(lock.current)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),100000)
    try{
      const response=await fetch('/api/cold-emails/generate',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(fields),signal:controller.signal}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not generate an email.')
      if(typeof data.subject!=='string'||typeof data.body!=='string')throw new Error('The email draft was incomplete. Try again.')
      setDraft(data);setNotice('Draft ready. Review the facts and edit before copying.');
      setTimeout(()=>{output.current?.scrollIntoView({block:'nearest'});output.current?.focus({preventScroll:true})},0)
    }catch(failure){setError(failure.name==='AbortError'?'Generation canceled or timed out. Your inputs and previous draft are preserved.':failure.message)}
    finally{clearTimeout(timeout);if(request.current===controller)request.current=null;lock.current=false;setBusy(false)}
  }
  const fullEmail=()=>`Subject: ${draft.subject}\n\n${draft.body}`
  const copy=async()=>{
    setError('');setNotice('')
    try{await navigator.clipboard.writeText(fullEmail());setNotice('Subject and email copied.')}catch{setError('Clipboard access is unavailable. Select the draft text to copy it, or download the text file.')}
  }
  const download=async()=>{
    try{await downloadBlob(new Blob([fullEmail()],{type:'text/plain;charset=utf-8'}),'cold-email.txt');setNotice('Email draft downloaded.')}catch(failure){setError(failure.message||'Could not download the email.')}
  }
  return <section className="cold-email-generator" aria-label="Cold email generator"><header><h2>Make the first introduction</h2><p>Draft an email for a recruiter, hiring manager, potential mentor, or new professional connection.</p></header>
    <p className="cold-email-note">Uses your Gemini settings. Your form details, pasted writing sample, and optional selected resume and writing document (with saved text edits) are sent to Gemini. Other account data and unsaved document edits are excluded. Drafts stay in this page until you copy or download them; leaving Prep or reloading clears them.</p>
    <form onSubmit={generate}><fieldset disabled={busy}><legend>Who are you reaching out to?</legend><div className="cold-email-grid">
      <label>Recipient name (optional)<input maxLength={120} value={fields.recipient} onChange={event=>change('recipient',event.target.value)} placeholder="Alex Chen"/></label>
      <label>Company or organization (optional)<input maxLength={160} value={fields.company} onChange={event=>change('company',event.target.value)} placeholder="Company name"/></label>
      <label>Target role or opportunity (optional)<input maxLength={160} value={fields.role} onChange={event=>change('role',event.target.value)} placeholder="Software engineering internship"/></label>
      <label>Your name (optional)<input maxLength={120} value={fields.sender} onChange={event=>change('sender',event.target.value)} placeholder="Your signoff name"/></label>
      <label>Tone<select value={fields.tone} onChange={event=>change('tone',event.target.value)}><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="direct">Short and direct</option></select></label>
      <label>Resume context (optional)<select value={fields.documentId} onChange={event=>change('documentId',event.target.value)}><option value="">Use only the details below</option>{resumes.map(file=><option key={file._id} value={file._id}>{file.name}</option>)}</select></label>
    </div>
    <label>What do you want to ask for?<textarea rows={3} required minLength={10} maxLength={3000} value={fields.goal} onChange={event=>change('goal',event.target.value)} placeholder="Ask for a 15-minute conversation about their team's work and upcoming internship opportunities."/></label>
    <label>Your relevant background (optional)<textarea rows={3} maxLength={6000} value={fields.background} onChange={event=>change('background',event.target.value)} placeholder="Your studies, projects, skills, and why you are a good fit. Add context not already in the selected resume."/></label>
    <label>Personalization or prior contact (optional)<textarea rows={3} maxLength={4000} value={fields.personalization} onChange={event=>change('personalization',event.target.value)} placeholder="Facts you know about the recipient or organization, where you met, or what you admire about a specific project. Include only details you can verify."/></label>
    <section className="cold-email-voice" aria-labelledby="cold-email-voice-heading"><h3 id="cold-email-voice-heading">Make it sound like you</h3><p className="cold-email-note">Your resume supplies facts. A short email, cover letter, or message you actually wrote helps match your sentence length, wording, and level of formality. Sample details won’t be reused as facts in the new email.</p>
      <label>Paste your writing (optional)<textarea rows={5} maxLength={6000} value={fields.writingSample} onChange={event=>change('writingSample',event.target.value)} placeholder="Paste an email or message you wrote, without quoted replies. A few natural paragraphs are enough. Remove details you don’t want to share."/></label>
      <label>Or use a saved writing sample (optional)<select value={fields.writingDocumentId} onChange={event=>change('writingDocumentId',event.target.value)}><option value="">No saved writing sample</option>{writingDocuments.map(file=><option key={file._id} value={file._id}>{file.name}</option>)}</select></label>
      <label>How do you want to sound? (optional)<input maxLength={1500} value={fields.voicePreferences} onChange={event=>change('voicePreferences',event.target.value)} placeholder="Short sentences, casual but respectful, contractions, no exclamation marks…"/></label>
      <p className="cold-email-note">If you supply both, the pasted sample takes priority. Without a sample, the generator uses a neutral approximation instead of claiming to know your voice.</p>
    </section>
    <button type="submit" disabled={busy}>{busy?'Writing your email…':draft?'Generate another draft':'Generate cold email'}</button></fieldset></form>
    {busy&&<button type="button" onClick={()=>request.current?.abort()}>Cancel generation</button>}
    {draft&&<section className="cold-email-draft" ref={output} tabIndex={-1} aria-label="Editable email draft"><h3>Your email draft</h3><p className="cold-email-note">Generating another draft replaces this version when successful. Copy or download edits you want to keep.</p>
      {draft.voiceSummary&&<p className="cold-email-note"><strong>Voice used:</strong> {draft.voiceSummary}</p>}
      <label>Subject<input maxLength={200} disabled={busy} value={draft.subject} onChange={event=>setDraft(previous=>({...previous,subject:event.target.value.replace(/[\r\n]/g,'')}))}/></label>
      <label>Email<textarea rows={13} maxLength={12000} disabled={busy} value={draft.body} onChange={event=>setDraft(previous=>({...previous,body:event.target.value}))}/></label>
      <div className="cold-email-actions"><button type="button" disabled={busy||!draft.body.trim()} onClick={copy}>Copy subject &amp; email</button><button type="button" disabled={busy||!draft.body.trim()} onClick={download}>Download .txt</button><button type="button" disabled={busy||!draft.body.trim()} onClick={()=>{if(draft.body.length>6000){setError('Copy a shorter excerpt into the writing sample field (up to 6,000 characters).');return}change('writingSample',draft.body);setNotice('Your edited draft is now the writing sample for the next generation.');setError('')}}>Use my edited draft as a writing sample</button></div>
      {!!draft.notes?.length&&<aside><h4>Before you send</h4><ul>{draft.notes.map((note,index)=><li key={index}>{note}</li>)}</ul></aside>}
      {draft.notices?.map((item,index)=><p className="cold-email-note" key={index}>{item}</p>)}
    </section>}
    {error&&<p className="cold-email-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>
}
