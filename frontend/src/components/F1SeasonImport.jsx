import {useEffect,useRef,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import {calendarDay,calendarTime,dayLabel} from '../lib/calendar'

const SESSION_TYPES=[
  {id:'practice',label:'Free practice',detail:'FP1, FP2 and FP3',sessions:['FirstPractice','SecondPractice','ThirdPractice']},
  {id:'qualifying',label:'Qualifying',detail:'Grand Prix qualifying',sessions:['Qualifying']},
  {id:'sprintQualifying',label:'Sprint qualifying',detail:'Sprint qualifying / shootout',sessions:['SprintQualifying','SprintShootout']},
  {id:'sprint',label:'Sprints',detail:'Sprint races',sessions:['Sprint']},
  {id:'race',label:'Grands Prix',detail:'Main races',sessions:['Race']},
]
const matchesType=(entry,type)=>type.sessions.includes(entry.session)
const eligible=(data,types)=>data.entries.filter(entry=>SESSION_TYPES.some(type=>types.has(type.id)&&matchesType(entry,type)))

export default function F1SeasonImport({token,disabled,onImported,categories=[]}){
  const [categoryId,setCategoryId]=useState('')
  const [categorizeExisting,setCategorizeExisting]=useState(false)
  useEffect(()=>{setCategoryId(previous=>categories.some(category=>category.id===previous)?previous:'')},[categories])
  const [year,setYear]=useState(new Date().getFullYear()),[types,setTypes]=useState(()=>new Set(SESSION_TYPES.map(type=>type.id))),[preview,setPreview]=useState(null),[selected,setSelected]=useState(new Set()),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false)
  const chooseTypes=next=>{
    setTypes(next);setNotice('');setError('')
    if(preview)setSelected(previous=>new Set(eligible(preview,next).filter(entry=>previous.has(entry.externalId)||SESSION_TYPES.some(type=>next.has(type.id)&&!types.has(type.id)&&matchesType(entry,type))).map(entry=>entry.externalId)))
  }
  const onlyType=id=>{const next=new Set([id]);setTypes(next);setNotice('');setError('');if(preview)setSelected(new Set(eligible(preview,next).map(entry=>entry.externalId)))}
  const load=async event=>{
    event.preventDefault();if(lock.current||disabled)return
    lock.current=true;setBusy('load');setError('');setNotice('');setPreview(null)
    try{
      const response=await fetch(`/api/calendar/sports/f1?year=${encodeURIComponent(year)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not load the F1 schedule.')
      if(!Array.isArray(data.entries))throw new Error('The schedule provider returned an invalid response.')
      setPreview(data);setSelected(new Set(eligible(data,types).map(entry=>entry.externalId)))
    }catch(error){setError(error.message)}finally{lock.current=false;setBusy('')}
  }
  const add=async()=>{
    if(lock.current||disabled||!preview)return
    const keys=eligible(preview,types).filter(entry=>selected.has(entry.externalId)).map(entry=>entry.externalId)
    if(!keys.length)return
    lock.current=true;setBusy('import');setError('');setNotice('')
    try{
      const response=await fetch('/api/calendar/sports/f1/import',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({year:preview.year,keys,categoryId:categoryId||null,categorizeExisting})}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not import the F1 schedule.')
      onImported(data.entries||[])
      window.dispatchEvent(new Event('calendar-changed'))
      setNotice(`${data.added} F1 events added. ${data.updated||0} existing events moved to the chosen category. ${data.skipped} existing events skipped. Use calendar Undo to reverse these changes.`)
    }catch(error){setError(error.message)}finally{lock.current=false;setBusy('')}
  }
  const rows=preview?eligible(preview,types):[]
  const selectedCount=rows.filter(entry=>selected.has(entry.externalId)).length
  return <details className="calendar-f1-import"><summary>Import an F1 season</summary><p>Add a published season schedule to your calendar. Includes past and upcoming events; repeated imports skip sessions already saved.</p>
    <form onSubmit={load}><label>Season<input type="number" min="1950" max={new Date().getFullYear()+1} value={year} disabled={!!busy||disabled} onChange={event=>{setYear(event.target.value);setPreview(null);setNotice('');setError('')}} required/></label><label>Category for new events<select value={categoryId} disabled={!!busy||disabled} onChange={event=>setCategoryId(event.target.value)}><option value="">Uncategorized</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button type="submit" disabled={!!busy||disabled}>{busy==='load'?'Loading schedule…':'Preview F1 season'}</button></form>
    <fieldset className="calendar-f1-types" disabled={!!busy||disabled}><legend>Session types to import</legend><p>Choose any combination, or use Only to import a single type. Sprint qualifying is separate from Sprint races and Grand Prix qualifying.</p><div className="calendar-f1-type-grid">{SESSION_TYPES.map(type=><div key={type.id}><label className="calendar-check"><input type="checkbox" checked={types.has(type.id)} onChange={event=>{const next=new Set(types);if(event.target.checked)next.add(type.id);else next.delete(type.id);chooseTypes(next)}}/><span><strong>{type.label}</strong><small>{type.detail}{preview?` · ${preview.entries.filter(entry=>matchesType(entry,type)).length} available`:''}</small></span></label><button type="button" aria-label={`Import only ${type.label.toLowerCase()}`} onClick={()=>onlyType(type.id)}>Only</button></div>)}</div><button type="button" onClick={()=>{const next=new Set(SESSION_TYPES.map(type=>type.id));chooseTypes(next);if(preview)setSelected(new Set(eligible(preview,next).map(entry=>entry.externalId)))}}>All session types</button></fieldset>
    <label className="calendar-check"><input type="checkbox" checked={categorizeExisting} disabled={!!busy||disabled} onChange={event=>setCategorizeExisting(event.target.checked)}/>Also move selected, already-imported F1 sessions into this category. Their dates and other edits are kept.</label>
    {error&&<p role="alert" className="calendar-f1-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {preview&&<><p><strong>{preview.year}: {preview.races} race weekends · {rows.length} matching sessions · {selectedCount} selected</strong></p><p>Start times use your calendar time zone. End times are estimated blocks. Unconfirmed start times appear as all-day placeholders. This is an import, not a live subscription; later schedule changes require editing existing events.</p><p>Schedule: <a href={preview.sourceUrl} target="_blank" rel="noopener noreferrer">Jolpica F1</a> · <a href={`https://www.formula1.com/en/racing/${preview.year}`} target="_blank" rel="noopener noreferrer">Official F1 calendar</a></p>
      {!!preview.warnings?.length&&<details><summary>Schedule information to review</summary><ul>{preview.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>}
      <div className="calendar-actions"><button type="button" disabled={!!busy||disabled} onClick={()=>setSelected(new Set(rows.map(entry=>entry.externalId)))}>Select all</button><button type="button" disabled={!!busy||disabled} onClick={()=>setSelected(new Set())}>Clear selection</button></div>
      {!rows.length&&<p role="status">{types.size?'No published sessions match these types for this season. Choose another type.':'Choose at least one session type above.'}</p>}
      <div className="calendar-f1-preview">{rows.map(entry=><label key={entry.externalId}><input type="checkbox" checked={selected.has(entry.externalId)} disabled={!!busy||disabled} onChange={event=>setSelected(previous=>{const next=new Set(previous);if(event.target.checked)next.add(entry.externalId);else next.delete(entry.externalId);return next})}/><span><strong>{entry.title}</strong><small>{dayLabel(entry.allDay?entry.startDate:calendarDay(entry.startAt),{month:'short',day:'numeric',year:'numeric'})} · {entry.allDay?'Time unconfirmed':calendarTime(entry)} · {entry.location}</small></span></label>)}</div>
      <button type="button" disabled={!!busy||disabled||!selectedCount} onClick={add}>{busy==='import'?'Adding F1 events…':`Add ${selectedCount} selected F1 events`}</button>
    </>}
  </details>
}
