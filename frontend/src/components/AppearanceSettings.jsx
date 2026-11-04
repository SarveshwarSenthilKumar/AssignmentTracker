import {useRef,useState} from 'react'
import {Sun,Moon,Monitor} from 'lucide-react'
import {useAuth} from '../contexts/AuthContext'
import {readApiJson} from '../lib/apiResponse'

export default function AppearanceSettings(){
  const {user,token,updatePreferences}=useAuth()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false),mode=['light','system'].includes(user?.themeMode)?user.themeMode:'dark'
  const labels={light:'Light',dark:'Dark',system:'Match device'}
  const change=async themeMode=>{
    if(lock.current)return
    const previous=mode
    lock.current=true;setBusy(true);setError('');setNotice('');updatePreferences({themeMode})
    try{
      const response=await fetch('/api/account/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({themeMode})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not save appearance.')
      if(data.themeMode!==themeMode)throw new Error('Restart the updated backend before saving appearance settings.')
      updatePreferences({themeMode:data.themeMode});setNotice(`${labels[themeMode]} mode saved to your account.`)
    }catch(failure){updatePreferences({themeMode:previous});setError(failure.message)}
    finally{lock.current=false;setBusy(false)}
  }
  return <section className="confirmation-settings appearance-settings" aria-label="Appearance" aria-busy={busy}><h3>Appearance</h3><p>Choose a comfortable look for the app. Your choice is saved to your account.</p><label><span><strong className="appearance-title">{mode==='system'?<Monitor size={17}/>:mode==='light'?<Sun size={17}/>:<Moon size={17}/>}Color mode</strong><small>{mode==='system'?'Automatically follows this device’s light or dark setting, including changes while the app is open.':'Choose a fixed appearance or match this device’s settings.'}</small></span><select value={mode} disabled={busy} onChange={event=>change(event.target.value)}><option value="dark">Dark</option><option value="light">Light</option><option value="system">Match device</option></select></label><p>Document page colors and external websites use their own appearance controls.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</section>
}
