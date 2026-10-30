import {useRef,useState} from 'react'
import {MessageSquare,History} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'

export default function PolicySupport({token}){
  const [panel,setPanel]=useState(null),[message,setMessage]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('')
  const lock=useRef(false),submission=useRef(crypto.randomUUID())
  const send=async event=>{
    event.preventDefault();if(lock.current)return
    lock.current=true;setBusy(true);setNotice('')
    try{
      const response=await fetch('/api/account/policies/contact',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({message,contactEmail:email,submissionId:submission.current})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not send your message.')
      setMessage('');submission.current=crypto.randomUUID();setNotice(`Message saved for authorized reviewers. Reference: ${data.id}. This does not automatically send email.`)
    }catch(error){setNotice(error.message)}finally{lock.current=false;setBusy(false)}
  }
  return <div className="policy-support">
    <div className="policy-support-actions"><button type="button" aria-expanded={panel==='contact'} aria-controls="policy-contact" onClick={()=>setPanel(panel==='contact'?null:'contact')}><MessageSquare size={16}/>Contact developers</button><button type="button" aria-expanded={panel==='changes'} aria-controls="policy-changes" onClick={()=>setPanel(panel==='changes'?null:'changes')}><History size={16}/>See changes from previous version</button></div>
    {panel==='changes'&&<section id="policy-changes" className="policy-support-panel"><h3>Version 1.5 compared with 1.4</h3><p>Updated October 30, 2026. Summary of changes to both policies:</p><ul><li>Current users must review and accept the current policies when either accepted version becomes outdated.</li><li>Workspace access is paused until agreement is saved. Reading the policies and signing out remain available.</li><li>The platform records acceptance versions, timestamps and methods for both documents.</li></ul><p>The extensive AI-processing disclosures introduced in version 1.4 remain in place. This is a summary; review both full documents before agreeing.</p></section>}
    {panel==='contact'&&<form id="policy-contact" className="policy-support-panel" onSubmit={send}><h3>Contact developers</h3><p>Send a private policy question to the platform’s authorized feedback reviewers. You can send it before accepting the policies. Do not include passwords, API keys or sensitive documents.</p><label>Contact email (optional)<input type="email" maxLength={254} value={email} disabled={busy} onChange={event=>{setEmail(event.target.value);submission.current=crypto.randomUUID()}}/></label><label>Your message<textarea required maxLength={6000} rows={5} value={message} disabled={busy} onChange={event=>{setMessage(event.target.value);submission.current=crypto.randomUUID()}}/></label><button type="submit" disabled={busy||!message.trim()}>{busy?'Sending…':'Send message'}</button>{notice&&<p role="status">{notice}</p>}</form>}
  </div>
}
