import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { deviceTimeZone } from '../lib/timeZone'
import { detectIPTimeZone, searchCityTimeZones } from '../lib/timeZoneLookup'

export default function TimeZoneSettings() {
  const {user,token,updatePreferences}=useAuth()
  const [choice,setChoice]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const [city,setCity]=useState(''),[results,setResults]=useState([]),[looking,setLooking]=useState('')
  const controller=useRef(null),lookupLock=useRef(false)
  useEffect(()=>()=>controller.current?.abort(),[])
  const value=choice??user?.timeZone??''
  const zones=[...new Set(['UTC',deviceTimeZone(),user?.timeZone,value,...(Intl.supportedValuesOf?.('timeZone')||[])].filter(Boolean))].sort()
  const choosePlace=place=>{setChoice(place.timeZone);setResults([]);setError('');setMessage(`${place.label} · ${place.timeZone}. Save to apply this time zone.`)}
  const find=async kind=>{
    if(lookupLock.current||busy)return
    lookupLock.current=true;controller.current=new AbortController();setLooking(kind);setError('');setMessage('');setResults([])
    const timeout=setTimeout(()=>controller.current?.abort(),12000)
    try {
      if(kind==='city') {
        const places=await searchCityTimeZones(city,{signal:controller.current.signal})
        setResults(places);setMessage(places.length?'Choose the matching city below.':'No matching cities found. Try a nearby city or choose a time zone manually.')
      } else choosePlace(await detectIPTimeZone({signal:controller.current.signal}))
    } catch(error){if(!controller.current.signal.aborted)setError(error.message);else setError('The lookup timed out. Try again or choose a time zone manually.')}
    finally{clearTimeout(timeout);lookupLock.current=false;setLooking('')}
  }
  const save=async event=>{
    event.preventDefault();setBusy(true);setError('');setMessage('')
    try {
      const response=await fetch('/api/account/preferences',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({timeZone:value})})
      const data=await response.json()
      if(!response.ok)throw new Error(data.message||'Could not save your time zone.')
      updatePreferences(data);setChoice(null);setMessage('Time zone saved.')
    } catch(error){setError(error.message)} finally{setBusy(false)}
  }
  return <form onSubmit={save} className="p-4 bg-white/5 rounded-xl border border-white/10 mb-6">
    <label htmlFor="account-time-zone" className="block text-white font-semibold mb-2">Time zone</label>
    <p className="text-slate-400 text-sm mb-3">Used for calendar times, task deadlines, and deadline charts. All-day dates stay the same.</p>
    <div className="mb-4">
      <label htmlFor="account-time-zone-city" className="block text-slate-300 text-sm mb-2">Find by city</label>
      <div className="flex gap-2"><input id="account-time-zone-city" type="text" autoComplete="off" maxLength={100} placeholder="e.g. Chicago or London" value={city} disabled={busy||!!looking} onChange={event=>{setCity(event.target.value);setResults([]);setMessage('')}} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();find('city')}}} className="min-w-0 flex-1 bg-slate-800 text-white border border-white/10 rounded-lg p-2"/><button type="button" disabled={busy||!!looking||city.trim().length<2} onClick={()=>find('city')} className="px-3 py-2 bg-slate-800 text-white border border-white/10 rounded-lg disabled:opacity-50">{looking==='city'?'Searching…':'Search'}</button></div>
      {results.length>0&&<ul aria-label="Matching cities" className="mt-2 space-y-1">{results.map(place=><li key={place.id}><button type="button" disabled={busy||!!looking} onClick={()=>choosePlace(place)} className="w-full text-left p-2 bg-slate-800 text-slate-200 border border-white/10 rounded-lg"><span className="block text-sm">{place.label}</span><span className="block text-xs text-slate-400">{place.timeZone}</span></button></li>)}</ul>}
      <button type="button" disabled={busy||!!looking} onClick={()=>find('ip')} className="mt-3 px-3 py-2 bg-slate-800 text-white border border-white/10 rounded-lg disabled:opacity-50">{looking==='ip'?'Detecting…':'Detect from IP'}</button>
      <p className="mt-2 text-xs text-slate-400">City searches use Open-Meteo. IP detection sends your public IP to ipapi.co when selected. VPNs and network routing may affect the result.</p>
    </div>
    <select id="account-time-zone" value={value} disabled={busy||!!looking} onChange={event=>{setChoice(event.target.value);setMessage('');setResults([])}} className="w-full bg-slate-800 text-white border border-white/10 rounded-lg p-2">
      <option value="">Automatic · {deviceTimeZone()}</option>
      {zones.map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}
    </select>
    <button disabled={busy||!!looking||value===(user?.timeZone||'')} className="mt-3 px-3 py-2 bg-slate-800 text-white border border-white/10 rounded-lg disabled:opacity-50">{busy?'Saving…':'Save time zone'}</button>
    {message&&<p role="status" className="text-slate-300 text-sm mt-2">{message}</p>}
    {error&&<p role="alert" className="text-red-300 text-sm mt-2">{error}</p>}
  </form>
}
