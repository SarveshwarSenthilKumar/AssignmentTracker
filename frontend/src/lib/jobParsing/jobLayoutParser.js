// Browser-local field extraction; mirrored from backend/jobLayoutParser.js.
const plain=value=>String(value||'').replace(/\s+/g,' ').trim()
const key=value=>plain(value).toLowerCase()
const role=/\b(?:engineer(?:ing)?|developer|analyst|intern(?:ship)?|assistant|associate|manager|coordinator|specialist|designer|technician|scientist|consultant|accountant|nurse|teacher|tutor|representative|administrator|officer|director|supervisor|researcher|cashier|barista|trainee|fellow|recruiter|counselor|aide|clerk|attendant|worker|operator|apprentice|writer|editor|marketer|lead)\b/i
const noise=/^(?:handshake|linkedin|indeed|jobs|events|employers|career center|messages|search|saved|for you|profile|notifications|back|apply|save|share|menu|sign in|log in|home|at a glance|job details|job description|company logo)\b/i
function validateJobLayout(input,raw){
  if(input===undefined)return []
  if(!Array.isArray(input)||input.length>4000)throw new Error('The document layout is too large. Import a shorter file.')
  const normalized=key(raw)
  return input.filter(line=>line&&typeof line.text==='string'&&line.text.length<=1000&&Number.isInteger(line.page)&&line.page>=1&&line.page<=12&&['x','y','width','height','confidence'].every(name=>Number.isFinite(line[name]))&&line.x>=0&&line.y>=0&&line.width>0&&line.height>0&&line.x<=1&&line.y<=1&&line.width<=1.05&&line.height<.3&&line.confidence>=0&&line.confidence<=100&&normalized.includes(key(line.text))).map(line=>({text:plain(line.text),page:line.page,x:line.x,y:line.y,width:line.width,height:line.height,confidence:line.confidence}))
}
function layoutMatches(layout,labels,isLabel,isSection){
  const matches=[]
  for(const line of layout){
    if(line.confidence<65)continue
    const field=Object.entries(labels).find(([,pattern])=>new RegExp(`^(?:${pattern})\\s*[:：]?$`,'i').test(line.text))?.[0]
    if(!field)continue
    const candidates=layout.filter(value=>value!==line&&value.page===line.page&&value.confidence>=65&&!isLabel(value.text)&&!isSection(value.text)&&!noise.test(value.text)).map(value=>{
      const sameRow=Math.abs(value.y-line.y)<=Math.max(line.height,value.height)*.65,rightGap=value.x-line.x-line.width,downGap=value.y-line.y-line.height
      const right=sameRow&&rightGap>=-.01&&rightGap<.25
      const below=downGap>=-.003&&downGap<Math.max(.03,line.height*2)&&Math.abs(value.x-line.x)<.06
      return {value,score:right?rightGap:below?0.1+downGap:Infinity}
    }).filter(candidate=>Number.isFinite(candidate.score)).sort((a,b)=>a.score-b.score)
    if(candidates.length&&(!candidates[1]||candidates[1].score-candidates[0].score>.008))matches.push({field,value:candidates[0].value.text,source:`${line.text}\n${candidates[0].value.text}`,confidence:Math.min(line.confidence,candidates[0].value.confidence)})
  }
  return matches
}
function headerSuggestions(layout){
  const top=layout.filter(line=>line.page===1&&line.y<.65&&line.confidence>=55&&line.text.length<170&&line.text.split(' ').length<=18&&!noise.test(line.text)&&!/[!?:]$/.test(line.text)&&!/required|experience|qualification|responsibilit|salary|deadline|looking for|we are|must have|years|applicants/i.test(line.text))
  const sizes=top.map(line=>line.height).sort((a,b)=>a-b),median=sizes[Math.floor(sizes.length/2)]||.015
  const candidates=top.filter(line=>role.test(line.text)).map(line=>({line,score:Math.min(2.8,line.height/median)+(1-line.y)*.5})).sort((a,b)=>b.score-a.score)
  if(!candidates.length||candidates[1]&&candidates[0].score-candidates[1].score<.25)return {}
  const title=candidates[0].line,result={title}
  const employers=top.filter(line=>line!==title&&!role.test(line.text)&&!/[$€£]|remote|hybrid|full.time|part.time|posted|ago|hour|apply|views/i.test(line.text)&&line.text.split(' ').length<=9&&Math.abs(line.x-title.x)<.14&&Math.abs(line.y-title.y)<.15).map(line=>({line,distance:Math.abs(line.y-title.y)})).sort((a,b)=>a.distance-b.distance)
  if(employers.length&&(!employers[1]||employers[1].distance-employers[0].distance>.012))result.company=employers[0].line
  return result
}
export {validateJobLayout,layoutMatches,headerSuggestions}
