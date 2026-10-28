import {useId} from 'react'
import {localToInstant} from '../lib/timeZone'

export function taskDuePayload(value,hasTime){
  if(!value)return {dueDate:null,calendarAllDay:false,calendarDate:null}
  if(hasTime)return {dueDate:localToInstant(value),calendarAllDay:false,calendarDate:null}
  return {dueDate:null,calendarAllDay:true,calendarDate:value.slice(0,10)}
}
export default function TaskDueInput({value,hasTime,onChange,onModeChange}){
  const id=useId()
  return <div className="task-due-input"><label htmlFor={id}>Due date (optional)</label><input id={id} type={hasTime?'datetime-local':'date'} value={value||''} onChange={event=>onChange(event.target.value)} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-slate-500 text-sm"/><label className="task-due-time-toggle"><input type="checkbox" checked={!!hasTime} onChange={event=>{const next=event.target.checked;onModeChange(next,next?(value?value.slice(0,10)+'T00:00':''):value?.slice(0,10)||'')}}/>Set a specific time</label></div>
}
