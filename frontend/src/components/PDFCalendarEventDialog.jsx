import {useId,useLayoutEffect,useRef,useState} from 'react'
import {calendarDay,entryDraft,entryPayload} from '../lib/calendar'
import {activeTimeZone} from '../lib/timeZone'
import './DocumentFolderNavigation.css'

export default function PDFCalendarEventDialog({token,onSaved,onClose}){
  const dialog=useRef(null),saving=useRef(false)
  const heading=useId()
  const [draft,setDraft]=useState(()=>entryDraft(calendarDay(new Date())))
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const update=event=>{
    const {name,value,checked,type}=event.target
    setDraft(previous=>({...previous,[name]:type==='checkbox'?checked:value}))
  }

  useLayoutEffect(()=>{dialog.current.showModal()},[])

  const save=async event=>{
    event.preventDefault()
    if(saving.current)return
    saving.current=true
    setBusy(true)
    setError('')
    try{
      const response=await fetch('/api/calendar-entries',{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify(entryPayload(draft))
      })
      if(!response.ok){
        const data=await response.json().catch(()=>({}))
        throw new Error(data.message||'Could not create the calendar event.')
      }
      window.dispatchEvent(new Event('calendar-changed'))
      onSaved()
      dialog.current?.close()
    }catch(error){
      setError(error.message)
    }finally{
      saving.current=false
      setBusy(false)
    }
  }

  return <dialog ref={dialog} className="document-file-dialog pdf-calendar-event-dialog" aria-labelledby={heading}
    onClose={onClose} onCancel={event=>{if(saving.current)event.preventDefault()}} onKeyDown={event=>event.stopPropagation()}>
    <form onSubmit={save}>
      <h2 id={heading}>New calendar event</h2>
      <label>Title<input name="title" value={draft.title} onChange={update} maxLength={200} required autoFocus disabled={busy}/></label>
      <label><span><input name="allDay" type="checkbox" checked={draft.allDay} onChange={update} disabled={busy}/> All day</span></label>
      {draft.allDay ? <>
        <label>Start date<input name="startDate" type="date" value={draft.startDate} onChange={event=>{
          const startDate=event.target.value
          setDraft(previous=>({...previous,startDate,endDate:previous.endDate<startDate?startDate:previous.endDate}))
        }} required disabled={busy}/></label>
        <label>End date (inclusive)<input name="endDate" type="date" value={draft.endDate} min={draft.startDate} onChange={update} required disabled={busy}/></label>
      </> : <>
        <label>Start time<input name="startLocal" type="datetime-local" value={draft.startLocal} onChange={update} required disabled={busy}/></label>
        <label>End time (optional)<input name="endLocal" type="datetime-local" value={draft.endLocal} min={draft.startLocal} onChange={update} disabled={busy}/></label>
        <p>Times use {activeTimeZone()}.</p>
      </>}
      <label>Location (optional)<input name="location" value={draft.location} onChange={update} maxLength={300} disabled={busy}/></label>
      {error&&<p role="alert">{error}</p>}
      <footer>
        <button type="button" disabled={busy} onClick={()=>dialog.current.close()}>Cancel</button>
        <button type="submit" disabled={busy}>{busy?'Saving…':'Create event'}</button>
      </footer>
    </form>
  </dialog>
}
