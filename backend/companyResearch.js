const cheerio=require('cheerio');
const {pageHTML,safeURL}=require('./jobs');
const {safeMessage}=require('./assistantDiagnostics');
const cache=new Map();
const boards=/(^|\.)(linkedin\.com|indeed\.com|glassdoor\.com|joinhandshake\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|workdayjobs\.com|smartrecruiters\.com|icims\.com|ashbyhq\.com|workable\.com|bamboohr\.com)$/i;
function checkIdentity(result,company){
  const words=String(company||'').toLowerCase().split(/[^a-z0-9]+/).filter(word=>word.length>3&&!['limited','company','corporation','incorporated','group'].includes(word));
  const first=result.sources[0];
  return words.length&&first&&!words.some(word=>`${first.title} ${first.text}`.toLowerCase().includes(word))?{...result,warnings:[...result.warnings,'Confirm this website belongs to the saved employer; the home-page text did not clearly match its name.']}:result;
}
function companyURL(value){
  if(typeof value!=='string'||!value.trim()||value.length>2048)throw new Error('Enter the company’s official website to research it.');
  const url=safeURL(/^https?:\/\//i.test(value.trim())?value.trim():`https://${value.trim()}`);
  if(boards.test(url.hostname))throw new Error('Enter the employer’s official company website, rather than a job board or application portal.');
  url.hash='';url.search='';return url;
}
function readable(page){
  const $=cheerio.load(page.html),title=$('title').first().text().trim().slice(0,180);
  $('script,style,noscript,nav,header,footer,form,svg,iframe,[hidden],[aria-hidden="true"],.cookie-banner,#cookie-banner').remove();
  const area=$('main,[role="main"]').first(),root=area.length?area:$('body'),seen=new Set(),lines=[];
  root.find('h1,h2,h3,p,li').each((_,node)=>{const line=$(node).text().replace(/\s+/g,' ').trim();if(line.length>=20&&!seen.has(line)){seen.add(line);lines.push(line)}});
  const text=(lines.join('\n')||root.text().replace(/\s+/g,' ').trim()).slice(0,3500);
  return {title:title||new URL(page.url).hostname,text,url:page.url};
}
module.exports=async function companyResearch(value,{signal,company}={}){
  const url=companyURL(value),cached=cache.get(url.href);
  if(cached&&Date.now()-cached.at<30*60000)return checkIdentity({...cached.result,cached:true},company);
  const controller=new AbortController(),abort=()=>controller.abort(),timer=setTimeout(abort,18000);
  if(signal?.aborted)controller.abort();else signal?.addEventListener('abort',abort,{once:true});
  const warnings=[];
  try{
    const fetchPage=address=>pageHTML(address,false,{signal:controller.signal,timeoutMs:8000,maxBytes:2*1024*1024});
    const home=await fetchPage(url.href),homeURL=companyURL(home.url),first=readable(home);
    if(first.text.length<120)throw new Error('The website did not provide readable public company information (it may require JavaScript or block automated access).');
    const $=cheerio.load(home.html),links=[];
    $('a[href]').each((_,node)=>{
      try{
        const next=new URL($(node).attr('href'),homeURL),label=$(node).text().replace(/\s+/g,' ').trim();
        if(next.protocol!=='https:'||next.hostname!==homeURL.hostname||next.username||next.password||next.pathname===homeURL.pathname)return;
        next.hash='';next.search='';
        const target=`${next.pathname} ${label}`;
        const score=/about|our-company|who-we-are|our-story/i.test(target)?3:/products|solutions|what-we-do/i.test(target)?2:/careers|values|mission|culture/i.test(target)?1:0;
        if(score&&!links.some(item=>item.url===next.href))links.push({url:next.href,score});
      }catch{}
    });
    links.sort((a,b)=>b.score-a.score);
    const additional=await Promise.allSettled(links.slice(0,2).map(item=>fetchPage(item.url)));
    const sources=[first];
    for(const result of additional){
      if(result.status==='fulfilled'){
        const page=result.value;
        if(new URL(page.url).hostname!==homeURL.hostname){warnings.push('A linked company page redirected to another website and was excluded.');continue}
        const source=readable(page);if(source.text.length>=120)sources.push(source);
      }else warnings.push('One linked company page could not be read; only the accessible sources were used.');
    }
    const result={requestedUrl:url.href,sources,warnings,fetchedAt:new Date().toISOString(),cached:false};
    if(cache.size>=40)cache.delete(cache.keys().next().value);
    cache.set(url.href,{at:Date.now(),result});return checkIdentity(result,company);
  }catch(error){if(signal?.aborted)throw error;return {requestedUrl:url.href,sources:[],warnings:[`Company website research was unavailable: ${safeMessage(error.message)||'The public pages could not be read.'} Tailoring used only your resumes and job details; no company facts were guessed.`],fetchedAt:new Date().toISOString()}}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',abort)}
};
