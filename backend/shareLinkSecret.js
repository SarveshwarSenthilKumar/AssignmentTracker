const {createHash,createCipheriv,createDecipheriv,randomBytes}=require('node:crypto');
const key=createHash('sha256').update(process.env.JWT_SECRET||randomBytes(32)).digest();
const hash=token=>createHash('sha256').update(token).digest('hex');
const seal=token=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);const data=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64');};
const unseal=value=>{const data=Buffer.from(value,'base64'),cipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));cipher.setAuthTag(data.subarray(12,28));return Buffer.concat([cipher.update(data.subarray(28)),cipher.final()]).toString('utf8');};
module.exports={hash,seal,unseal};
