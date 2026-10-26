const http=require('node:http');
const https=require('node:https');
const dns=require('node:dns').promises;
const ipaddr=require('ipaddr.js');
const cheerio=require('cheerio');
const zlib=require('node:zlib');
function readerError(category,message,details={}){const error=new Error(message);error.category=category;error.details=details;return error}

function publicIP(address){
  try{let ip=ipaddr.parse(address);if(ip.kind()==='ipv6'&&ip.isIPv4MappedAddress())ip=ip.toIPv4Address();return ip.range()==='unicast'}catch{return false}
}
async function readPage(input,signal,redirects=0,policyOnly=false){
  if(redirects>4)throw new Error('This page redirects too many times.');
  const url=new URL(input);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.href.length>2000||url.port&&!['80','443'].includes(url.port))throw new Error('Use a public http or https webpage address.');
  const hostname=url.hostname.replace(/^\[|\]$/g,'');
  const addresses=await dns.lookup(hostname,{all:true,verbatim:true});
  if(signal.aborted)throw new Error('The reference request timed out.');
  if(!addresses.length||addresses.some(item=>!publicIP(item.address)))throw new Error('Only public internet webpages can be read.');
  const pinned=addresses[0];
  const page=await new Promise((resolve,reject)=>{
    const request=(url.protocol==='https:'?https:http).get(url,{signal,agent:false,headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36','Accept':'text/html, application/xhtml+xml, application/json;q=0.9, text/plain;q=0.8','Accept-Language':'en-US,en;q=0.9','Accept-Encoding':'gzip, deflate, br'},lookup:(_host,options,callback)=>options?.all?callback(null,[pinned]):callback(null,pinned.address,pinned.family)},response=>{
      response.on('error',reject);
      if([301,302,303,307,308].includes(response.statusCode)){const redirect=response.headers.location;response.destroy();return resolve({redirect})}
      if(policyOnly){
        const headers={status:response.statusCode,xFrameOptions:String(response.headers['x-frame-options']||'').slice(0,500),csp:String(response.headers['content-security-policy']||'').slice(0,16000)}
        resolve({policy:headers});response.destroy();return
      }
      if(response.statusCode<200||response.statusCode>=300){
        response.destroy();const status=response.statusCode,source=url.hostname;
        const message=status===401?'This page requires authentication that the reader does not have.':status===403?'This website blocks automated reader access.':status===404?'This webpage was not found.':status===429?'This website is rate-limiting reader requests. Wait before trying again.':status>=500?'The reference website returned a server error.':'The reference website returned an unsuccessful response.';
        return reject(readerError(status===401?'authentication':status===403?'website_block':status===429?'rate_limit':'website_http',`${message} (${source}, HTTP ${status})`,{source,providerStatus:status}));
      }
      const type=String(response.headers['content-type']||'');
      if(!/text\/(html|plain|markdown|x-markdown)|application\/(xhtml\+xml|json)/i.test(type)){response.resume();return reject(new Error('This address is not a readable webpage. Open files in Documents or use the full browser.'))}
      const encoding=String(response.headers['content-encoding']||'identity').toLowerCase();
      const decoder=encoding==='gzip'?zlib.createGunzip():encoding==='br'?zlib.createBrotliDecompress():encoding==='deflate'?zlib.createInflate():null;
      if(!decoder&&encoding!=='identity'){response.resume();return reject(readerError('encoding','This website uses a response encoding the reader cannot decode.'))}
      const stream=decoder?response.pipe(decoder):response;
      const chunks=[];let size=0;
      stream.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){stream.destroy();response.destroy();reject(new Error('This page is too large for the phone reader.'))}else chunks.push(chunk)});
      response.on('error',error=>{decoder?.destroy();reject(error)});stream.on('error',reject);stream.on('end',()=>{
        const bytes=Buffer.concat(chunks),charset=type.match(/charset\s*=\s*["']?([^;\s"']+)/i)?.[1]||'utf-8';let html;
        try{html=new TextDecoder(charset).decode(bytes)}catch{html=bytes.toString('utf8')}
        resolve({html,plain:/text\/(plain|markdown|x-markdown)/i.test(type),markdown:/text\/(markdown|x-markdown)/i.test(type)||/\.(md|markdown)$/i.test(url.pathname),json:/application\/json/i.test(type)});
      });
    });request.on('error',reject);request.setTimeout(10000,()=>request.destroy(new Error('The website took too long to respond.')));
  });
  if(page.redirect){const next=new URL(page.redirect,url);if(url.protocol==='https:'&&next.protocol!=='https:')throw new Error('This page redirects to an insecure address. Use the full browser.');return readPage(next.href,signal,redirects+1,policyOnly)}
  if(page.policy)return {url:url.href,...page.policy};
  if(page.json)return {json:JSON.parse(page.html),url:url.href};
  if(page.plain)return {url:url.href,title:url.hostname,...(page.markdown?{markdown:page.html.slice(0,60000)}:{}),blocks:[{type:'pre',text:page.html.slice(0,60000)}],links:[]};
  const $=cheerio.load(page.html);const title=$('title').first().text().trim().slice(0,300)||url.hostname;
  // Retain source TeX instead of flattening rendered KaTeX/MathML into duplicate text.
  $('.katex-display,.katex,math,mjx-container,script[type^="math/tex"],img.mwe-math-fallback-image-inline,img.mwe-math-fallback-image-display').each((_index,node)=>{
    const item=$(node),annotation=item.find('annotation').filter((_i,entry)=>/tex/i.test($(entry).attr('encoding')||'')).first()
    const tex=(annotation.text()||(node.tagName==='script'?item.text():'')||item.attr('alttext')||item.attr('alt')||'').trim().slice(0,10000)
    if(!tex)return
    const display=/display/.test(item.attr('class')||'')||item.attr('display')==='block'||/mode\s*=\s*display/.test(item.attr('type')||'')
    item.replaceWith($('<span>').attr('data-phone-math','true').text(display?`\n\n$$\n${tex}\n$$\n\n`:`$${tex}$`))
  });
  if(/^(just a moment|access denied|attention required|security check|captcha)/i.test(title)||/\/cdn-cgi\/challenge-platform\//i.test(page.html))throw readerError('website_protection',`This website requires a browser security challenge (${url.hostname}). The reader cannot complete it.`,{source:url.hostname,providerStatus:200});
  $('script,style,noscript,iframe,svg,canvas,form,nav,footer,header,[hidden],[aria-hidden="true"]').remove();
  const article=$('article').first(),main=$('main').first(),root=article.length?article:main.length?main:$('body');
  const blocks=[];let characters=0;
  root.find('h1,h2,h3,h4,p,li,pre,blockquote,span[data-phone-math]').each((_index,node)=>{
    if(blocks.length>=160||characters>=60000)return;
    if($(node).parents('pre,blockquote,li').length)return;
    if(node.tagName==='span'&&$(node).parents('p,h1,h2,h3,h4').length)return;
    const type=node.tagName,text=$(node).text().trim().slice(0,8000);if(!text)return;
    characters+=text.length;blocks.push({type,text});
  });
  if(!blocks.length){const text=root.text().replace(/\s+/g,' ').trim().slice(0,60000);if(text)blocks.push({type:'p',text})}
  if(!blocks.length)throw new Error('This page needs JavaScript or sign-in to display its content. Use the full browser.');
  const seen=new Set(),links=[];
  root.find('a[href]').each((_index,node)=>{
    if(links.length>=40)return;
    try{const target=new URL($(node).attr('href'),url);if(!['https:','http:'].includes(target.protocol)||target.username||target.password||target.href.length>2000||seen.has(target.href))return;const text=$(node).text().replace(/\s+/g,' ').trim().slice(0,160);if(!text)return;seen.add(target.href);links.push({url:target.href,text})}catch{}
  });
  return {url:url.href,title,blocks,links};
}
module.exports=function registerPhoneReference(app,authenticateToken){
  const rates=new Map();
  app.post('/api/phone/compatibility',authenticateToken,async(req,res)=>{
    res.set('Cache-Control','no-store');const now=Date.now(),id=`policy:${req.user.userId}`;
    for(const [key,state]of rates)if(now-state.start>60000)rates.delete(key);
    const state=rates.get(id)||{start:now,count:0};if(state.count>=6)return res.status(429).json({message:'Wait a minute before checking more website policies.'});state.count++;rates.set(id,state);
    if(typeof req.body.url!=='string'||req.body.url.length>2000)return res.status(400).json({message:'Enter a webpage address first.'});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000),disconnect=()=>{if(!res.writableEnded)controller.abort()};res.on('close',disconnect);
    try{
      const page=await readPage(req.body.url,controller.signal,0,true),ancestors=page.csp.match(/(?:^|;)\s*frame-ancestors\s+([^;]+)/i)?.[1]||'',xfo=page.xFrameOptions.toUpperCase();let assessment='unknown';
      let appOrigin='';try{appOrigin=new URL(req.body.appOrigin).origin}catch{}
      if(ancestors){const rules=ancestors.split(/\s+/);assessment=rules.includes("'none'")||rules.length===1&&rules[0]==="'self'"&&new URL(page.url).origin!==appOrigin?'blocked':'policy_present'}
      else if(xfo==='DENY'||xfo==='SAMEORIGIN'&&new URL(page.url).origin!==appOrigin)assessment='blocked';
      if(!res.destroyed)res.json({url:page.url,status:page.status,xFrameOptions:page.xFrameOptions,frameAncestors:ancestors,assessment,message:assessment==='blocked'?'This response explicitly forbids this app from framing the page. Use an official embed URL, Reader, or the full browser.':assessment==='policy_present'?'This response declares a frame policy. It may restrict allowed parent sites; browser enforcement determines the result.':'No definitive frame prohibition was detected in this response. This does not prove the page works: redirects, sign-in, cookies and browser protections still apply.'});
    }catch{if(!res.destroyed)res.status(422).json({message:'The server could not inspect this website. Browser frame status remains unknown.'})}
    finally{clearTimeout(timeout);res.off('close',disconnect);if(res.destroyed&&!res.writableEnded)res.end()}
  });
  app.post('/api/phone/reference',authenticateToken,async(req,res)=>{
    res.set('Cache-Control','no-store');const now=Date.now(),id=String(req.user.userId);
    for(const [key,value]of rates)if(now-value.start>60000)rates.delete(key);
    const state=rates.get(id)||{start:now,count:0};if(state.count>=12)return res.status(429).json({message:'Please wait a minute before opening more references.'});state.count++;rates.set(id,state);
    const query=typeof req.body.query==='string'?req.body.query.trim().slice(0,300):'';
    if(!query&&(typeof req.body.url!=='string'||req.body.url.length>2000))return res.status(400).json({message:'Enter a webpage address or a reference search.'});
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000),disconnect=()=>{if(!res.writableEnded)controller.abort()};res.on('close',disconnect);
    try{
      let page;
      if(query){
        const target=`https://en.wikipedia.org/w/api.php?action=query&list=search&srnamespace=0&srlimit=12&format=json&srsearch=${encodeURIComponent(query)}`;
        const result=await readPage(target,controller.signal);if(!result.json?.query?.search)throw readerError('search_unavailable','The reference search service could not return results. Try a public webpage address instead.');
        page={search:true,url:`https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,title:`Reference search: ${query}`,blocks:[{type:'p',text:'Public reference results from Wikipedia. Select a result below to read it inside the phone.'}],links:result.json.query.search.map(item=>({text:String(item.title).slice(0,160),url:`https://en.wikipedia.org/wiki/${encodeURIComponent(String(item.title).replace(/ /g,'_'))}`}))};
        if(!page.links.length)page.blocks.push({type:'p',text:'No matching references found. Try a different phrase or paste a public article URL.'});
      }else{page=await readPage(req.body.url,controller.signal);if(page.json)throw readerError('unsupported_page','This address returned raw data rather than a readable webpage.')}
      if(!res.destroyed)res.json(page)
    }
    catch(error){if(!res.destroyed)res.status(422).json({message:controller.signal.aborted?'The reference request timed out. Try another page or open the browser.':error.category||/^[A-Z]/.test(error.message)?error.message:'The backend could not fetch this page. Check the backend network connection or try another public page.',category:controller.signal.aborted?'timeout':error.category||'network',...error.details})}
    finally{clearTimeout(timeout);res.off('close',disconnect);if(res.destroyed&&!res.writableEnded)res.end()}
  });
};
