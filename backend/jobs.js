const https=require('node:https');
const dns=require('node:dns').promises;
const net=require('node:net');
const zlib=require('node:zlib');
const {importJob,fromText}=require('./jobExtraction');
const {handshakeLink,handshakeText}=require('./handshakeJobs');
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
async function pageHTML(input,json=false){
  let url=safeURL(input);const deadline=Date.now()+20000;
  for(let hop=0;hop<5;hop++){
    const addresses=await dns.lookup(url.hostname,{all:true,family:4});
    if(!addresses.length||addresses.some(item=>!publicV4(item.address)))throw new Error('Only public job websites can be imported.');
    const address=addresses[0].address;
    const result=await new Promise((resolve,reject)=>{
      const req=https.get(url,{agent:false,headers:{'User-Agent':'AssignmentTracker/1.0 (job posting import)','Accept':json?'application/json':'text/html,application/xhtml+xml','Accept-Encoding':'gzip, deflate, br'},lookup:(_host,options,callback)=>options?.all?callback(null,[{address,family:4}]):callback(null,address,4)},res=>{
        if([301,302,303,307,308].includes(res.statusCode)){res.resume();resolve({location:res.headers.location});return}
        if(res.statusCode!==200){res.resume();reject(new Error(`The job website returned ${res.statusCode}. Paste the job details manually if it requires sign-in or blocks imports.`));return}
        if(!(json?/application\/(?:[\w.+-]*\+)?json/i:/text\/html|application\/xhtml\+xml/i).test(res.headers['content-type']||'')){res.resume();reject(new Error('This link does not return a job web page.'));return}
        const encoding=(res.headers['content-encoding']||'').toLowerCase();
        const decoder=encoding==='gzip'?zlib.createGunzip():encoding==='deflate'?zlib.createInflate():encoding==='br'?zlib.createBrotliDecompress():null;
        const stream=decoder?res.pipe(decoder):res;
        const chunks=[];let size=0,received=0;
        res.on('data',chunk=>{received+=chunk.length;if(received>6*1024*1024)req.destroy(new Error('Job page is too large.'))});
        stream.on('data',chunk=>{size+=chunk.length;if(size>6*1024*1024){req.destroy(new Error('Job page is too large.'));stream.destroy();return}chunks.push(chunk)});
        res.on('error',reject);stream.on('error',reject);stream.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8')}));
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
    try{
      const raw=req.body?.url||'',pasted=req.body?.text;
      if(typeof raw!=='string'||raw.length>2048)throw new Error('Enter a job link up to 2048 characters.');
      const url=raw?safeURL(raw).href:'';
      if(pasted!==undefined){if(typeof pasted!=='string'||pasted.length>60000)throw new Error('Paste job text up to 60,000 characters.');const result=handshakeLink(url)?handshakeText(pasted,url,fromText):fromText(pasted,url);if(['PDF text layer','Local OCR','PDF text + local OCR'].includes(req.body.method)){result.source=`${handshakeLink(url)?'Handshake · ':''}${req.body.method}`;result.warnings.unshift('Extracted without generative AI. Check OCR text, job title, salary and deadlines before saving.')}return res.json(result)}
      if(!url)throw new Error('Enter a job link or paste the job text.');
      res.json(await importJob(url,pageHTML));
    }catch(error){const handshakeError=['HANDSHAKE_ACCESS_REQUIRED','HANDSHAKE_JOB_LINK_REQUIRED'].includes(error.code);res.status(422).json({message:handshakeError?error.message:error.code?'Could not reach the job website. Try the direct posting link or paste its details manually.':error.message,code:handshakeError?error.code:undefined})}finally{active.delete(user)}
  });
  app.get('/api/jobs',auth,async(req,res)=>{try{res.set('Cache-Control','no-store');res.json(await Job.find({user:req.user.userId}).sort({createdAt:-1}).limit(300).lean())}catch{res.status(500).json({message:'Could not load saved jobs.'})}});
  app.post('/api/jobs',auth,async(req,res)=>{try{const data={};for(const [key,max]of Object.entries(fields)){if(req.body[key]!==undefined&&typeof req.body[key]!=='string')throw new Error('Job fields must be text.');data[key]=(req.body[key]||'').trim().slice(0,max)}if(!data.title)throw new Error('Enter a job title.');if(data.url)data.url=safeURL(data.url).href;const duplicate=data.url&&await Job.findOne({user:req.user.userId,url:data.url});if(duplicate)return res.status(409).json({message:'This job link is already saved.'});res.status(201).json(await Job.create({...data,user:req.user.userId}))}catch(error){res.status(400).json({message:error.name==='MongoServerError'?'Could not save job.':error.message})}});
  app.delete('/api/jobs/:id',auth,async(req,res)=>{if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:'Invalid job.'});try{const job=await Job.findOneAndDelete({_id:req.params.id,user:req.user.userId});if(!job)return res.status(404).json({message:'Job not found.'});res.json({ok:true})}catch{res.status(500).json({message:'Could not delete job.'})}});
  return Job;
};
