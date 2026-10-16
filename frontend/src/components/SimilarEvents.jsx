import { useEffect, useMemo, useRef, useState } from 'react'
import { CALENDAR_LABELS, dayLabel } from '../lib/calendar'
import './SimilarEvents.css'

const normalize=name=>String(name||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ')
function matches(title,query,mode){
  const left=normalize(title),right=normalize(query)
  if(!left||!right)return false
  if(left===right)return true
  if(mode==='exact')return false
  const a=new Set(left.split(' ')),b=new Set(right.split(' '))
  const shared=[...a].filter(word=>b.has(word)).length
  return shared>=2 && 2*shared/(a.size+b.size)>=0.8
}

export default function SimilarEvents({target,items,onRemove,onClose}){
  const [query,setQuery]=useState(target.title),[mode,setMode]=useState('similar'),[excluded,setExcluded]=useState(new Set()),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const panel=useRef(null)
  const candidates=useMemo(()=>items.filter(item=>matches(item.title,query,mode)),[items,query,mode])
  const selected=candidates.filter(item=>!excluded.has(item.id))
  useEffect(()=>{panel.current?.scrollIntoView({block:'nearest'});panel.current?.querySelector('input')?.focus({preventScroll:true})},[])
  const remove=async()=>{
    setBusy(true);setError('')
    try{await onRemove(selected.map(item=>item.id));onClose()}catch(error){setError(error.message)}finally{setBusy(false)}
  }
  return <section ref={panel} className="similar-events" aria-label="Remove events by name">
    <h3>Remove events by name</h3>
    <label>Event name<input value={query} disabled={busy} onChange={event=>{setQuery(event.target.value);setExcluded(new Set())}}/></label>
    <label>Match<select value={mode} disabled={busy} onChange={event=>{setMode(event.target.value);setExcluded(new Set())}}><option value="similar">Same or similar name</option><option value="exact">Same name only</option></select></label>
    <p>Review matches across all loaded dates. Case and punctuation are ignored; similar names must share most words. Items are removed from your calendar and can be restored later.</p>
    <div className="similar-events-list">{candidates.map(item=><label key={item.id}><input type="checkbox" disabled={busy} checked={!excluded.has(item.id)} onChange={()=>setExcluded(previous=>{const next=new Set(previous);next.has(item.id)?next.delete(item.id):next.add(item.id);return next})}/><span><strong>{item.title}</strong><small>{dayLabel(item.startDate,{month:'short',day:'numeric',year:'numeric'})} · {CALENDAR_LABELS[item.source]}</small></span></label>)}{!candidates.length&&<p>No matching events.</p>}</div>
    {error&&<p role="alert">{error}</p>}
    <div><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="button" disabled={busy||!selected.length} onClick={remove}>{busy?'Removing…':`Remove ${selected.length} ${selected.length===1?'event':'events'}`}</button></div>
  </section>
}
