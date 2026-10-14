import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { deviceTimeZone } from '../lib/timeZone'

export default function TimeZoneSettings() {
  const {user,token,updatePreferences}=useAuth()
  const [choice,setChoice]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const value=choice??user?.timeZone??''
  const zones=[...new Set(['UTC',deviceTimeZone(),user?.timeZone,...(Intl.supportedValuesOf?.('timeZone')||[])].filter(Boolean))].sort()
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
    <select id="account-time-zone" value={value} disabled={busy} onChange={event=>{setChoice(event.target.value);setMessage('')}} className="w-full bg-slate-800 text-white border border-white/10 rounded-lg p-2">
      <option value="">Automatic · {deviceTimeZone()}</option>
      {zones.map(zone=><option key={zone} value={zone}>{zone.replaceAll('_',' ')}</option>)}
    </select>
    <button disabled={busy||value===(user?.timeZone||'')} className="mt-3 px-3 py-2 bg-slate-800 text-white border border-white/10 rounded-lg disabled:opacity-50">{busy?'Saving…':'Save time zone'}</button>
    {message&&<p role="status" className="text-slate-300 text-sm mt-2">{message}</p>}
    {error&&<p role="alert" className="text-red-300 text-sm mt-2">{error}</p>}
  </form>
}
