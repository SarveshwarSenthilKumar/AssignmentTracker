const https=require('node:https');
const dns=require('node:dns').promises;
const net=require('node:net');
const clean=(value,max=30000)=>{
  if(Array.isArray(value))return value.map(v=>clean(v,max)).filter(Boolean).join('\n').slice(0,max);
  if(value&&typeof value==='object')return clean(value.name||value.description||value.value||'',max);
  return String(value??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\/?(?:p|div|li|br|h[1-6])\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,'').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):''}).replace(/&(amp|lt|gt|quot|apos|nbsp);/gi,(_,s)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[s.toLowerCase()]).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n\n').trim().slice(0,max);
};
function safeURL(value){
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||url.hostname==='localhost'||url.hostname.endsWith('.local')||url.hostname.endsWith('.internal'))throw new Error('Use a public HTTPS job posting URL.');
  url.hash='';return url;
}
function publicV4(ip){
  if(net.isIP(ip)!==4)return false;
  const [a,b,c]=ip.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0||b===2)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19||b===51&&c===100)||a===203&&b===0&&c===113);
}
async function pageHTML(input){
  let url=safeURL(input);const deadline=Date.now()+20000;
  for(let hop=0;hop<5;hop++){
    const addresses=await dns.lookup(url.hostname,{all:true,family:4});
    if(!addresses.length||addresses.some(item=>!publicV4(item.address)))throw new Error('Only public job websites can be imported.');
    const address=addresses[0].address;
    const result=await new Promise((resolve,reject)=>{
      const req=https.get(url,{agent:false,headers:{'User-Agent':'AssignmentTracker/1.0 (job posting import)','Accept':'text/html','Accept-Encoding':'identity'},lookup:(_host,options,callback)=>options?.all?callback(null,[{address,family:4}]):callback(null,address,4)},res=>{
        if([301,302,303,307,308].includes(res.statusCode)){res.resume();resolve({location:res.headers.location});return}
        if(res.statusCode!==200){res.resume();reject(new Error(`The job website returned ${res.statusCode}. Paste the job details manually if it requires sign-in or blocks imports.`));return}
        if(!/text\/html|application\/xhtml\+xml/i.test(res.headers['content-type']||'')){res.resume();reject(new Error('This link does not return a job web page.'));return}
        const chunks=[];let size=0;
        res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){res.destroy(new Error('Job page is too large.'));return}chunks.push(chunk)});
        res.on('error',reject);res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8')}));
      });
      const timer=setTimeout(()=>req.destroy(new Error('The job website took too long. Paste the details manually.')),Math.max(1,deadline-Date.now()));
      req.on('close',()=>clearTimeout(timer));req.on('error',reject);
    });
    if(result.html!==undefined)return {html:result.html,url:url.href};
    if(!result.location)throw new Error('The job website returned an invalid redirect.');
    url=safeURL(new URL(result.location,url).href);
  }
  throw new Error('The job link redirects too many times.');
}
function extract(html,url){
  const postings=[];
  const visit=(value,depth=0)=>{
    if(!value||typeof value!=='object'||depth>8)return;
    if(Array.isArray(value)){value.slice(0,100).forEach(v=>visit(v,depth+1));return}
    if([value['@type']].flat().some(type=>typeof type==='string'&&/(^|\/)JobPosting$/.test(type))){postings.push(value);return}
    for(const field of ['@graph','mainEntity','itemListElement','item'])visit(value[field],depth+1);
  };
  for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{visit(JSON.parse(match[1]))}catch{}}
  if(postings.length>1)throw new Error('This page lists multiple jobs. Open a specific job posting and import its direct link.');
  if(!postings.length)throw new Error('No readable job posting was found. The site may require sign-in or JavaScript. Paste the details into the form below.');
  const job=postings[0],salary=job.baseSalary,value=salary?.value;
  const locations=[job.jobLocation].flat().filter(Boolean).map(place=>{const a=place.address||place;return [a.streetAddress,a.addressLocality,a.addressRegion,clean(a.addressCountry)].filter(Boolean).join(', ')});
  if(job.jobLocationType==='TELECOMMUTE')locations.unshift('Remote');
  return {url,title:clean(job.title,300),company:clean(job.hiringOrganization,300),location:clean(locations,1000),employmentType:clean(job.employmentType,500),salary:typeof salary==='number'?String(salary):[salary?.currency||job.salaryCurrency,typeof value==='number'?value:[value?.minValue,value?.maxValue].filter(v=>v!==undefined).join(' – ')||value?.value,value?.unitText].filter(v=>v!==undefined&&v!=='').join(' '),datePosted:clean(job.datePosted,100),validThrough:clean(job.validThrough,100),description:clean(job.description),requirements:clean([job.qualifications,job.skills,job.educationRequirements,job.experienceRequirements]),responsibilities:clean(job.responsibilities),benefits:clean(job.jobBenefits),source:'JobPosting structured data'};
}
module.exports=function registerJobs(app,auth,mongoose){
  const fields={url:2048,title:300,company:300,location:1000,employmentType:500,salary:500,datePosted:100,validThrough:100,description:30000,requirements:30000,responsibilities:30000,benefits:10000,source:100};
  const Job=mongoose.model('SavedJob',new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},...Object.fromEntries(Object.keys(fields).map(key=>[key,String]))},{timestamps:true}));
  const active=new Set(),limits=new Map();
  app.post('/api/jobs/extract',auth,async(req,res)=>{
    const user=String(req.user.userId);if(active.has(user))return res.status(409).json({message:'A job import is already running.'});
    const now=Date.now(),limit=limits.get(user);if(limit&&now-limit.start<60000&&limit.count>=8)return res.status(429).json({message:'Wait a minute before importing more links.'});
    if(!limit||now-limit.start>=60000)limits.set(user,{start:now,count:1});else limit.count++;
    if(limits.size>1000)for(const [id,v]of limits)if(now-v.start>=60000)limits.delete(id);
    active.add(user);res.set('Cache-Control','no-store');
    try{if(typeof req.body?.url!=='string'||req.body.url.length>2048)throw new Error('Enter a job link up to 2048 characters.');const page=await pageHTML(req.body.url);res.json(extract(page.html,page.url))}catch(error){res.status(422).json({message:error.code?'Could not reach the job website. Try the direct posting link or paste its details manually.':error.message})}finally{active.delete(user)}
  });
  app.get('/api/jobs',auth,async(req,res)=>{try{res.set('Cache-Control','no-store');res.json(await Job.find({user:req.user.userId}).sort({createdAt:-1}).limit(300).lean())}catch{res.status(500).json({message:'Could not load saved jobs.'})}});
  app.post('/api/jobs',auth,async(req,res)=>{try{const data={};for(const [key,max]of Object.entries(fields)){if(req.body[key]!==undefined&&typeof req.body[key]!=='string')throw new Error('Job fields must be text.');data[key]=(req.body[key]||'').trim().slice(0,max)}if(!data.title)throw new Error('Enter a job title.');if(data.url)data.url=safeURL(data.url).href;const duplicate=data.url&&await Job.findOne({user:req.user.userId,url:data.url});if(duplicate)return res.status(409).json({message:'This job link is already saved.'});res.status(201).json(await Job.create({...data,user:req.user.userId}))}catch(error){res.status(400).json({message:error.name==='MongoServerError'?'Could not save job.':error.message})}});
  app.delete('/api/jobs/:id',auth,async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:'Invalid job.'});try{const job=await Job.findOneAndDelete({_id:req.params.id,user:req.user.userId});if(!job)return res.status(404).json({message:'Job not found.'});res.json({ok:true})}catch{res.status(500).json({message:'Could not delete job.'})}});
  return Job;
};
