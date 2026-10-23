import {useEffect,useState} from 'react'
import {Clock} from 'lucide-react'
import {activeTimeZone} from '../lib/timeZone'

export default function PDFEditorClock(){
  const [now,setNow]=useState(()=>new Date())
  useEffect(()=>{
    const update=()=>setNow(new Date())
    const timer=setInterval(update,1000)
    document.addEventListener('visibilitychange',update)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update)}
  },[])
  const zone=activeTimeZone()
  const label=now.toLocaleTimeString(undefined,{timeZone:zone,hour:'numeric',minute:'2-digit'})
  return <time className="pdf-editor-clock" dateTime={now.toISOString()} title={`${now.toLocaleDateString(undefined,{timeZone:zone,dateStyle:'full'})} · ${zone}`} aria-label={`Current time: ${label}`}><Clock size={14} aria-hidden="true"/>{label}</time>
}
