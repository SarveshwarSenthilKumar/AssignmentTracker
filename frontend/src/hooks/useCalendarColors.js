import { useEffect, useRef, useState } from 'react'

export default function useCalendarColors(token,active=true){
  const [colors,setColors]=useState({}),[revision,setRevision]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const lock=useRef(false)
  useEffect(()=>{setColors({});setError('')},[token])
  useEffect(()=>{const changed=()=>setRevision(value=>value+1);window.addEventListener('calendar-changed',changed);return()=>window.removeEventListener('calendar-changed',changed)},[])
  useEffect(()=>{
    if(!active)return
    const controller=new AbortController();setLoading(true)
    fetch('/api/calendar/colors',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.message||'Could not load colors.')
      if(!controller.signal.aborted){setColors(data.colors||{});setError('')}
    }).catch(error=>{if(error.name!=='AbortError')setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,active,revision])
  const changeColor=async(id,color)=>{
    if(lock.current)throw new Error('A color change is still saving.')
    lock.current=true
    try{
      const response=await fetch('/api/calendar/colors',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({id,color})})
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.message||'Could not save the color.')
      setColors(previous=>{const next={...previous};if(data.color)next[id]=data.color;else delete next[id];return next})
      window.dispatchEvent(new Event('calendar-changed'))
    }finally{lock.current=false}
  }
  return {colors,changeColor,loading,error}
}
