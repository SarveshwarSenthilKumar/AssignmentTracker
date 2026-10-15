const { randomBytes, createCipheriv, createDecipheriv, hkdfSync } = require('node:crypto');

function normalizeApiKey(value){
  if(typeof value!=='string'||value.length>2048)return '';
  let key=value.trim(),previous;
  do{
    previous=key;
    key=key.replace(/^["'`“”‘’]+|["'`“”‘’]+$/g,'').trim();
    key=key.replace(/^(?:authorization\s*:\s*)?bearer(?:\s+|$)/i,'').trim();
  }while(key!==previous);
  return key;
}

function encryptionKey(source){
  const secret=source==='env'?process.env.AI_KEY_ENCRYPTION_KEY:process.env.JWT_SECRET;
  if(typeof secret!=='string'||!secret.trim())throw new Error('Credential encryption is not configured.');
  return Buffer.from(hkdfSync('sha256',secret,'AssignmentTracker','account-gemini-key-v1',32));
}
function encryptKey(value,userId){
  const source=process.env.AI_KEY_ENCRYPTION_KEY?.trim()?'env':'jwt',iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',encryptionKey(source),iv);
  cipher.setAAD(Buffer.from(String(userId)));
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return ['v1',source,iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join(':');
}
function decryptKey(value,userId){
  const [version,source,iv,tag,ciphertext,...extra]=value.split(':');
  if(version!=='v1'||!['env','jwt'].includes(source)||!iv||!tag||!ciphertext||extra.length)throw new Error('Invalid stored credential.');
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(source),Buffer.from(iv,'base64'));
  decipher.setAAD(Buffer.from(String(userId)));decipher.setAuthTag(Buffer.from(tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext,'base64')),decipher.final()]).toString('utf8');
}

function createAssistantCredentials(User){
  const load=userId=>User.findById(userId).select('_id +geminiApiKeyEncrypted +geminiApiKeyLastFour +geminiApiKeyUpdatedAt').lean();
  const resolve=async userId=>{
    const user=await load(userId);
    if(!user)return {apiKey:'',source:'none',accountMissing:true};
    if(user.geminiApiKeyEncrypted){
      try{return {apiKey:decryptKey(user.geminiApiKeyEncrypted,userId),source:'account',user}}
      catch{return {apiKey:'',source:'account',needsReplacement:true,user}}
    }
    const apiKey=process.env.GEMINI_API_KEY?.trim()||'';
    return {apiKey,source:apiKey?'server':'none',user};
  };
  const describe=credentials=>({
    configured:!!credentials.apiKey,source:credentials.source,hasPersonalKey:!!credentials.user?.geminiApiKeyEncrypted,
    maskedKey:credentials.user?.geminiApiKeyEncrypted?`•••• ${credentials.user.geminiApiKeyLastFour||'saved'}`:null,
    updatedAt:credentials.user?.geminiApiKeyUpdatedAt||null,needsReplacement:!!credentials.needsReplacement,
    storageAvailable:!!(process.env.AI_KEY_ENCRYPTION_KEY?.trim()||process.env.JWT_SECRET?.trim()),
  });
  const registerRoutes=(app,authenticateToken,onChange)=>{
    app.use('/api/account/ai-settings',(_req,res,next)=>{res.set('Cache-Control','no-store');next()});
    app.get('/api/account/ai-settings',authenticateToken,async(req,res)=>{
      try{const credentials=await resolve(req.user.userId);if(credentials.accountMissing)return res.status(404).json({message:'Account not found.'});res.json(describe(credentials))}
      catch{res.status(503).json({message:'Could not load AI account settings.'})}
    });
    app.put('/api/account/ai-settings',authenticateToken,async(req,res)=>{
      const key=normalizeApiKey(req.body.apiKey);
      if(!/^[A-Za-z0-9_-]{20,256}$/.test(key)||key.startsWith('sk-'))return res.status(400).json({message:'Enter a valid Gemini API key from Google AI Studio. Surrounding quotes, spaces and a Bearer prefix are removed automatically.'});
      let encrypted;
      try{encrypted=encryptKey(key,req.user.userId)}catch{return res.status(503).json({message:'The backend needs AI_KEY_ENCRYPTION_KEY or JWT_SECRET configured before it can save API keys.'})}
      try{
        const user=await User.findByIdAndUpdate(req.user.userId,{$set:{geminiApiKeyEncrypted:encrypted,geminiApiKeyLastFour:key.slice(-4),geminiApiKeyUpdatedAt:new Date()}},{new:true}).select('_id');
        if(!user)return res.status(404).json({message:'Account not found.'});
        onChange?.(String(req.user.userId));res.json(describe(await resolve(req.user.userId)));
      }catch{res.status(503).json({message:'Could not save the API key. Try again.'})}
    });
    app.delete('/api/account/ai-settings',authenticateToken,async(req,res)=>{
      try{
        const user=await User.findByIdAndUpdate(req.user.userId,{$unset:{geminiApiKeyEncrypted:1,geminiApiKeyLastFour:1,geminiApiKeyUpdatedAt:1}},{new:true}).select('_id');
        if(!user)return res.status(404).json({message:'Account not found.'});
        onChange?.(String(req.user.userId));res.json(describe(await resolve(req.user.userId)));
      }catch{res.status(503).json({message:'Could not remove the API key. Try again.'})}
    });
  };
  return {resolve,describe,registerRoutes};
}
module.exports={createAssistantCredentials};
