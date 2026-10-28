import {calendarDay,calendarTime,dayLabel,shiftDay} from '../lib/calendar'
import './SuggestedEvents.css'

export default function SuggestedEvents({items,enabled,onSelect,loading=false,warning='',disabled=false,now=new Date()}){
  if(!enabled)return null
  const today=calendarDay(now),until=shiftDay(today,30),seen=new Set()
  const suggestions=items.filter(item=>item.source==='txst'&&!item.done&&item.startDate<=until&&item.endDate>=today&&(item.allDay||Date.parse(item.endAt||item.startAt)>now.getTime()))
    .sort((a,b)=>a.startDate.localeCompare(b.startDate)||(Date.parse(a.startAt)||0)-(Date.parse(b.startAt)||0)||a.title.localeCompare(b.title))
    .filter(item=>{const key=`${item.title.trim().toLowerCase()}:${item.startDate}:${item.startAt||''}`;if(seen.has(key))return false;seen.add(key);return true}).slice(0,6)
  return <section className="suggested-events" aria-label="Suggested events"><header><div><h2>Suggested events</h2><p>Upcoming TXST events over the next 30 days, ordered by date.</p></div><span>Campus discovery</span></header>
    {warning&&<p className="suggested-events-note" role="status">Events could not fully refresh. {suggestions.length?'Showing available event information.':'Try refreshing the TXST feed in Calendar.'}</p>}
    {loading&&!suggestions.length?<p role="status">Loading event suggestions…</p>:suggestions.length?<div className="suggested-events-grid">{suggestions.map(item=><article key={item.id}><span>{dayLabel(item.startDate,{weekday:'short',month:'short',day:'numeric'})} · {calendarTime(item)}</span><h3>{item.title}</h3>{item.location&&<p>{item.location}</p>}<button type="button" disabled={disabled} onClick={()=>onSelect(item)}>View event details <span aria-hidden="true">↗</span></button></article>)}</div>:!warning&&<p>No upcoming campus suggestions are available in the loaded events. New suggestions appear as the TXST feed updates.</p>}
  </section>
}
