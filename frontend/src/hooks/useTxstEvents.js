import { useEffect, useRef, useState } from 'react'

export default function useTxstEvents(token, active=true) {
  const [campus,setCampus]=useState({events:[],syncing:true,progress:'Loading TXST events…',warning:'',updatedAt:null})
  const [revision,setRevision]=useState(0)
  const requested=useRef(false)
  useEffect(()=>{
    if(!active)return
    const controller=new AbortController()
    let timer
    const force=requested.current
    requested.current=false
    const load=async(refresh=false)=>{
      try {
        const response=await fetch(refresh?'/api/calendar/txst-events/refresh':'/api/calendar/txst-events',{
          method:refresh?'POST':'GET',headers:{Authorization:`Bearer ${token}`},signal:controller.signal,
        })
        if(response.status===404)throw new Error('TXST calendar integration is unavailable. Restart or redeploy the backend to load the calendar update.')
        const data=await response.json()
        if(!response.ok)throw new Error(data.message||'Could not load TXST events.')
        if(!Array.isArray(data.events))throw new Error('Unexpected TXST calendar response. Make sure the frontend and backend are both updated.')
        if(controller.signal.aborted)return
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
  return {campus,refreshCampus}
}
