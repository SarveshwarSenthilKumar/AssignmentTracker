import {calendarDay,shiftDay,validDay} from './calendar'

// Calendar arithmetic uses date strings, so DST and device-zone differences do
// not change a suggested day. Suggestions never modify the task automatically.
export function taskDateSuggestions(value,now=new Date()){
  const today=calendarDay(now),text=String(value||'').normalize('NFKC').toLowerCase(),results=[]
  const weekday=new Date(today+'T12:00:00Z').getUTCDay()
  const add=(date,phrase,index)=>{if(validDay(date)&&date>=today&&!/\b(?:not|except|excluding)\s*$/.test(text.slice(Math.max(0,index-20),index)))results.push({date,phrase,index})}
  const scan=(pattern,resolve)=>{for(const match of text.matchAll(pattern)){const date=resolve(match);if(date)add(date,match[0],match.index)}}
  scan(/\b(?:day after tomorrow|today|tonight|tomorrow|tmrw|tmr)\b/g,m=>shiftDay(today,m[0]==='day after tomorrow'?2:['tomorrow','tmrw','tmr'].includes(m[0])?1:0))
  scan(/\bin\s+(\d{1,3}|one|two|three|four|five|six|seven|a|an)\s+(days?|weeks?)\b/g,m=>{
    const number=Number(m[1])||({one:1,two:2,three:3,four:4,five:5,six:6,seven:7,a:1,an:1}[m[1]])
    return number?shiftDay(today,number*(m[2].startsWith('week')?7:1)):null
  })
  // Explicit week modifiers refer to Monday-based calendar weeks, not merely
  // the next occurrence. Consume whole phrases before shorter weekday matches.
  const days={sun:6,mon:0,tue:1,wed:2,thu:3,fri:4,sat:5}
  const weekStart=shiftDay(today,-((weekday+6)%7)),claimed=[]
  const modifier='(?:(?:next\\s+)+|this\\s+|coming\\s+)'
  const dayNames='sunday|sun|monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri|saturday|sat'
  const nextCount=phrase=>(phrase?.match(/\bnext\b/g)||[]).length
  const scanCalendar=(pattern,resolve)=>{
    for(const match of text.matchAll(pattern)){
      const start=match.index,end=start+match[0].length
      if(claimed.some(([left,right])=>start<right&&end>left))continue
      claimed.push([start,end])
      const result=resolve(match)
      if(!result)continue
      const before=results.length
      add(result.date,match[0],start)
      if(results.length>before)results[results.length-1].explanation=result.explanation
    }
  }
  const weekDay=(phrase,day)=>{
    const weeks=nextCount(phrase),offset=days[day.slice(0,3)]
    if(weeks)return {date:shiftDay(weekStart,offset+weeks*7),explanation:`${weeks===1?'Next week':weeks+' weeks ahead'}; weeks start on Monday.`}
    if(phrase?.trim()==='this')return {date:shiftDay(weekStart,offset),explanation:'This calendar week (Monday through Sunday).'}
    return {date:shiftDay(today,(offset-((weekday+6)%7)+7)%7),explanation:'The upcoming occurrence, including today.'}
  }
  scanCalendar(new RegExp(`\\b(${modifier})week\\s+(?:on\\s+)?(${dayNames})\\b`,'g'),m=>weekDay(m[1],m[2]))
  scanCalendar(new RegExp(`\\b(${modifier})?(${dayNames})(?:\\s+(?:of\\s+)?(${modifier})week)?\\b`,'g'),m=>weekDay(m[3]||m[1],m[2]))
  scanCalendar(new RegExp(`\\b(${modifier})?weekend\\b`,'g'),m=>{
    const weeks=nextCount(m[1])
    const date=weeks?shiftDay(weekStart,5+weeks*7):m[1]?.trim()==='this'?(shiftDay(weekStart,5)<today?today:shiftDay(weekStart,5)):shiftDay(today,(6-weekday+7)%7)
    return {date,explanation:weeks?`Saturday ${weeks===1?'next week':weeks+' weeks ahead'}.`:'The upcoming weekend in the specified week.'}
  })
  scanCalendar(new RegExp(`\\b(?:end\\s+of\\s+(${modifier})?week|eow)\\b`,'g'),m=>({date:shiftDay(weekStart,4+nextCount(m[1])*7),explanation:'Friday at the end of the specified workweek.'}))
  scanCalendar(new RegExp(`\\b(${modifier})week\\b`,'g'),m=>{
    const weeks=nextCount(m[1])
    return {date:weeks?shiftDay(weekStart,weeks*7):today,explanation:weeks?`Monday ${weeks===1?'next week':weeks+' weeks ahead'}.`:'This week is already underway; use today or choose a specific weekday.'}
  })
  scan(/\b(?:end of (?:this )?month|eom)\b/g,()=>{
    const date=new Date(today+'T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+1,0)
    return date.toISOString().slice(0,10)
  })
  scan(/\b\d{4}-\d{2}-\d{2}\b/g,m=>validDay(m[0])?m[0]:null)
  const monthNames='jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?'
  const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12}
  const monthDate=(month,day,year)=>{
    if(Number(day)<1||Number(day)>31)return null
    const first=year?Number(year):Number(today.slice(0,4))
    for(let candidate=first;candidate<=first+(year?0:8);candidate++){
      const date=`${candidate}-${String(month).padStart(2,'0')}-${String(Number(day)).padStart(2,'0')}`
      if(validDay(date)&&date>=today)return date
    }
    return null
  }
  scan(new RegExp(`\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`,'g'),m=>monthDate(months[m[1].slice(0,3)],m[2],m[3]))
  scan(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})\\.?(?:\\s+(\\d{4}))?\\b`,'g'),m=>monthDate(months[m[2].slice(0,3)],m[1],m[3]))
  const unique=new Set()
  return results.sort((a,b)=>a.index-b.index).filter(item=>{if(unique.has(item.date))return false;unique.add(item.date);return true}).slice(0,5)
}
