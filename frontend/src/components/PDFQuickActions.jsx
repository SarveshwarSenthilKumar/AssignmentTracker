import {useId,useLayoutEffect,useRef,useState} from 'react'
import {calendarDay,entryDraft,entryPayload} from '../lib/calendar'
import {taskDuePayload} from './TaskDueInput'
import {activeTimeZone} from '../lib/timeZone'
import './DocumentFolderNavigation.css'

export default function PDFQuickActions({token,onTaskCreated,onSaved,onClose}){
  const dialog=useRef(null),saving=useRef(false)
  const heading=useId()
  const [action,setAction]=useState(null)
  const [task,setTask]=useState({title:'',due:''})
  const [draft,setDraft]=useState(()=>entryDraft(calendarDay(new Date())))
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const update=event=>{
    const {name,value,checked,type}=event.target
    setDraft(previous=>({...previous,[name]:type==='checkbox'?checked:value}))
  }

  useLayoutEffect(()=>{dialog.current.showModal()},[])
  useLayoutEffect(()=>{dialog.current.querySelector('[data-quick-focus]')?.focus()},[action])

  const choose=next=>{
    setError('')
    setAction(next)
  }

  const save=async event=>{
    event.preventDefault()
    if(saving.current)return
    saving.current=true
    setBusy(true)
    setError('')
    try{
      const creatingTask=action==='task'
      const text=task.title.trim()
      if(creatingTask&&!text)throw new Error('Enter a task title.')
      const payload=creatingTask?{text,...taskDuePayload(task.due,false)}:entryPayload(draft)
      const response=await fetch(creatingTask?'/api/todos':'/api/calendar-entries',{
        method:'POST',
        headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      })
      if(!response.ok){
        const data=await response.json().catch(()=>({}))
        throw new Error(data.message||(creatingTask?'Could not create the task.':'Could not create the calendar event.'))
      }
      if(creatingTask)onTaskCreated?.(await response.json())
      window.dispatchEvent(new Event('calendar-changed'))
      onSaved(creatingTask?'Task created.':'Calendar event created.')
      dialog.current?.close()
    }catch(error){
      setError(error.message)
    }finally{
      saving.current=false
      setBusy(false)
    }
  }

  return <dialog ref={dialog} className="document-file-dialog pdf-quick-actions-dialog" aria-labelledby={heading}
    onClose={onClose} onCancel={event=>{if(saving.current)event.preventDefault()}} onKeyDown={event=>event.stopPropagation()}>
    {!action ? <div className="pdf-quick-action-list">
      <h2 id={heading}>Quick actions</h2>
      <button type="button" data-quick-focus onClick={()=>choose('task')}>New task</button>
      <button type="button" onClick={()=>choose('event')}>New calendar event</button>
      <a href="#/tasks" target="_blank" rel="noopener noreferrer">Open Tasks in a new tab</a>
      <a href="#/calendar" target="_blank" rel="noopener noreferrer">Open Calendar in a new tab</a>
      <a href="#/workspace" target="_blank" rel="noopener noreferrer">Open Workspace in a new tab</a>
      <footer><button type="button" onClick={()=>dialog.current.close()}>Close</button></footer>
    </div> : <form onSubmit={save}>
      {action==='task' ? <>
        <h2 id={heading}>New task</h2>
        <label>Title<input data-quick-focus value={task.title} onChange={event=>setTask({...task,title:event.target.value})} maxLength={1000} required disabled={busy}/></label>
        <label>Due date (optional)<input type="date" value={task.due} onChange={event=>setTask({...task,due:event.target.value})} disabled={busy}/></label>
      </> : <>
      <h2 id={heading}>New calendar event</h2>
      <label>Title<input name="title" value={draft.title} onChange={update} maxLength={200} required data-quick-focus disabled={busy}/></label>
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
      </>}
      {error&&<p role="alert">{error}</p>}
      <footer>
        <button type="button" disabled={busy} onClick={()=>choose(null)}>Back</button>
        <button type="submit" disabled={busy}>{busy?'Saving…':action==='task'?'Create task':'Create event'}</button>
      </footer>
    </form>}
  </dialog>
}
