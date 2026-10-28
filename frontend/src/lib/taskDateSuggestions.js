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
  const days={sun:0,mon:1,tue:2,wed:3,thu:4,fri:5,sat:6}
  scan(/\b(?:(next|this|coming)\s+)?(sunday|sun|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat)\b/g,m=>{
    const target=days[m[2].slice(0,3)],offset=(target-weekday+7)%7
    return shiftDay(today,offset===0&&m[1]==='next'?7:offset)
  })
  scan(/\b(?:(this|next)\s+)?weekend\b/g,m=>{const offset=(6-weekday+7)%7;return shiftDay(today,offset+(m[1]==='next'?7:0))})
  scan(/\b(?:end of (?:this )?week|eow)\b/g,()=>shiftDay(today,(5-weekday+7)%7))
  scan(/\bnext week\b/g,()=>shiftDay(today,(1-weekday+7)%7||7))
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
