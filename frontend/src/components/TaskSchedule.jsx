import {useEffect,useId,useRef,useState} from 'react'
import {dayLabel,validDay} from '../lib/calendar'
import {readApiJson} from '../lib/apiResponse'
import './TaskSchedule.css'

export default function TaskSchedule({task,token,onSaved,initialDate}){
  const [date,setDate]=useState(initialDate??task.scheduledDate??''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),lock=useRef(false),id=useId()
  useEffect(()=>{setDate(initialDate??task.scheduledDate??'');setError('');setNotice('')},[task._id,task.scheduledDate,initialDate])
  const save=async value=>{
    if(lock.current)return
    if(value&&!validDay(value)){setError('Choose a valid day.');return}
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{
      const response=await fetch(`/api/todos/${task._id}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({scheduledDate:value||null})}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not schedule this task.')
      if((data.scheduledDate||'')!==value)throw new Error('The server did not confirm the scheduled day. Restart the updated backend.')
      onSaved(data);setDate(value);setNotice(value?'Task scheduled. Your due date is unchanged.':'Scheduled day removed. Your due date is unchanged.');window.dispatchEvent(new Event('calendar-changed'))
    }catch(reason){setError(reason.message)}finally{lock.current=false;setBusy(false)}
  }
  return <section className="task-schedule" aria-label={`Plan ${task.text}`}><label htmlFor={id}>Do on</label><div><input id={id} type="date" value={date} disabled={busy} onChange={event=>setDate(event.target.value)}/><button type="button" disabled={busy||date===(task.scheduledDate||'')} onClick={()=>save(date)}>{busy?'Saving…':'Save day'}</button>{task.scheduledDate&&<button type="button" disabled={busy} onClick={()=>save('')}>Clear schedule</button>}</div><p>{task.scheduledDate?`Planned for ${dayLabel(task.scheduledDate,{weekday:'long',month:'short',day:'numeric',year:'numeric'})}. `:''}This is the day you plan to work on the task, separate from its deadline.</p>{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}</section>
}

export function TaskDayPlanner({day,tasks,token,onSaved}){
  const [id,setId]=useState('')
  const available=tasks.filter(task=>task.canvasType!=='calendar_event'),selected=available.find(task=>task._id===id)
  return <section className="task-day-planner"><h4>Plan a task for this day</h4><label>Select task<select value={id} onChange={event=>setId(event.target.value)}><option value="">Choose a task…</option>{available.map(task=><option key={task._id} value={task._id}>{task.text}{task.status==='completed'?' (completed)':''}</option>)}</select></label>{selected?<TaskSchedule task={selected} token={token} initialDate={day} onSaved={onSaved}/>:<p>Choose an existing task to schedule for {dayLabel(day,{month:'short',day:'numeric'})}.</p>}</section>
}
