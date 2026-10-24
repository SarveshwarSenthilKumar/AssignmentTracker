const roles=/\b(?:engineer(?:ing)?|developer|development|analyst|intern(?:ship)?|assistant|associate|manager|management|coordinator|specialist|designer|technician|scientist|consultant|accountant|nurse|teacher|tutor|representative|administrator|officer|director|supervisor|researcher|research|cashier|barista|trainee|fellow|recruiter|counselor|aide|clerk|attendant|worker|operator|apprentice|writer|editor|marketing|sales|lead|fellowship)\b/i
const chrome=/^(?:handshake|linkedin|indeed|jobs|events|employers|career center|messages|search|saved|for you|profile|notifications|back|apply|save|share|menu|sign in|log in|home|at a glance|job details|job description|company logo|open in|view all|page \d)\b/i
const states='Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia'
const codes='AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC'
const country='United States(?: of America)?|U\\.?S\\.?A?\\.?|United Kingdom|Canada|Australia|India|Germany|France|Singapore|Ireland|Netherlands|New Zealand'
const city=new RegExp(`^(?:[\\p{L}][\\p{L} .'-]{1,60},\\s*)?(?:${states}|${codes})(?:\\s+\\d{5}(?:-\\d{4})?)?(?:,?\\s*(?:${country}))?$`,'iu')
const abroad=new RegExp(`^[\\p{L}][\\p{L} .'-]{1,70},\\s*(?:${country})$`,'iu')
function locationValue(value){
  const line=value.trim().replace(/^[•·]\s*/,'')
  if(line.length>170||/eligib|authorized|must |resid|citizen|relocat|applic|located in|salary|posted/i.test(line))return ''
  if(/^(?:remote|hybrid|on[- ]site)(?:\s*[:·|–-]\s*[^.!?]{2,100})?$/i.test(line))return line
  const stripped=line.replace(/^(?:remote|hybrid|on[- ]site)\s*(?:in\s+|[·|–:-]\s*)/i,'').replace(/\s*(?:\(|[·|–-])\s*(?:remote|hybrid|on[- ]site)\)?$/i,'')
  return (city.test(stripped)||abroad.test(stripped))&&stripped.includes(',')?line:''
}
function inferHeaderFields(lines,isLabel,isSection,layout,knownTitle=''){
  // At-a-glance metadata is part of the header, not the start of prose.
  const body=lines.findIndex(line=>/^(?:description|job description|about (?:the|this) (?:role|job|position)|responsibilities|qualifications|requirements)\s*:?$/i.test(line))
  const header=lines.slice(0,Math.min(body>0?body:65,65))
  const usable=line=>line&&line.length<180&&!chrome.test(line)&&!isLabel(line)&&!isSection(line)&&!/[!?]$/.test(line)&&!/(?:\b(?:required|qualification|salary|deadline|applicants|looking for|must have|years of|we are|you will|you have)\b)|[$€£]/i.test(line)
  const normalizedRole=value=>value.replace(/([a-z])([A-Z])/g,'$1 $2')
  const candidates=header.map((text,index)=>({text,index})).filter(item=>usable(item.text)&&roles.test(normalizedRole(item.text))&&item.text.split(' ').length<=18&&!/\b(?:full[- ]time|part[- ]time|employment type|job type)\b/i.test(item.text))
  const sourceSize=text=>{const matched=layout.filter(line=>line.page===1&&line.text===text);return matched.length?Math.max(...matched.map(line=>line.height)):0}
  for(const candidate of candidates)candidate.score=(sourceSize(candidate.text)?Math.min(4,sourceSize(candidate.text)*120):0)+1-candidate.index*.025
  if(!candidates.length&&layout.length){
    const positioned=layout.filter(line=>line.page===1&&line.y<.65&&line.confidence>=50&&usable(line.text)&&line.text.length>=5&&line.text.length<150&&!locationValue(line.text)&&!/\b(?:inc|llc|ltd|university|college|company|corporation)\b/i.test(line.text)&&!/^(?:\d|remote|hybrid|full[- ]time|part[- ]time|internship$)/i.test(line.text)).sort((a,b)=>b.height-a.height||a.y-b.y)
    if(positioned.length){const best=positioned[0],index=header.findIndex(line=>line===best.text);if(index>=0)candidates.push({text:best.text,index,score:Math.min(4,best.height*120)+1-index*.025})}
  }
  candidates.sort((a,b)=>b.score-a.score)
  const result={};let titleIndex=-1
  if(candidates.length){
    const best=candidates[0];titleIndex=best.index;let title=best.text
    const next=header[best.index+1]
    if(next&&usable(next)&&roles.test(next)&&sourceSize(next)&&Math.abs(sourceSize(next)-sourceSize(best.text))<sourceSize(best.text)*.25&&next.length<100){title+=' '+next}
    // A prominent or early role-like header is useful as an explicitly marked
    // suggestion; do not discard the whole header because two lines tie.
    const at=title.match(/^(.+?)\s+at\s+(.+)$/i)
    result.title={text:at?at[1]:title,source:title}
    if(at)result.company={text:at[2],source:title}
  }
  if(knownTitle){const index=header.findIndex(line=>line.toLowerCase()===knownTitle.toLowerCase()||line.toLowerCase().startsWith(knownTitle.toLowerCase()+' at '));if(index>=0)titleIndex=index}
  const locations=header.filter(line=>locationValue(line))
  if(locations.length)result.location={text:[...new Set(locations)].join(' · '),source:locations.join('\n')}
  if(titleIndex>=0&&!result.company){
    const nearby=[]
    for(const offset of [-1,1,-2,2,-3,3]){
      const value=header[titleIndex+offset]
      const organization=/\b(?:inc\.?|llc|ltd\.?|corporation|company|university|college|technologies|solutions|labs|systems|group|partners|foundation|department|services)\b/i.test(value||'')
      if(!usable(value)||value.length>110||value.split(' ').length>12||locationValue(value)||roles.test(value)&&!organization||/remote|hybrid|full.time|part.time|posted|ago|hour|views|followers|employees|ratings|reviews|website/i.test(value))continue
      nearby.push({text:value,score:(organization?2:0)+(offset<0?0.6:0)-Math.abs(offset)*.2})
    }
    nearby.sort((a,b)=>b.score-a.score)
    if(nearby.length)result.company={text:nearby[0].text,source:`Employer header near title: ${nearby[0].text}`}
  }
  return result
}
module.exports={inferHeaderFields,locationValue};
