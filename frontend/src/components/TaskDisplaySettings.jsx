import {useRef,useState} from 'react'
import {useAuth} from '../contexts/AuthContext'
import {readApiJson} from '../lib/apiResponse'

export default function TaskDisplaySettings(){
  const {user,token,updatePreferences}=useAuth()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false)
  const change=async value=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/account/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({showInProgressColumn:value})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not save task display settings.')
      if(data.showInProgressColumn!==value)throw new Error('Restart the updated backend, then try saving this setting again.')
      updatePreferences(data);setNotice('Task display preference saved.')
    }catch(err){setError(err.message)}finally{lock.current=false;setBusy(false)}
  }
  return <section className="confirmation-settings"><h3>Task display</h3><p>Customize the layout of your Tasks page. Changes save to your account.</p><label><span><strong>Show In Progress column</strong><small>Turn off to use two columns. In-progress tasks remain visible with To Do tasks and keep their status.</small></span><input type="checkbox" role="switch" checked={user?.showInProgressColumn!==false} disabled={busy} onChange={event=>change(event.target.checked)}/></label>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</section>
}
