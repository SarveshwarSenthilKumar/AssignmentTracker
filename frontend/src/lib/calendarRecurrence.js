import { entryPayload, shiftDay, validDay } from './calendar'
import { activeTimeZone, localToInstant, zonedLocal } from './timeZone'

export function recurringEntries(draft){
  const rule=draft.recurrence
  if(!rule||rule.unit==='none')return null
  const interval=Number(rule.interval),count=Number(rule.count)
  if(!Number.isInteger(interval)||interval<1||interval>365)throw new Error('Choose a repeat interval between 1 and 365.')
  if(rule.end==='count'&&(!Number.isInteger(count)||count<2||count>500))throw new Error('Choose between 2 and 500 meetings.')
  const base=entryPayload(draft),first=base.allDay?draft.startDate:draft.startLocal.slice(0,10)
  if(rule.end==='until'&&(!validDay(rule.until)||rule.until<first))throw new Error('Choose a repeat end date on or after the first meeting.')
  const weekdays=[...new Set(rule.weekdays||[])].sort()
  if(rule.unit==='weeks'&&!weekdays.length)throw new Error('Choose at least one weekday.')
  const entries=[],limit=rule.end==='count'?count:501
  const until=rule.end==='until'?rule.until:null
  const startWeekday=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7
  const daySpan=base.allDay?Math.round((Date.parse(draft.endDate)-Date.parse(first))/86400000):Math.round((Date.parse(draft.endLocal.slice(0,10))-Date.parse(first))/86400000)
  const addDay=day=>{
    if(until&&day>until)return false
    if(base.allDay)entries.push({...base,startDate:day,endDate:shiftDay(day,daySpan)})
    else{
      const startAt=localToInstant(day+draft.startLocal.slice(10)),endAt=localToInstant(shiftDay(day,daySpan)+draft.endLocal.slice(10))
      if(Date.parse(endAt)<=Date.parse(startAt))throw new Error('A recurring meeting ends before it starts. Adjust its times.')
      entries.push({...base,startAt,endAt})
    }
    return entries.length<limit
  }
  if(['minutes','hours'].includes(rule.unit)){
    if(base.allDay)throw new Error('Use a timed appointment for minute or hour intervals.')
    const step=interval*(rule.unit==='hours'?3600000:60000),start=Date.parse(base.startAt),duration=Date.parse(base.endAt)-start
    // Hour/minute intervals represent elapsed time, rather than local weekdays.
    for(let i=0;i<=500;i++){
      const at=start+i*step,day=zonedLocal(at).slice(0,10)
      if(until&&day>until)break
      entries.push({...base,startAt:new Date(at).toISOString(),endAt:new Date(at+duration).toISOString()})
      if(rule.end==='count'&&entries.length===count)break
    }
  }else if(rule.unit==='months'){
    const original=new Date(first+'T12:00:00Z')
    for(let step=0;step<=1200&&entries.length<limit;step++){
      const date=new Date(original);date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+step*interval);date.setUTCDate(original.getUTCDate())
      if(date.getUTCDate()!==original.getUTCDate())continue
      if(!addDay(date.toISOString().slice(0,10)))break
    }
  }else{
    for(let offset=0;offset<=36600&&entries.length<limit;offset++){
      const day=shiftDay(first,offset)
      if(until&&day>until)break
      const matches=rule.unit==='days'?offset%interval===0:Math.floor((offset+startWeekday)/7)%interval===0&&weekdays.includes(new Date(day+'T12:00:00Z').getUTCDay())
      if(matches&&!addDay(day))break
    }
  }
  if(entries.length>500)throw new Error('This schedule exceeds 500 meetings. Choose an earlier end date.')
  if(entries.length<2)throw new Error('This schedule needs at least two meetings. Extend its end date or select more weekdays.')
  if(rule.end==='count'&&entries.length!==count)throw new Error('This interval is too large for the selected number of meetings.')
  return {entries,rule:{unit:rule.unit,interval,weekdays,end:rule.end,count:entries.length,until,timeZone:activeTimeZone()}}
}
