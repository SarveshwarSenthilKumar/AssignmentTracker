function handshakeLink(value){
  let url;try{url=new URL(value)}catch{return null}
  if(url.protocol!=='https:'||!(url.hostname==='joinhandshake.com'||url.hostname.endsWith('.joinhandshake.com')))return null;
  const match=url.pathname.match(/^\/(?:stu\/|emp\/)?jobs\/(\d+)(?:\/|$)/);
  return {url:url.href,id:match?.[1]||null,publicURL:match?`https://app.joinhandshake.com/jobs/${match[1]}`:null};
}
function accessError(){
  const error=new Error('Handshake did not expose this job publicly. Open the posting while signed in to your school’s Handshake account, copy the job title and full description, then use Import from copied job text below. The importer cannot use your browser’s signed-in session.');
  error.code='HANDSHAKE_ACCESS_REQUIRED';return error;
}
async function importHandshake(link,fetchPage,extractPage){
  if(!link.id){const error=new Error('Paste a direct Handshake job link, such as /jobs/123456 or /stu/jobs/123456, rather than a search or login page.');error.code='HANDSHAKE_JOB_LINK_REQUIRED';throw error;}
  const candidates=[link.url];if(link.publicURL!==link.url)candidates.push(link.publicURL);
  for(const url of candidates){
    try{
      const page=await fetchPage(url),final=new URL(page.url);
      if(/\/(?:login|access|signin|sign_in|users\/sign_in|school_registrations)(?:\/|$)/i.test(final.pathname))continue;
      const data=extractPage(page.html,page.url);
      if(/^(?:handshake|join handshake|find your next job|jobs and internships)(?:\s*[|–-].*)?$/i.test(data.title||'')||/sign in to (?:view|see)|log in to (?:view|see)|job (?:is )?no longer available/i.test(data.description||''))continue;
      data.url=link.url;data.source=`Handshake · ${data.source}`.slice(0,100);
      if(!data.company){const match=data.title?.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|–]\s*Handshake)?$/i);if(match){data.title=match[1];data.company=match[2]}}
      data.title=data.title?.replace(/\s*[|–-]\s*Handshake\s*$/i,'');
      return data;
    }catch{/* Public or school-only Handshake pages may require browser authentication. */}
  }
  throw accessError();
}
function handshakeText(input,url,fromText){
  const lines=input.replace(/\r/g,'').split('\n').map(line=>line.trim()).filter(Boolean);
  const navigation=/^(?:handshake|jobs|events|employers|career center|messages|search|saved|for you|profile|notifications|back to jobs|skip to content)$/i;
  while(lines.length&&navigation.test(lines[0]))lines.shift();
  const result=fromText(lines.join('\n'),url);result.source='Handshake copied job text';
  result.warnings.unshift('Check recognized text against the Handshake page. Unlabeled employer names and uncertain values are left blank.');
  return result;
}
module.exports={handshakeLink,importHandshake,handshakeText};
