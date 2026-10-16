import { useEffect, useRef, useState } from 'react'

export default function useTxstEvents(token, active=true) {
  const [campus,setCampus]=useState({events:[],syncing:true,progress:'Loading TXST events…',warning:'',updatedAt:null})
  const [revision,setRevision]=useState(0)
  const requested=useRef(false)
  const visibilityVersion=useRef(0)
  const mutation=useRef(false)
  useEffect(()=>{
    const changed=()=>{visibilityVersion.current++;setRevision(value=>value+1)}
    window.addEventListener('calendar-visibility-changed',changed)
    return()=>window.removeEventListener('calendar-visibility-changed',changed)
  },[])
  useEffect(()=>{
    if(!active)return
    const controller=new AbortController()
    let timer
    const force=requested.current
    requested.current=false
    const load=async(refresh=false)=>{
      const version=visibilityVersion.current
      try {
        const response=await fetch(refresh?'/api/calendar/txst-events/refresh':'/api/calendar/txst-events',{
          method:refresh?'POST':'GET',headers:{Authorization:`Bearer ${token}`},signal:controller.signal,
        })
        if(response.status===404)throw new Error('TXST calendar integration is unavailable. Restart or redeploy the backend to load the calendar update.')
        const data=await response.json()
        if(!response.ok)throw new Error(data.message||'Could not load TXST events.')
        if(!Array.isArray(data.events))throw new Error('Unexpected TXST calendar response. Make sure the frontend and backend are both updated.')
        if(controller.signal.aborted)return
        if(version!==visibilityVersion.current||mutation.current){timer=setTimeout(()=>load(),1000);return}
        setCampus(data)
        timer=setTimeout(()=>load(),data.syncing?3000:60000)
      } catch(error) {
        if(controller.signal.aborted)return
        setCampus(previous=>({...previous,syncing:false,progress:'',warning:error.message}))
        timer=setTimeout(()=>load(),60000)
      }
    }
    load(force)
    return()=>{controller.abort();clearTimeout(timer)}
  },[token,active,revision])
  const refreshCampus=()=>{
    requested.current=true
    setCampus(previous=>({...previous,syncing:true,warning:'',progress:'Refreshing TXST events…'}))
    setRevision(value=>value+1)
  }
  const changeVisibility=async(action,id)=>{
    // Single removal always carries exactly one stable event ID; name matching
    // is only allowed through the explicit, reviewed batch action.
    if(action==='hide'&&(typeof id!=='string'||!id))throw new Error('Select one event to remove.')
    if(action==='hide-many'&&(!Array.isArray(id)||!id.length))throw new Error('Select the matching events to remove.')
    if(mutation.current)throw new Error('A calendar change is still saving. Try again in a moment.')
    mutation.current=true
    visibilityVersion.current++
    const previousPreferences={hiddenCalendarIds:campus.hiddenCalendarIds||[],hideTxstEvents:!!campus.hideTxstEvents}
    setCampus(previous=>({...previous,
      hiddenCalendarIds:action==='restore'?[]:['hide','hide-many'].includes(action)?[...new Set([...(previous.hiddenCalendarIds||[]),...(action==='hide-many'?id:[id])])]:previous.hiddenCalendarIds||[],
      hideTxstEvents:action==='restore'?false:action==='hide-txst'?true:!!previous.hideTxstEvents,
    }))
    try {
      const response=await fetch('/api/calendar/visibility',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(action==='hide-many'?{action,ids:id}:{action,id}),signal:AbortSignal.timeout(20000)})
      const data=await response.json().catch(()=>({}))
      if(response.status===404)throw new Error('The backend is missing the event removal update. Restart or redeploy the backend, then try again.')
      if(!response.ok)throw new Error(data.message||'Could not update calendar visibility.')
      if(!Array.isArray(data.hiddenCalendarIds)||typeof data.hideTxstEvents!=='boolean')throw new Error('The server did not confirm the event removal. Update the backend and try again.')
      visibilityVersion.current++
      setCampus(previous=>({...previous,...data}))
      window.dispatchEvent(new Event('calendar-visibility-changed'))
    } catch(error) {
      setCampus(previous=>({...previous,...previousPreferences}))
      throw error
    } finally {mutation.current=false}
  }
  return {campus,refreshCampus,changeVisibility}
}
