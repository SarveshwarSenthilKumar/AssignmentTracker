const { validDay } = require('./calendarEntries');
const unescape = value => value.replace(/\\n/gi,'\n').replace(/\\([,;\\])/g,'$1');
function icsDate(value, zone='UTC') {
  const match=value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/);
  if(!match)return null;
  const day=`${match[1]}-${match[2]}-${match[3]}`;
  if(!validDay(day))return null;
  if(!match[4])return { date:new Date(`${day}T00:00:00Z`),day,allDay:true };
  const hour=Number(match[4]),minute=Number(match[5]),second=Number(match[6]);
  if(hour>23||minute>59||second>59)return null;
  const desired=Date.parse(`${day}T${match[4]}:${match[5]}:${match[6]}Z`);
  if(match[7])return {date:new Date(desired),day,allDay:false};
  try {
    const format=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    let timestamp=desired;
    for(let attempt=0;attempt<3;attempt++) {
      const parts=Object.fromEntries(format.formatToParts(new Date(timestamp)).map(part=>[part.type,part.value]));
      const local=Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
      if(local===desired)return {date:new Date(timestamp),day,allDay:false};
      timestamp+=desired-local;
    }
  } catch { /* Unsupported time zones are skipped rather than silently moved. */ }
  return null;
}
function parseCalendarICS(content) {
  const lines=content.replace(/\r?\n[ \t]/g,'').split(/\r?\n/),events=[];
  let current;
  for(const line of lines) {
    if(line==='BEGIN:VEVENT'){current={};continue}
    if(line==='END:VEVENT'){if(current?.startDate&&current.summary)events.push(current);current=null;continue}
    if(!current)continue;
    const colon=line.indexOf(':');if(colon<0)continue;
    const property=line.slice(0,colon),key=property.split(';')[0],value=line.slice(colon+1);
    if(['SUMMARY','DESCRIPTION','URL','UID'].includes(key))current[{SUMMARY:'summary',DESCRIPTION:'description',URL:'url',UID:'uid'}[key]]=unescape(value);
    if(key==='DTSTART'||key==='DTEND') {
      const zone=property.match(/TZID=([^;]+)/)?.[1]?.replace(/^"|"$/g,'')||'UTC',parsed=icsDate(value,zone);
      if(!parsed)continue;
      if(key==='DTSTART')Object.assign(current,{startDate:parsed.date,allDay:parsed.allDay,calendarDate:parsed.allDay?parsed.day:null});
      else {current.endDate=parsed.date;if(parsed.allDay){const day=new Date(parsed.date.getTime()-86400000).toISOString().slice(0,10);current.calendarLastDate=day}}
    }
  }
  return events;
}
module.exports={icsDate,parseCalendarICS};
