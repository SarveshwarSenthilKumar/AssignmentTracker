import {useRef,useState} from 'react'
import {Sun,Moon} from 'lucide-react'
import {useAuth} from '../contexts/AuthContext'
import {readApiJson} from '../lib/apiResponse'

export default function AppearanceSettings(){
  const {user,token,updatePreferences}=useAuth()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false),light=user?.themeMode==='light'
  const change=async enabled=>{
    if(lock.current)return
    const previous=light?'light':'dark',themeMode=enabled?'light':'dark'
    lock.current=true;setBusy(true);setError('');setNotice('');updatePreferences({themeMode})
    try{
      const response=await fetch('/api/account/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({themeMode})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not save appearance.')
      if(data.themeMode!==themeMode)throw new Error('Restart the updated backend before saving appearance settings.')
      updatePreferences({themeMode:data.themeMode});setNotice(`${enabled?'Light':'Dark'} mode saved to your account.`)
    }catch(failure){updatePreferences({themeMode:previous});setError(failure.message)}
    finally{lock.current=false;setBusy(false)}
  }
  return <section className="confirmation-settings appearance-settings" aria-label="Appearance" aria-busy={busy}><h3>Appearance</h3><p>Choose a comfortable look for the app. Your choice is saved to your account.</p><label><span><strong className="appearance-title">{light?<Sun size={17}/>:<Moon size={17}/>}Light mode</strong><small>{light?'Bright surfaces and dark text. Turn off for dark mode.':'Dark mode is active. Turn on for bright surfaces and dark text.'}</small></span><input type="checkbox" role="switch" checked={light} disabled={busy} onChange={event=>change(event.target.checked)}/></label><p>Document page colors and external websites use their own appearance controls.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</section>
}
