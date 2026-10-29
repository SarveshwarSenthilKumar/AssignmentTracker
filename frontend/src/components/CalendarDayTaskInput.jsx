import {useRef,useState} from 'react'
import {dayLabel,validDay} from '../lib/calendar'
import {readApiJson} from '../lib/apiResponse'
import './TaskSchedule.css'

export default function CalendarDayTaskInput({day,token,onCreated,inputRef,disabled=false}){
  const [drafts,setDrafts]=useState({}),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),lock=useRef(false)
  const text=drafts[day]||''
  const submit=async event=>{
    event.preventDefault();if(lock.current||disabled||!text.trim()||!validDay(day))return
    const scheduledDay=day,original=text
    lock.current=true;setSaving(true);setError('');setNotice('')
    try{
      const response=await fetch('/api/todos',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({text:original.trim(),scheduledDate:scheduledDay,dueDate:null,calendarAllDay:false,folder:null})}),task=await readApiJson(response)
      if(!response.ok)throw new Error(task.message||'Could not save the task. Your text is still here.')
      if(!task._id||task.scheduledDate!==scheduledDay)throw new Error('The server did not confirm the scheduled task. Refresh Calendar before retrying.')
      onCreated(task)
      setDrafts(previous=>{if(previous[scheduledDay]!==original)return previous;const next={...previous};delete next[scheduledDay];return next})
      setNotice(`Task saved for ${dayLabel(scheduledDay,{month:'short',day:'numeric',year:'numeric'})}. It is also available in Tasks → Inbox.`)
      window.dispatchEvent(new Event('calendar-changed'))
      requestAnimationFrame(()=>inputRef?.current?.focus({preventScroll:true}))
    }catch(reason){setError(reason.message)}finally{lock.current=false;setSaving(false)}
  }
  return <form className="calendar-day-task-input" onSubmit={submit} aria-label="Add a task for the selected day"><label htmlFor="calendar-day-task-text">What will you do on {dayLabel(day,{weekday:'short',month:'short',day:'numeric'})}?</label><div><input id="calendar-day-task-text" ref={inputRef} type="text" maxLength={2000} value={text} disabled={saving||disabled} onChange={event=>{setDrafts(previous=>({...previous,[day]:event.target.value}));setError('');setNotice('')}} placeholder="Type a task, then press Enter…" autoComplete="off"/><button type="submit" disabled={saving||disabled||!text.trim()}>{saving?'Adding…':'Add task'}</button></div><p>Press Enter or click Add task. This schedules work for this day without setting a due date.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</form>
}
