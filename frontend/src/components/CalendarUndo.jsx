import { useEffect, useRef, useState } from 'react'
import { isTyping } from '../lib/shortcuts'

export default function CalendarUndo({token,enabled=true,globalShortcut=false}){
  const [history,setHistory]=useState({canUndo:false,label:''}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const element=useRef(null),lock=useRef(false),latest=useRef(null)
  useEffect(()=>{
    if(!enabled)return
    const controller=new AbortController()
    let generation=0
    const load=async()=>{
      const current=++generation
      try{
        const response=await fetch('/api/calendar/history',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
        const data=await response.json().catch(()=>({}))
        if(!response.ok)throw new Error(data.message||'Calendar undo is unavailable. Update and restart the backend.')
        if(!controller.signal.aborted&&current===generation){setHistory(data);setError('')}
      }catch(error){if(!controller.signal.aborted)setError(error.message)}
    }
    load()
    window.addEventListener('calendar-changed',load)
    window.addEventListener('calendar-visibility-changed',load)
    return()=>{controller.abort();window.removeEventListener('calendar-changed',load);window.removeEventListener('calendar-visibility-changed',load)}
  },[token,enabled])
  const undo=async()=>{
    if(lock.current||!history.canUndo)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/calendar/undo',{method:'POST',headers:{Authorization:`Bearer ${token}`}})
      const data=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(data.message||'Could not undo the calendar change.')
      setNotice(data.message||'Calendar change undone.')
      window.dispatchEvent(new Event('calendar-changed'))
      window.dispatchEvent(new Event('calendar-visibility-changed'))
    }catch(error){setError(error.message)}finally{lock.current=false;setBusy(false)}
  }
  latest.current={undo,canUndo:history.canUndo}
  useEffect(()=>{
    if(!enabled)return
    const keydown=event=>{
      if(event.defaultPrevented||event.repeat||event.isComposing||isTyping(event.target)||event.altKey||event.shiftKey||!(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='z')return
      if(!globalShortcut&&!element.current?.closest('[data-calendar-undo]')?.contains(event.target))return
      if(!latest.current.canUndo)return
      event.preventDefault();event.stopImmediatePropagation();latest.current.undo()
    }
    window.addEventListener('keydown',keydown,true)
    return()=>window.removeEventListener('keydown',keydown,true)
  },[enabled,globalShortcut])
  return <div ref={element} className="calendar-undo"><button type="button" disabled={!enabled||busy||!history.canUndo} onClick={undo} title={history.canUndo?`Undo ${history.label} (Ctrl+Z / Cmd+Z)`:'No calendar changes to undo'}>{busy?'Undoing…':'Undo'}{history.canUndo?` ${history.label}`:''}</button>{error&&<span role="alert">{error}</span>}{notice&&<span role="status">{notice}</span>}</div>
}
