import { activeTimeZone, zonedLocal, localToInstant } from './timeZone.js'
export const CALENDAR_LABELS = { tasks: 'Task deadlines', canvas: 'Canvas & imports', txst: 'TXST events', appointment: 'Appointments', marker: 'Date markers' }
export const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value
export function calendarDay(value) {
  if (value == null) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return zonedLocal(value).slice(0,10)
}
export const shiftDay = (day, count) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate()+count); return date.toISOString().slice(0,10) }
export const shiftMonth = (day, count) => { const date = new Date(`${day.slice(0,7)}-01T12:00:00Z`); date.setUTCMonth(date.getUTCMonth()+count); return date.toISOString().slice(0,10) }
export function monthDays(day) {
  const first = `${day.slice(0,7)}-01`, weekday = (new Date(`${first}T12:00:00Z`).getUTCDay()+6)%7
  return Array.from({length:42},(_,index)=>shiftDay(first,index-weekday))
}
export const dayLabel = (day, options = {}) => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined,{timeZone:'UTC',...options})
export function taskDueLabel(task, includeTime=false) {
  if(task.calendarAllDay && validDay(task.calendarDate)) return `${dayLabel(task.calendarDate,{month:'short',day:'numeric',year:'numeric'})} · All day`
  if(!task.dueDate || !Number.isFinite(Date.parse(task.dueDate))) return 'No due date'
  const date=new Date(task.dueDate)
  return includeTime?date.toLocaleString(undefined,{timeZone:activeTimeZone()}):date.toLocaleDateString(undefined,{timeZone:activeTimeZone()})
}
export const localDateTime = value => zonedLocal(value)

export function calendarItems(tasks, entries, campusEvents = [], colors = {}) {
  const items = []
  for (const task of tasks) {
    if (!task.dueDate || !Number.isFinite(Date.parse(task.dueDate))) continue
    const event = task.canvasType === 'calendar_event', allDay = event && !!task.calendarAllDay
    const startDate = allDay && validDay(task.calendarDate) ? task.calendarDate : calendarDay(task.dueDate)
    let endDate = startDate
    if (event && task.calendarEndDate && Date.parse(task.calendarEndDate) > Date.parse(task.dueDate)) {
      if (allDay) endDate = validDay(task.calendarLastDate) ? task.calendarLastDate : shiftDay(startDate, Math.max(0,Math.round((Date.parse(task.calendarEndDate)-Date.parse(task.dueDate))/86400000)-1))
      else endDate = calendarDay(new Date(Date.parse(task.calendarEndDate)-1))
    }
    items.push({ id:`task:${task._id}`,title:task.text,source:task.canvasType?'canvas':'tasks',kind:event?'event':'deadline',startDate,endDate: endDate < startDate ? startDate : endDate,startAt:task.dueDate,endAt:task.calendarEndDate,allDay,done:task.status==='completed',notes:task.description||'',location:task.calendarLocation||'',context:task.calendarContext||'',task })
  }
  for (const entry of entries) {
    const startDate = entry.allDay ? entry.startDate : calendarDay(entry.startAt)
    const endDate = entry.allDay ? entry.endDate || startDate : calendarDay(new Date(Date.parse(entry.endAt)-1))
    if (!validDay(startDate) || !validDay(endDate)) continue
    items.push({id:`entry:${entry._id}`,title:entry.title,source:entry.kind,kind:entry.kind,startDate,endDate,allDay:entry.allDay,startAt:entry.startAt,endAt:entry.endAt,notes:entry.notes,location:entry.location,done:!!entry.done,entry})
  }
  for (const event of campusEvents) {
    if (!event.startsOn || !Number.isFinite(Date.parse(event.startsOn))) continue
    const startDate = calendarDay(event.startsOn)
    const endAt = event.endsOn && Date.parse(event.endsOn) > Date.parse(event.startsOn) ? event.endsOn : null
    const endDate = endAt ? calendarDay(new Date(Date.parse(endAt)-1)) : startDate
    const text = value => value == null ? '' : typeof value === 'string' ? value : Array.isArray(value) ? value.map(text).filter(Boolean).join(', ') : value.name || value.title || value.address || ''
    items.push({id:`txst:${event.id}`,title:event.name || 'TXST event',source:'txst',kind:'event',startDate,endDate,allDay:false,startAt:event.startsOn,endAt,done:false,notes:event.description || '',location:text(event.location) || text(event.address),context:text(event.organizations),campusEvent:event})
  }
  return items.map(item=>({...item,color:/^#[a-f0-9]{6}$/i.test(colors[item.id]||'')?colors[item.id]:null})).sort((a,b)=>a.startDate.localeCompare(b.startDate) || Number(b.allDay)-Number(a.allDay) || String(a.startAt||'').localeCompare(String(b.startAt||'')) || a.title.localeCompare(b.title))
}
export const itemsOnDay = (items, day) => items.filter(item=>item.startDate<=day&&item.endDate>=day)
export const itemsInMonth = (items, day) => { const first=`${day.slice(0,7)}-01`,last=shiftDay(shiftMonth(first,1),-1);return items.filter(item=>item.startDate<=last&&item.endDate>=first) }
export function calendarTime(item) {
  if (item.allDay) return 'All day'
  const time = value => new Date(value).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone:activeTimeZone()})
  return item.kind==='deadline' ? `Due ${time(item.startAt)}` : item.endAt ? `${time(item.startAt)} – ${time(item.endAt)}` : time(item.startAt)
}
export function entryDraft(day, kind='appointment', entry=null) {
  if(entry) return {...entry, startDate:entry.allDay?entry.startDate:calendarDay(entry.startAt),endDate:entry.allDay?entry.endDate:calendarDay(new Date(Date.parse(entry.endAt)-1)),startLocal:localDateTime(entry.startAt)||`${entry.startDate}T09:00`,endLocal:localDateTime(entry.endAt)||`${entry.endDate||entry.startDate}T10:00`}
  return {title:'',kind,allDay:kind==='marker',startDate:day,endDate:day,startLocal:`${day}T09:00`,endLocal:`${day}T10:00`,notes:'',location:'',done:false}
}
export function entryPayload(draft) {
  if(!draft.title?.trim() || draft.title.trim().length>200)throw new Error('Enter a title of up to 200 characters.')
  const payload={title:draft.title,kind:draft.kind,allDay:draft.kind==='marker'||draft.allDay,notes:draft.notes,location:draft.location,done:draft.done,taskIds:draft.taskIds||[],documentIds:draft.documentIds||[]}
  if(payload.allDay) {
    if(!validDay(draft.startDate)||!validDay(draft.endDate)||draft.endDate<draft.startDate)throw new Error('Choose an end date on or after the start date.')
    return {...payload,startDate:draft.startDate,endDate:draft.endDate}
  }
  const start = new Date(localToInstant(draft.startLocal)), end = new Date(localToInstant(draft.endLocal))
  if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<=start) throw new Error('Choose an end time after the start time.')
  if(localDateTime(start)!==draft.startLocal.slice(0,16)||localDateTime(end)!==draft.endLocal.slice(0,16))throw new Error('That local time does not exist in your time zone. Choose another time.')
  return {...payload,startAt:start.toISOString(),endAt:end.toISOString()}
}
