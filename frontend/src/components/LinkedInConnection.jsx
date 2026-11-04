import {useRef,useState} from 'react'
import {Linkedin,Loader2,Unlink} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'

export default function LinkedInConnection({token,account,onChanged}){
  const [secret,setSecret]=useState(''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false)
  const request=async(path,method,body)=>{
    const response=await fetch(`/api/account/connections/linkedin${path}`,{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),data=await readApiJson(response)
    if(!response.ok)throw new Error(data.message||'Could not update LinkedIn connection.')
    return data
  }
  const run=async action=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{await action()}catch(failure){setError(failure.message)}finally{lock.current=false;setBusy(false)}
  }
  const connect=event=>{
    event.preventDefault();run(async()=>{
      await request('/token','PUT',{token:secret});setSecret('');setEditing(false);setNotice('LinkedIn profile connected. The supplied access token was discarded after reading your profile.');await onChanged()
    })
  }
  return <article className="account-connection-card linkedin-connection">
    <div className="account-connection-heading"><Linkedin size={24}/><h4>LinkedIn</h4><span className={account?.connected?'is-connected':''}>{account?.connected?'Connected':'Not connected'}</span></div>
    {account?.connected&&<div className="account-connected-profile"><strong>{account.name||'LinkedIn member'}</strong><small>Linked {new Date(account.connectedAt).toLocaleDateString()}</small></div>}
    <p>Connect your own LinkedIn OAuth access token without configuring LinkedIn app credentials on this server. This links your basic profile name; it does not provide jobs, messages, contacts, full work history, or posting access.</p>
    {(!account?.connected||editing)&&<form className="github-token-form" onSubmit={connect}>
      <p>LinkedIn tokens still require a registered developer app. Use its <a href="https://learn.microsoft.com/en-us/linkedin/shared/authentication/developer-portal-tools" target="_blank" rel="noopener noreferrer">Token Generator instructions ↗</a> to obtain an access token with <strong>openid</strong> and <strong>profile</strong>. The app must have Sign In with LinkedIn using OpenID Connect enabled.</p>
      <label>LinkedIn access token<input type="password" autoComplete="new-password" autoCapitalize="none" spellCheck={false} maxLength={4096} required value={secret} disabled={busy} onChange={event=>setSecret(event.target.value)} placeholder="Paste your OAuth access token"/></label>
      <p>Use an access token, not your LinkedIn password or browser cookie. The token is sent to the backend to retrieve your profile, then discarded; only basic profile information is saved.</p>
      <div className="account-connection-actions"><button type="submit" disabled={busy||!secret.trim()}>{busy&&<Loader2 size={15} className="animate-spin"/>}Connect LinkedIn profile</button>{editing&&<button type="button" disabled={busy} onClick={()=>{setEditing(false);setSecret('')}}>Cancel</button>}</div>
    </form>}
    <div className="account-connection-actions">{account?.connected&&<><button type="button" disabled={busy} onClick={()=>setEditing(true)}>Reconnect with token</button><button type="button" disabled={busy} onClick={()=>run(async()=>{await request('','DELETE');setSecret('');setEditing(false);setNotice('LinkedIn profile disconnected.');await onChanged()})}><Unlink size={15}/>Disconnect</button></>}
      {account?.oauthConfigured&&<button type="button" disabled={busy} onClick={()=>run(async()=>{const data=await request('/start','POST'),url=new URL(data.authorizationUrl);if(url.protocol!=='https:'||url.hostname!=='www.linkedin.com')throw new Error('Invalid LinkedIn authorization URL.');window.location.assign(url.toString())})}>Connect on LinkedIn instead</button>}
    </div>
    <p>Disconnecting removes the saved profile link. Revoke your app’s authorization in LinkedIn settings to remove its permissions there.</p>
    {error&&<p role="alert" className="account-connection-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </article>
}
