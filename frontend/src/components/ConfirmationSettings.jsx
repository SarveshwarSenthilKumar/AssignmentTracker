import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'

export default function ConfirmationSettings(){
  const {user,token,updatePreferences}=useAuth()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const change=async(key,value)=>{
    if(busy)return
    setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/account/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({[key]:value})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not save confirmation preferences.')
      if(data[key]!==value)throw new Error('The backend did not save this preference. Restart the updated backend and try again.')
      updatePreferences(data);setNotice('Confirmation preference saved.')
    }catch(error){setError(error.message)}finally{setBusy(false)}
  }
  return <section className="confirmation-settings"><h3>Action confirmations</h3><p>Choose when the app asks before proceeding. Changes save to your account.</p>{[
    ['confirmTaskDeletion','Confirm task deletion','Ask before deleting a task or a group of selected tasks.'],
    ['confirmOtherActions','Confirm other actions','Ask before other actions that use confirmation prompts, including personal calendar deletion and document actions.'],
  ].map(([key,title,description])=><label key={key}><span><strong>{title}</strong><small>{description}</small></span><input type="checkbox" role="switch" checked={user?.[key]!==false} disabled={busy} onChange={event=>change(key,event.target.checked)}/></label>)}<p className="confirmation-settings-note">When disabled, these actions happen immediately. Account reset still requires your password and RESET confirmation.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</section>
}
