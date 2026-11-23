import {useRef,useState} from 'react'
import {useAuth} from '../contexts/AuthContext'
import {readApiJson} from '../lib/apiResponse'

export default function SetupBannerSettings(){
  const {user,token,updatePreferences}=useAuth()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false)
  const change=async enabled=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/account/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({showSetupBanner:enabled})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not save the setup banner preference.')
      if(data.showSetupBanner!==enabled)throw new Error('Restart the updated backend and try saving this preference again.')
      updatePreferences(data)
      setNotice(enabled?'Setup banner enabled.':'Setup banner and checklist shortcut hidden.')
    }catch(error){setError(error.message)}finally{lock.current=false;setBusy(false)}
  }
  return <section className="confirmation-settings" aria-label="Setup banner settings">
    <h3>Setup reminders</h3><p>Choose whether setup reminders appear at the top of the app. This preference saves to your account.</p>
    <label><span><strong>Show setup banner</strong><small>Show the API key reminder and setup checklist. Turn off to hide both the banner and its shortcut.</small></span><input type="checkbox" role="switch" checked={user?.showSetupBanner!==false} disabled={busy} onChange={event=>change(event.target.checked)}/></label>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>
}
