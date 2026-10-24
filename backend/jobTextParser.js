const fieldLimits={title:300,company:300,location:1000,employmentType:500,salary:500,datePosted:100,validThrough:100,description:30000,requirements:30000,responsibilities:30000,benefits:10000};
const {validateJobLayout,layoutMatches,headerSuggestions}=require('./jobLayoutParser');
const labels={
  title:'job title|position title|position|role title|title',company:'company name|employer name|company|employer|organization',location:'job location|work location|location',employmentType:'employment type|employment status|job type|position type',salary:'salary range|pay range|compensation range|salary|pay rate|hourly rate|annual salary|base salary|pay',datePosted:'date posted|posted on|posting date',validThrough:'application deadline|applications close|apply by|closing date|deadline|valid through'
};
const sections={requirements:/^(?:(?:minimum|required|preferred|desired|basic|key)\s+)?(?:qualifications|requirements|experience|skills|education|what you (?:bring|need)|about you)(?:\s+(?:and|&)\s+(?:skills|experience|qualifications|requirements))?$/i,responsibilities:/^(?:responsibilities|what you(?:'|’)ll do|what you will do|the role|duties|key responsibilities|your responsibilities|essential duties(?: and responsibilities)?)$/i,benefits:/^(?:benefits|what we offer|perks|compensation(?: and benefits)?|our benefits)$/i};
const stop=/^(?:about (?:us|the company|the employer|the team)|company overview|how to apply|application process|equal (?:employment )?opportunity|privacy policy|similar jobs|recommended jobs|other jobs|more jobs|applicant privacy|at a glance|job details|job description|about (?:the|this) (?:job|role|position))$/i;
const navigation=/^(?:handshake|linkedin|indeed|jobs|events|employers|career center|messages|search(?: jobs)?|saved(?: jobs)?|for you|profile|notifications|back to jobs|skip to (?:main )?content|apply(?: now)?|save(?: job)?|share(?: job)?|menu|sign in|log in|home|my jobs|at a glance|job details|job description|company logo)$/i;
const normalize=value=>value.replace(/[\s\u00a0]+/g,' ').trim();
const heading=value=>normalize(value).replace(/^[•*#\-]+\s*/,'').replace(/[:：]\s*$/,'');
const typePattern=/^(?:full[- ]time|part[- ]time|internship|contract(?:or)?|temporary|seasonal|co[- ]op|on[- ]campus(?: student employment)?)(?:\s*[,·|/]\s*(?:full[- ]time|part[- ]time|internship|contract|temporary|seasonal|remote|hybrid|on[- ]site))*$/i;
const payPattern=/(?:USD|CAD|AUD|EUR|GBP|[$€£])\s*\d[\d,.]*(?:\s*[kK])?(?:\s*(?:-|–|—|to)\s*(?:(?:USD|CAD|AUD|EUR|GBP|[$€£])\s*)?\d[\d,.]*(?:\s*[kK])?)?(?:\s*(?:(?:\/|per\s+|an?\s+)(?:hr|hour|year|yr|month|week)|hourly|annually))?/gi;

function parseJobText(input,url='',documentLayout){
  const raw=String(input).replace(/\r\n?/g,'\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').trim();
  if(raw.length<100)throw new Error('Not enough job text was readable. Include the title and full description.');
  if(raw.length>60000)throw new Error('Import one job posting with up to 60,000 characters.');
  const lines=raw.split('\n').flatMap(line=>line.split(/\s+[•·]\s+/)).map(normalize).filter(Boolean),evidence={},matches=new Map(),warnings=[];
  const layout=validateJobLayout(documentLayout,raw);
  const result={url,...Object.fromEntries(Object.keys(fieldLimits).map(key=>[key,''])),source:'Pasted job text'};
  const labelPatterns=Object.entries(labels).map(([field,pattern])=>({field,inline:new RegExp(`^(?:${pattern})\\s*[:：]\\s*(.+)$`,'i'),alone:new RegExp(`^(?:${pattern})\\s*[:：]?$`,'i')}));
  const isLabel=line=>labelPatterns.some(p=>p.inline.test(line)||p.alone.test(line));
  const isSection=line=>stop.test(heading(line))||Object.values(sections).some(pattern=>pattern.test(heading(line)));
  const add=(field,value,line,score)=>{
    value=normalize(value);if(!value||value.length>fieldLimits[field]||navigation.test(value)||isSection(value)||isLabel(value))return;
    if(field==='employmentType'&&!typePattern.test(value))return;
    if(field==='salary'&&!/(?:[$€£]|\b(?:USD|CAD|AUD|EUR|GBP)\b)\s*\d/i.test(value))return;
    if(['datePosted','validThrough'].includes(field)&&(!/\d/.test(value)||/(?:benefits|qualifications|responsibilities|experience)/i.test(value)))return;
    if(['title','company','location'].includes(field)&&value.split(' ').length>(field==='location'?18:field==='title'?18:12))return;
    if(!matches.has(field))matches.set(field,[]);matches.get(field).push({value,line,score});
  };
  const firstSection=lines.findIndex(line=>Object.values(sections).some(pattern=>pattern.test(heading(line)))||/^(?:job description|about (?:the|this) (?:job|role|position))$/i.test(heading(line))),headerEnd=Math.min(firstSection<0?80:firstSection,80)
  for(let index=0;index<lines.length;index++){
    const line=lines[index];
    for(const pattern of labelPatterns){
      const inline=line.match(pattern.inline);
      if(inline){
        // Side-by-side labels are split rather than becoming part of the value.
        const value=inline[1].split(new RegExp(`\\s+(?:(?:${Object.values(labels).join('|')})\\s*[:：])`,'i'))[0];
        add(pattern.field,value,line,1);
      }else if(!layout.length&&pattern.alone.test(line)&&lines[index+1]&&!isLabel(lines[index+1])&&!isSection(lines[index+1]))add(pattern.field,lines[index+1],`${line}\n${lines[index+1]}`,.95);
    }
    // Restrict standalone metadata to the header, before descriptive body sections.
    const inHeader=index<headerEnd||index<80&&/^(?:at a glance|job details)$/i.test(heading(lines[Math.max(0,index-1)]));
    if(inHeader&&typePattern.test(line))add('employmentType',line,line,.85);
    if(inHeader&&!typePattern.test(line)&&line.length<100&&!/[.!?]$/.test(line)&&/^(?:internship|full[- ]time|part[- ]time|co[- ]op|temporary|seasonal|contract)\b/i.test(line)){
      const types=line.match(/\b(?:internship|full[- ]time|part[- ]time|co[- ]op|temporary|seasonal|contract)\b/gi);if(types?.length)add('employmentType',[...new Set(types)].join(' / '),line,.85);
    }
    if(inHeader&&/^(?:remote|hybrid|on[- ]site)(?:\s*[-–·|:,]\s*.{2,90})?$/i.test(line))add('location',line,line,.8);
    if(inHeader&&line.length<120&&/^(?:[\p{L}][\p{L} .'-]+,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)(?:\s+\d{5}(?:-\d{4})?)?|[\p{L} .'-]+,\s*(?:United States|USA|United Kingdom|Canada|Australia))(?:\s*[·|–-]\s*(?:remote|hybrid|on[- ]site))?$/u.test(line))add('location',line,line,.85);
    if(inHeader&&line.length<160&&!/bonus|benefit|reimbursement|tuition|retirement|insurance|relocation/i.test(line)){
      const withUnit=/(?:\/|per\s+|an?\s+)(?:hr|hour|year|yr|month|week)|hourly|annually/i.test(line)?line:line+' '+(/^(?:(?:per|an?)\s+)?(?:hour|hr|year|yr|month|week)(?:ly)?$/i.test(lines[index+1]||'')?lines[index+1]:'');
      const pay=[...withUnit.matchAll(payPattern)];
      if(pay.length===1&&/(?:\/|per\s+|an?\s+)(?:hr|hour|year|yr|month|week)|hourly|annually/i.test(pay[0][0]))add('salary',pay[0][0],line,.85);
    }
  }
  for(const match of layoutMatches(layout,labels,isLabel,isSection))add(match.field,match.value,match.source,.96);
  for(const [field,candidates]of matches){
    const strongest=Math.max(...candidates.map(c=>c.score)),best=candidates.filter(c=>c.score>=(strongest>=.9?.9:strongest-.03)),unique=[...new Map(best.map(c=>[c.value.toLowerCase(),c])).values()];
    if(unique.length===1){result[field]=unique[0].value;evidence[field]={status:'matched',confidence:strongest,source:unique[0].line}}
    else if(field==='employmentType'&&unique.length<=3&&!(/full[- ]time/i.test(unique.map(c=>c.value).join(' '))&&/part[- ]time/i.test(unique.map(c=>c.value).join(' ')))){result[field]=[...new Set(unique.map(c=>c.value))].join(' / ');evidence[field]={status:'matched',confidence:strongest,source:unique.map(c=>c.line).join('\n')}}
    else{evidence[field]={status:'conflicting',confidence:0,source:unique.map(c=>c.line).slice(0,4).join('\n')};warnings.push(`Conflicting ${field} values were found; that field was left blank.`)}
  }
  if(!matches.has('title')){
    const roleWords=/\b(?:engineer|developer|analyst|intern(?:ship)?|assistant|associate|manager|coordinator|specialist|designer|technician|scientist|consultant|accountant|nurse|teacher|tutor|representative|administrator|officer|director|supervisor|researcher|cashier|barista|trainee|fellow|recruiter|counselor|aide|clerk|attendant|worker|operator|apprentice|writer|editor|marketer|lead)\b/i;
    const header=lines.slice(0,Math.min(24,headerEnd));
    const candidates=header.filter(line=>line.length<=160&&line.split(' ').length<=16&&!navigation.test(line)&&!isLabel(line)&&!typePattern.test(line)&&!/[.!?]$/.test(line)&&!/(?:salary|apply|posted|deadline|experience|required|looking for|hiring|\d+ applicants)/i.test(line)&&roleWords.test(line));
    const unique=[...new Set(candidates)];
    if(unique.length===1){const at=unique[0].match(/^(.+?)\s+at\s+(.+)$/i);result.title=at?at[1]:unique[0];evidence.title={status:'suggested',confidence:.7,source:unique[0]};if(at&&!matches.has('company')){result.company=at[2];evidence.company={status:'suggested',confidence:.7,source:unique[0]}}}
  }
  const suggested=headerSuggestions(layout);
  for(const field of ['title','company']){
    if(!matches.has(field)&&suggested[field]){
      result[field]=suggested[field].text;evidence[field]={status:'suggested',confidence:.75,source:`Page ${suggested[field].page}, document heading: ${suggested[field].text}`};
    }
  }
  if(result.title&&!result.company&&!matches.has('company')&&!layout.length){
    const at=lines.findIndex(line=>line===result.title),neighbors=[lines[at-1],lines[at+1]].filter(Boolean);
    const company=neighbors.filter(line=>line.length<100&&!isLabel(line)&&!isSection(line)&&!navigation.test(line)&&!/[$€£\d]|full[- ]time|part[- ]time|remote|hybrid|internship|location/i.test(line)&&/\b(?:inc\.?|llc|ltd\.?|corporation|company|university|college|technologies|solutions|labs|systems|group|partners|association|foundation)\b/i.test(line));
    if(company.length===1){result.company=company[0];evidence.company={status:'suggested',confidence:.7,source:`Employer beside the title: ${company[0]}`}}
  }
  // Sensitive numeric fields must not be taken from weakly recognized lines.
  for(const field of ['salary','datePosted','validThrough'])if(result[field]&&layout.length){
    const value=result[field].toLowerCase(),source=layout.filter(line=>line.text.toLowerCase().includes(value));
    if(source.length&&source.every(line=>line.confidence<80)){result[field]='';evidence[field]={status:'uncertain',source:source.map(line=>line.text).join('\n'),confidence:0};warnings.push(`The ${field} text had low OCR confidence and was left blank.`)}
  }
  const buckets={requirements:[],responsibilities:[],benefits:[]};let active=null;
  for(const line of lines){
    const title=heading(line),section=Object.keys(sections).find(key=>sections[key].test(title));
    if(section){active=section;continue}
    if(stop.test(title)||isLabel(line)){active=null;continue}
    if(active&&!navigation.test(line))buckets[active].push(line);
  }
  for(const [field,values]of Object.entries(buckets))if(values.length){result[field]=values.join('\n').slice(0,fieldLimits[field]);evidence[field]={status:'matched',confidence:.9,source:'Recognized section heading and following text'}}
  const descriptionStart=lines.findIndex(line=>/^(?:job description|position description|description|about (?:the|this) (?:job|role|position)|about the opportunity)\s*[:：]?$/i.test(line));
  const selectedValues=new Set(['title','company','location','salary','employmentType','datePosted','validThrough'].map(field=>result[field]?.toLowerCase()).filter(Boolean));
  let metadataEnd=-1;
  for(let index=0;index<Math.min(headerEnd,40);index++)if(selectedValues.has(lines[index].toLowerCase())||isLabel(lines[index]))metadataEnd=index;
  const intro=[];let inSection=false;
  for(let index=descriptionStart>=0?descriptionStart+1:0;index<lines.length;index++){
    const line=lines[index],title=heading(line);
    if(Object.values(sections).some(pattern=>pattern.test(title))){inSection=true;continue}
    if(stop.test(title)){inSection=true;continue}
    if(inSection||isLabel(line)||navigation.test(line)||selectedValues.has(line.toLowerCase()))continue;
    if(descriptionStart<0&&index<=metadataEnd)continue;
    intro.push(line);
  }
  result.description=intro.join('\n').slice(0,30000);
  if(!result.description&&!result.requirements&&!result.responsibilities&&!result.benefits){result.description=raw.slice(0,30000);warnings.push('The body structure was unclear. The full source was retained in Description for review.');}
  if(raw.length>30000)warnings.push('The description was shortened to 30,000 characters. Full recognized text remains available for review.');
  for(const field of ['title','company','location','salary'])if(!result[field])warnings.push(`No reliable ${field} match; enter it manually or select it from the recognized text.`);
  return {...result,fieldEvidence:evidence,warnings};
}
module.exports={parseJobText};
