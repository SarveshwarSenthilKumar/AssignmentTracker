const { createHash, createHmac, randomBytes, timingSafeEqual } = require('node:crypto');
const jwt = require('jsonwebtoken');

module.exports = function documentCollaboratorAccess({ User }) {
  const secret = process.env.JWT_SECRET || randomBytes(32).toString('hex');
  const sign = id => createHmac('sha256',secret).update(id).digest('base64url');
  const person = (file, identity) => createHash('sha256').update(`${file}:${identity}`).digest('hex').slice(0,24);
  async function identify(req,res,file) {
    if(req.documentCollaborator?.file===String(file._id)) return req.documentCollaborator;
    const cookie = /(?:^|;\s*)pdf_collaborator=([a-f\d]{32})\.([A-Za-z0-9_-]{43})(?:;|$)/.exec(req.headers.cookie || '');
    let browser = cookie && timingSafeEqual(Buffer.from(cookie[2]),Buffer.from(sign(cookie[1]))) ? cookie[1] : null;
    if(!browser) {
      browser=randomBytes(16).toString('hex');
      const secure=req.secure||req.get('x-forwarded-proto')?.split(',')[0].trim()==='https';
      res.append('Set-Cookie',`pdf_collaborator=${browser}.${sign(browser)}; Path=/api; Max-Age=31536000; HttpOnly; SameSite=Lax${secure?'; Secure':''}`);
    }
    let claims=req.user;
    if(!claims) { try { const token=/^Bearer (.+)$/.exec(req.get('Authorization')||'')?.[1]; if(token)claims=jwt.verify(token,secret); } catch { /* Anonymous links stay available. */ } }
    const account=claims?.userId&&/^[a-f\d]{24}$/i.test(String(claims.userId))?await User.findById(claims.userId).select('username deactivatedAt approvalPending').lean():null;
    const accountId=account&&!account.deactivatedAt&&!account.approvalPending?String(account._id):null;
    const browserPerson=person(file._id,`guest:${browser}`);
    const identity={file:String(file._id),person:accountId?person(file._id,`account:${accountId}`):browserPerson,browserPerson,browserId:browser,accountId,name:accountId?account.username:null,owner:accountId===String(file.user)};
    req.documentCollaborator=identity;
    return identity;
  }
  const filter = identity => identity.owner?{}:{revokedCollaborators:{$nin:[identity.person,identity.browserPerson]}};
  const blocked = (file,identity) => !identity.owner&&(file.revokedCollaborators||[]).some(id=>id===identity.person||id===identity.browserPerson);
  const forFile=(identity,file)=>({...identity,file:String(file._id),person:identity.accountId?person(file._id,`account:${identity.accountId}`):person(file._id,`guest:${identity.browserId}`),browserPerson:person(file._id,`guest:${identity.browserId}`),owner:identity.accountId===String(file.user)});
  return {identify,filter,blocked,forFile};
};
