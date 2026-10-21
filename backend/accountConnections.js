const {randomBytes,createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(value).digest('hex');
const providers=['github','linkedin'];
function settings(provider){
  const prefix=provider.toUpperCase(),local=process.env.NODE_ENV!=='production';
  const api=new URL(process.env.PUBLIC_API_URL||(local?'http://localhost:5000':''));
  const app=new URL(process.env.PUBLIC_APP_URL||(local?'http://localhost:3000':''));
  for(const url of [api,app])if(url.username||url.password||(url.protocol!=='https:'&&!(local&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('Configure public application URLs.');
  if(api.hostname!==app.hostname)throw new Error('Use a same-host /api proxy for account connections so the browser can verify the callback cookie.');
  const clientId=process.env[`${prefix}_CLIENT_ID`]?.trim(),clientSecret=process.env[`${prefix}_CLIENT_SECRET`]?.trim();
  if(!clientId||!clientSecret)throw new Error(`Configure ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET on the backend.`);
  return {clientId,clientSecret,redirectUri:`${api.origin}/api/account/connections/${provider}/callback`,appOrigin:app.origin,secure:api.protocol==='https:'};
}
async function providerJSON(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const response=await fetch(url,{...options,redirect:'error',signal:controller.signal});const text=await response.text();if(text.length>100000)throw new Error('Provider response too large.');let result;try{result=JSON.parse(text)}catch{throw new Error('Invalid provider response.');}if(!response.ok||result.error)throw new Error('Provider authorization failed.');return result;}finally{clearTimeout(timer);}
}
module.exports=function registerAccountConnections(app,auth,{User,mongoose}){
  const Pending=mongoose.model('AccountConnectionState',new mongoose.Schema({
    hash:{type:String,unique:true,required:true},user:{type:mongoose.Schema.Types.ObjectId,required:true,index:true},provider:{type:String,enum:providers,required:true},browserHash:String,verifier:String,version:Number,expiresAt:{type:Date,expires:0,required:true},
  }));
  function finish(res,provider,result){
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    let origin;try{origin=settings(provider).appOrigin}catch{origin=process.env.PUBLIC_APP_URL;}
    if(!origin)return res.status(503).send('Account connection is not configured. Return to the account page.');
    const target=new URL(origin);target.pathname='/';target.search='';target.searchParams.set('connection',provider);target.searchParams.set('connectionResult',result);target.hash='/account';res.redirect(303,target.toString());
  }
  const cookieName=provider=>`account_link_${provider}`;
  const cookieOptions=config=>({httpOnly:true,secure:config.secure,sameSite:'lax',path:'/api/account/connections',maxAge:10*60*1000});
  app.get('/api/account/connections',auth,async(req,res)=>{
    res.set('Cache-Control','no-store');
    try{
      const user=await User.findById(req.user.userId).select('socialConnections').lean();if(!user)return res.status(404).json({message:'Account not found.'});
      const result={};for(const provider of providers){let configured=true;try{settings(provider)}catch{configured=false}const connection=user.socialConnections?.[provider];result[provider]={configured,connected:!!connection,...(connection?{name:connection.name,username:connection.username,profileUrl:connection.profileUrl,connectedAt:connection.connectedAt}:{})};}res.json(result);
    }catch{res.status(500).json({message:'Could not load connected accounts.'});}
  });
  app.post('/api/account/connections/:provider/start',auth,async(req,res)=>{
    const provider=req.params.provider;if(!providers.includes(provider))return res.status(404).json({message:'Unknown account provider.'});
    let config;try{config=settings(provider)}catch(error){return res.status(503).json({message:error.message});}
    try{
      const state=randomBytes(32).toString('base64url'),browser=randomBytes(32).toString('base64url'),verifier=randomBytes(48).toString('base64url');
      const versionKey=`socialConnectionVersions.${provider}`;
      const user=await User.findByIdAndUpdate(req.user.userId,{$inc:{[versionKey]:1}},{new:true}).select('socialConnectionVersions').lean();
      if(!user)return res.status(404).json({message:'Account not found.'});
      await Pending.deleteMany({user:req.user.userId,provider});
      await Pending.create({hash:hash(state),browserHash:hash(browser),user:req.user.userId,provider,verifier,version:user.socialConnectionVersions[provider],expiresAt:new Date(Date.now()+600000)});
      const url=new URL(provider==='github'?'https://github.com/login/oauth/authorize':'https://www.linkedin.com/oauth/v2/authorization');
      url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,state,response_type:'code',scope:provider==='github'?'read:user':'openid profile'}).toString();
      if(provider==='github'){url.searchParams.set('code_challenge',hashChallenge(verifier));url.searchParams.set('code_challenge_method','S256');}
      res.cookie(cookieName(provider),browser,cookieOptions(config));res.set('Cache-Control','no-store');res.json({authorizationUrl:url.toString()});
    }catch{res.status(500).json({message:'Could not start account connection. Try again.'});}
  });
  app.get('/api/account/connections/:provider/callback',async(req,res)=>{
    const provider=req.params.provider;if(!providers.includes(provider))return res.status(404).send('Unknown provider.');
    let config;try{config=settings(provider)}catch{return res.status(503).send('Account connection is not configured. Return to Account settings.');}
    res.set({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    const state=req.query.state;
    if(typeof state!=='string'||!/^[a-zA-Z0-9_-]{43}$/.test(state))return finish(res,provider,'invalid-state');
    const cookie=(req.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(cookieName(provider)+'='))?.slice(cookieName(provider).length+1);
    if(!cookie)return finish(res,provider,'expired');
    try{
      const pending=await Pending.findOneAndDelete({hash:hash(state),provider,browserHash:hash(cookie),expiresAt:{$gt:new Date()}}).lean();
      if(!pending)return finish(res,provider,'expired');
      res.clearCookie(cookieName(provider),{path:'/api/account/connections',httpOnly:true,secure:config.secure,sameSite:'lax'});
      if(req.query.error)return finish(res,provider,'cancelled');
      if(typeof req.query.code!=='string'||req.query.code.length>4096)return finish(res,provider,'failed');
      const body=new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,code:req.query.code,redirect_uri:config.redirectUri,grant_type:'authorization_code'});
      if(provider==='github')body.set('code_verifier',pending.verifier);
      const token=await providerJSON(provider==='github'?'https://github.com/login/oauth/access_token':'https://www.linkedin.com/oauth/v2/accessToken',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/x-www-form-urlencoded'},body});
      if(typeof token.access_token!=='string'||!token.access_token)throw new Error('Missing token.');
      const profile=await providerJSON(provider==='github'?'https://api.github.com/user':'https://api.linkedin.com/v2/userinfo',{headers:{Authorization:`Bearer ${token.access_token}`,Accept:'application/json','User-Agent':'AssignmentTracker'}});
      const providerId=provider==='github'?String(profile.id||''):profile.sub;
      if(typeof providerId!=='string'||!providerId||providerId.length>256)throw new Error('Missing provider identity.');
      const username=provider==='github'?String(profile.login||'').slice(0,100):'';
      const connection={providerId,username,name:String(profile.name||username||'LinkedIn member').slice(0,200),profileUrl:provider==='github'?`https://github.com/${encodeURIComponent(username)}`:null,connectedAt:new Date()};
      // No provider tokens are retained or returned to the browser. This links
      // profile identities; repository access and LinkedIn posting are not requested.
      const result=await User.updateOne({_id:pending.user,[`socialConnectionVersions.${provider}`]:pending.version},{$set:{[`socialConnections.${provider}`]:connection}});
      return finish(res,provider,result.matchedCount?'connected':'expired');
    }catch{return finish(res,provider,'failed');}
  });
  app.delete('/api/account/connections/:provider',auth,async(req,res)=>{
    const provider=req.params.provider;if(!providers.includes(provider))return res.status(404).json({message:'Unknown provider.'});
    try{const result=await User.updateOne({_id:req.user.userId},{$unset:{[`socialConnections.${provider}`]:1},$inc:{[`socialConnectionVersions.${provider}`]:1}});if(!result.matchedCount)return res.status(404).json({message:'Account not found.'});await Pending.deleteMany({user:req.user.userId,provider});res.json({disconnected:true});}catch{res.status(500).json({message:'Could not disconnect account.'});}
  });
};
function hashChallenge(value){return createHash('sha256').update(value).digest('base64url');}
