import { useEffect, useRef, useState } from 'react'
import { readApiJson } from '../lib/apiResponse'
import './AccountAIAccess.css'

const groups=[
  ['Workspace information',[
    ['profile','Account profile','Username, email, time zone, and Canvas connection status.'],
    ['tasks','Tasks and task folders','Task names, descriptions, deadlines, progress, and dependencies.'],
    ['calendar','Calendar','Personal calendar entries, meeting details, notes, and locations.'],
    ['documentLibrary','Document library index','File names, folders, and document/task associations. File contents have separate controls below.'],
  ]],
  ['Files and notes',[
    ['resumes','Resumes and cover letters','Resume and cover-letter files and their library entries.'],
    ['notes','Notes','Files tagged as notes, including handwritten notebooks and imported OneNote documents.'],
    ['documentFiles','Other documents and attachments','Other PDFs, Word files, spreadsheets, images, and supported attached media.'],
  ]],
  ['Context and editor access',[
    ['screen','Visible screen text','Share visible text and form values. Disabled automatically while any workspace/file category above, or live editor reading, is restricted.'],
    ['history','Previous conversation messages','Reuse earlier chat messages. Restricted categories also disable resending past messages to avoid sharing earlier copies of that data.'],
    ['editorRead','Read the live editor','Share supported live PDF/text content, including unsaved edits. Saved file access remains governed by its file category.'],
    ['editorWrite','Edit the open document','Apply requested changes through the PDF or plain-text notes editor. Also requires live editor reading and access to that file category.'],
  ]],
  ['Additional AI features',[
    ['generation','AI document generation','Generate document drafts from prompts you enter.'],
    ['recognition','AI handwriting and math recognition','Send a selected calculation image to AI, including crops from notes or resumes. This is a separate permission from file access.'],
  ]],
]
export default function AccountAIAccess({token}){
  const [access,setAccess]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false)
  const load=async()=>{setError('');try{const response=await fetch('/api/account/ai-access',{headers:{Authorization:`Bearer ${token}`}}),data=await readApiJson(response);if(!response.ok)throw new Error(data.message||'Could not load AI access.');setAccess(data)}catch(err){setError(err.message)}}
  useEffect(()=>{load()},[token])
  const change=async changes=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{const response=await fetch('/api/account/ai-access',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(changes)}),data=await readApiJson(response);if(!response.ok)throw new Error(data.message||'Could not save AI access.');setAccess(data);window.dispatchEvent(new CustomEvent('ai-access-changed',{detail:data}));setNotice('AI access saved to your account. Applies to new requests.')}catch(err){setError(err.message)}finally{lock.current=false;setBusy(false)}
  }
  const toggle=([key,title,description])=><label key={key} className="ai-access-option"><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" role="switch" checked={access[key]} disabled={busy||(key!=='enabled'&&!access.enabled)} onChange={event=>change({[key]:event.target.checked})}/></label>
  return <section className="account-ai-access" aria-labelledby="ai-access-title"><header><div><h3 id="ai-access-title">AI access</h3><p>Choose what the assistant can read and change. These account rules override chat context toggles.</p></div></header>
    {!access&&!error&&<p role="status">Loading AI access…</p>}
    {access&&<>{toggle(['enabled','Enable AI features','Turn off to block assistant chat, AI document generation, and AI handwriting recognition.'])}<div className="ai-access-groups">{groups.map(([title,options])=><fieldset key={title}><legend>{title}</legend>{options.map(toggle)}</fieldset>)}</div><p className="ai-access-note">Only explicitly attached files and an included open file share their contents. Changing access does not erase saved chats or recall data already sent. Text you type or paste into your next prompt is still sent as your message.</p></>}
    {error&&<p className="ai-access-error" role="alert">{error} <button type="button" disabled={busy} onClick={load}>Retry</button></p>}{notice&&<p role="status" className="ai-access-note">{notice}</p>}
  </section>
}
