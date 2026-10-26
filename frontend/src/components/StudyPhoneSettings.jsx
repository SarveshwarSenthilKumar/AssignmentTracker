import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'

export default function StudyPhoneSettings(){
  const {user,token,updatePreferences}=useAuth()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false)
  const change=async enabled=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/account/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({studyPhoneEnabled:enabled})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not save the Study Phone preference.')
      if(data.studyPhoneEnabled!==enabled)throw new Error('Restart the updated backend and try saving this preference again.')
      updatePreferences(data);setNotice(enabled?'Study Phone enabled. Use Phone in the editor or Alt + P.':'Study Phone disabled. Its buttons and shortcut are hidden or inactive.')
    }catch(error){setError(error.message)}finally{lock.current=false;setBusy(false)}
  }
  return <section className="confirmation-settings" aria-label="Study Phone settings"><h3>Study Phone</h3><p>Choose whether the phone companion is available beside PDFs and notes. This preference saves to your account.</p><label><span><strong>Enable Study Phone</strong><small>Show Phone controls and enable Alt + P. Turning this off closes the phone and stops its timer; your saved scratchpad is kept.</small></span><input type="checkbox" role="switch" checked={user?.studyPhoneEnabled!==false} disabled={busy} onChange={event=>change(event.target.checked)}/></label>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</section>
}
