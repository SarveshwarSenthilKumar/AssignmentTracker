const cheerio=require('cheerio');
const {handshakeLink,importHandshake}=require('./handshakeJobs');
const text=(value,max=30000)=>{
  if(Array.isArray(value))return value.map(v=>text(v,max)).filter(Boolean).join('\n').slice(0,max);
  if(value&&typeof value==='object')return text(value.name||value.description||value.value||'',max);
  const $=cheerio.load(String(value??''),{},false);
  $('script,style,noscript,svg').remove();$('br').replaceWith('\n');$('p,div,li,h1,h2,h3,h4,section').append('\n');
  return $.root().text().replace(/[ \t\r]+/g,' ').replace(/\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim().slice(0,max);
};
const sections={requirements:/^(?:(?:minimum|required|preferred|desired|basic)\s+)?(?:qualifications|requirements|experience|skills|education|what you (?:bring|need)|about you)\s*[:：]?$/i,responsibilities:/^(?:responsibilities|what you(?:'|’)ll do|what you will do|the role|duties|key responsibilities|your responsibilities)\s*[:：]?$/i,benefits:/^(?:benefits|what we offer|perks|compensation(?: and benefits)?|our benefits)\s*[:：]?$/i};
const {parseJobText:fromText}=require('./jobTextParser');
function normalize(job,url,source){
  const salary=job.baseSalary,value=salary?.value;
  const location=[job.jobLocation].flat().filter(Boolean).map(place=>{const a=place.address||place;return typeof a==='string'?a:[a.streetAddress,a.addressLocality,a.addressRegion,text(a.addressCountry)].filter(Boolean).join(', ')});
  if(job.jobLocationType==='TELECOMMUTE')location.unshift('Remote');
  return {url,title:text(job.title,300),company:text(job.hiringOrganization,300),location:text(location,1000),employmentType:text(job.employmentType,500),salary:typeof salary==='string'||typeof salary==='number'?String(salary):[salary?.currency||job.salaryCurrency,typeof value==='number'?value:value?.value??[value?.minValue,value?.maxValue].filter(v=>v!==undefined).join(' – '),value?.unitText].filter(v=>v!==undefined&&v!=='').join(' '),datePosted:text(job.datePosted,100),validThrough:text(job.validThrough,100),description:text(job.description),requirements:text([job.qualifications,job.skills,job.educationRequirements,job.experienceRequirements]),responsibilities:text(job.responsibilities),benefits:text(job.jobBenefits),source};
}
function extractPage(html,url){
  const $=cheerio.load(html),postings=[];let nodes=0;
  const visit=(value,depth=0)=>{
    if(!value||typeof value!=='object'||depth>14||++nodes>10000)return;
    if(Array.isArray(value)){value.slice(0,150).forEach(v=>visit(v,depth+1));return}
    const type=[value['@type']].flat();
    if(type.some(t=>typeof t==='string'&&/(^|[\/#:])JobPosting$/.test(t))){postings.push(value);return}
    // Includes Next.js and other embedded application state, without executing it.
    if(typeof value.title==='string'&&typeof value.description==='string'&&(value.hiringOrganization||value.jobLocation||value.employmentType)){postings.push(value);return}
    for(const child of Object.values(value))if(child&&typeof child==='object')visit(child,depth+1);
  };
  $('script').each((_,el)=>{const type=($(el).attr('type')||'').toLowerCase();if(type.includes('json')||$(el).attr('id')==='__NEXT_DATA__'){try{visit(JSON.parse($(el).text()))}catch{}}});
  const unique=[...new Map(postings.map(p=>[`${p.title}\n${p.description}`,p])).values()];
  const comparable=value=>{try{const u=new URL(value,url);return u.origin+u.pathname.replace(/\/$/,'')}catch{return ''}};
  const exact=unique.filter(p=>p.url&&comparable(p.url)===comparable(url));
  const chosen=exact.length===1?exact[0]:unique.length===1?unique[0]:null;
  if(chosen)return normalize(chosen,url,'Structured / embedded job data');
  if(unique.length>1)throw new Error('This page contains several jobs. Use a direct link to one specific posting.');
  const micro=$('[itemscope][itemtype*="JobPosting"]').first();
  if(micro.length){const job={};for(const field of ['title','description','employmentType','datePosted','validThrough','qualifications','responsibilities','skills','jobBenefits','hiringOrganization','jobLocation']){const node=micro.find(`[itemprop="${field}"]`).first();job[field]=node.attr('content')||node.attr('datetime')||node.html()||''}if(job.title&&job.description)return normalize(job,url,'Job posting microdata')}
  const meta=name=>$(`meta[property="${name}"],meta[name="${name}"]`).first().attr('content')||'';
  const title=text($('h1.top-card-layout__title,h1.topcard__title,.posting-headline h2,h1.job-title,h1').first().text()||meta('og:title')||$('title').text(),300);
  if(/^(?:just a moment|access denied|attention required|sign in|log in|security verification|robot check)/i.test(title)||/cf-chl-|captcha-container|challenge-platform/.test(html))throw new Error('The website requires a browser or blocks automated access. Open the posting and paste its text below to import automatically.');
  $('script,style,noscript,svg,nav,footer,header,form,button,[aria-hidden="true"]').remove();
  const selectors=['.show-more-less-html__markup','.jobs-description__content','.posting-page .content','.posting-description','#job-description','#jobDescriptionText','[data-testid="job-description"]','[itemprop="description"]','.job-description','.jobDescription','.job-detail-description','main article','article','main','[role="main"]'];
  let body='';for(const selector of selectors){const candidate=text($(selector).first().html());if(candidate.length>=150){body=candidate;break}}
  if(!body)body=text($('body').html());
  const meaningful=/responsibilit|qualifications|requirements|employment|apply (?:now|for)|job description|about (?:the|this) (?:role|job|position)|what you/i.test(body);
  if(!title||!meaningful||body.length<150)throw new Error('The page did not expose a readable job description. Open it in your browser and paste the job text below.');
  const result=fromText(`${title}\n${body}`,url);
  result.title=title;result.source='Page content / metadata';
  result.company=text($('.topcard__org-name-link,.topcard__flavor--black,.company-name,[data-testid="company-name"]').first().text(),300)||result.company||'';
  result.location=text($('.topcard__flavor--bullet,.location,[data-testid="job-location"]').first().text(),1000)||result.location||'';
  return result;
}
async function importJob(url,fetchPage){
  const handshake=handshakeLink(url);
  if(handshake)return importHandshake(handshake,fetchPage,extractPage);
  const u=new URL(url),parts=u.pathname.split('/').filter(Boolean);
  let endpoint='',provider='';
  if(['boards.greenhouse.io','job-boards.greenhouse.io','boards.eu.greenhouse.io','job-boards.eu.greenhouse.io'].includes(u.hostname)&&parts[1]==='jobs'&&/^[\w-]+$/.test(parts[0])&&/^\d+$/.test(parts[2]||'')){
    endpoint=`https://boards-api.greenhouse.io/v1/boards/${parts[0]}/jobs/${parts[2]}`;provider='greenhouse';
  }
  if(['jobs.lever.co','jobs.eu.lever.co'].includes(u.hostname)&&/^[\w-]+$/.test(parts[0]||'')&&/^[\w-]+$/.test(parts[1]||'')){
    endpoint=`https://${u.hostname==='jobs.eu.lever.co'?'api.eu.lever.co':'api.lever.co'}/v0/postings/${parts[0]}/${parts[1]}?mode=json`;provider='lever';
  }
  if(endpoint){
    try{
      const response=await fetchPage(endpoint,true),data=JSON.parse(response.html);
      if(provider==='greenhouse'&&data.title&&data.content)return normalize({title:data.title,description:data.content,jobLocation:data.location?.name},url,'Greenhouse public posting API');
      if(provider==='lever'&&data.text&&data.description){const result=normalize({title:data.text,description:data.description,jobLocation:data.categories?.location,employmentType:data.categories?.commitment,jobLocationType:data.workplaceType==='remote'?'TELECOMMUTE':''},url,'Lever public posting API');for(const list of data.lists||[]){const name=list.text||'';const field=Object.keys(sections).find(key=>sections[key].test(name));if(field)result[field]=text(list.content);else result.description+='\n\n'+text(name)+'\n'+text(list.content)}if(data.additional)result.description+='\n\n'+text(data.additional);return result}
    }catch{/* Try the public page if the documented posting endpoint is unavailable. */}
  }
  const page=await fetchPage(url);return extractPage(page.html,page.url);
}
module.exports={importJob,fromText};
