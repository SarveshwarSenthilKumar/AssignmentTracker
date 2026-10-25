import {useEffect,useRef,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import {calendarDay,calendarTime,dayLabel} from '../lib/calendar'

export default function F1SeasonImport({token,disabled,onImported,categories=[]}){
  const [categoryId,setCategoryId]=useState('')
  const [categorizeExisting,setCategorizeExisting]=useState(false)
  useEffect(()=>{setCategoryId(previous=>categories.some(category=>category.id===previous)?previous:'')},[categories])
  const [year,setYear]=useState(new Date().getFullYear()),[weekends,setWeekends]=useState(true),[preview,setPreview]=useState(null),[selected,setSelected]=useState(new Set()),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false)
  const eligible=(data,all)=>data.entries.filter(entry=>all||entry.session==='Race')
  const load=async event=>{
    event.preventDefault();if(lock.current||disabled)return
    lock.current=true;setBusy('load');setError('');setNotice('');setPreview(null)
    try{
      const response=await fetch(`/api/calendar/sports/f1?year=${encodeURIComponent(year)}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not load the F1 schedule.')
      if(!Array.isArray(data.entries))throw new Error('The schedule provider returned an invalid response.')
      setPreview(data);setSelected(new Set(eligible(data,weekends).map(entry=>entry.externalId)))
    }catch(error){setError(error.message)}finally{lock.current=false;setBusy('')}
  }
  const add=async()=>{
    if(lock.current||disabled||!selected.size)return
    lock.current=true;setBusy('import');setError('');setNotice('')
    try{
      const response=await fetch('/api/calendar/sports/f1/import',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({year:preview.year,keys:[...selected],categoryId:categoryId||null,categorizeExisting})}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not import the F1 schedule.')
      onImported(data.entries||[])
      window.dispatchEvent(new Event('calendar-changed'))
      setNotice(`${data.added} F1 events added. ${data.updated||0} existing events moved to the chosen category. ${data.skipped} existing events skipped. Use calendar Undo to reverse these changes.`)
    }catch(error){setError(error.message)}finally{lock.current=false;setBusy('')}
  }
  const rows=preview?eligible(preview,weekends):[]
  return <details className="calendar-f1-import"><summary>Import an F1 season</summary><p>Add a published season schedule to your calendar. Includes past and upcoming events; repeated imports skip sessions already saved.</p>
    <form onSubmit={load}><label>Season<input type="number" min="1950" max={new Date().getFullYear()+1} value={year} disabled={!!busy||disabled} onChange={event=>{setYear(event.target.value);setPreview(null);setNotice('');setError('')}} required/></label><label>Category for new events<select value={categoryId} disabled={!!busy||disabled} onChange={event=>setCategoryId(event.target.value)}><option value="">Uncategorized</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select></label><button type="submit" disabled={!!busy||disabled}>{busy==='load'?'Loading schedule…':'Preview F1 season'}</button></form>
    <label className="calendar-check"><input type="checkbox" checked={weekends} disabled={!!busy||disabled} onChange={event=>{setWeekends(event.target.checked);if(preview)setSelected(new Set(eligible(preview,event.target.checked).map(entry=>entry.externalId)));setNotice('')}}/>Include full weekends: practice, qualifying, Sprint qualifying, Sprint and races where published. Uncheck for races only.</label>
    <label className="calendar-check"><input type="checkbox" checked={categorizeExisting} disabled={!!busy||disabled} onChange={event=>setCategorizeExisting(event.target.checked)}/>Also move selected, already-imported F1 sessions into this category. Their dates and other edits are kept.</label>
    {error&&<p role="alert" className="calendar-f1-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {preview&&<><p><strong>{preview.year}: {preview.races} race weekends · {rows.length} available sessions · {selected.size} selected</strong></p><p>Start times use your calendar time zone. End times are estimated blocks. Unconfirmed start times appear as all-day placeholders. This is an import, not a live subscription; later schedule changes require editing existing events.</p><p>Schedule: <a href={preview.sourceUrl} target="_blank" rel="noopener noreferrer">Jolpica F1</a> · <a href={`https://www.formula1.com/en/racing/${preview.year}`} target="_blank" rel="noopener noreferrer">Official F1 calendar</a></p>
      {!!preview.warnings?.length&&<details><summary>Schedule information to review</summary><ul>{preview.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>}
      <div className="calendar-actions"><button type="button" disabled={!!busy||disabled} onClick={()=>setSelected(new Set(rows.map(entry=>entry.externalId)))}>Select all</button><button type="button" disabled={!!busy||disabled} onClick={()=>setSelected(new Set())}>Clear selection</button></div>
      <div className="calendar-f1-preview">{rows.map(entry=><label key={entry.externalId}><input type="checkbox" checked={selected.has(entry.externalId)} disabled={!!busy||disabled} onChange={event=>setSelected(previous=>{const next=new Set(previous);if(event.target.checked)next.add(entry.externalId);else next.delete(entry.externalId);return next})}/><span><strong>{entry.title}</strong><small>{dayLabel(entry.allDay?entry.startDate:calendarDay(entry.startAt),{month:'short',day:'numeric',year:'numeric'})} · {entry.allDay?'Time unconfirmed':calendarTime(entry)} · {entry.location}</small></span></label>)}</div>
      <button type="button" disabled={!!busy||disabled||!selected.size} onClick={add}>{busy==='import'?'Adding F1 events…':`Add ${selected.size} selected F1 events`}</button>
    </>}
  </details>
}
