import {useEffect,useRef,useState} from 'react'
import {Github,Linkedin,ExternalLink,Loader2,Link2,Unlink} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import './AccountConnections.css'

const providers=[['github','GitHub',Github],['linkedin','LinkedIn',Linkedin]]
export default function AccountConnections({token}){
  const [accounts,setAccounts]=useState(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const lock=useRef(false)
  const request=async(path='',method='GET')=>{const response=await fetch(`/api/account/connections${path}`,{method,headers:{Authorization:`Bearer ${token}`}}),data=await readApiJson(response);if(!response.ok)throw new Error(data.message||'Could not update connected accounts.');return data}
  const load=async()=>{try{setError('');setAccounts(await request())}catch(err){setError(err.message)}}
  useEffect(()=>{
    load()
    const params=new URLSearchParams(window.location.search),provider=params.get('connection'),result=params.get('connectionResult')
    if(providers.some(([id])=>id===provider)&&result){
      const label=providers.find(([id])=>id===provider)[1]
      if(result==='connected')setNotice(`${label} account connected.`)
      else setNotice(result==='cancelled'?`${label} connection was cancelled.`:result==='expired'||result==='invalid-state'?'The connection request expired or could not be verified. Click Connect to start again.':`${label} could not be connected. Check the OAuth app credentials, callback URL, and provider permissions, then try again.`)
      params.delete('connection');params.delete('connectionResult');const query=params.toString();window.history.replaceState(null,'',window.location.pathname+(query?'?'+query:'')+window.location.hash)
    }
  },[token])
  const run=async(provider,disconnect=false)=>{
    if(lock.current)return
    lock.current=true;setBusy(provider);setError('');setNotice('')
    try{
      if(disconnect){await request(`/${provider}`,'DELETE');setNotice(`${provider==='github'?'GitHub':'LinkedIn'} disconnected from this account.`);await load()}
      else{const data=await request(`/${provider}/start`,'POST');const url=new URL(data.authorizationUrl);if(url.protocol!=='https:'||url.hostname!==(provider==='github'?'github.com':'www.linkedin.com'))throw new Error('The authorization URL is invalid.');window.location.assign(url.toString())}
    }catch(err){setError(err.message)}finally{lock.current=false;setBusy('')}
  }
  return <section className="account-connections" aria-labelledby="connected-accounts-title"><h3 id="connected-accounts-title">Connected accounts</h3><p>Link your GitHub and LinkedIn profiles to your account.</p>
    {!accounts&&!error&&<p role="status">Loading connections…</p>}
    <div className="account-connection-grid">{providers.map(([id,label,Icon])=>{const account=accounts?.[id];return <article className="account-connection-card" key={id}><div className="account-connection-heading"><Icon size={24}/><h4>{label}</h4><span className={account?.connected?'is-connected':''}>{account?.connected?'Connected':'Not connected'}</span></div>
      {account?.connected?<div className="account-connected-profile"><strong>{account.name||account.username||`${label} member`}</strong>{account.username&&<span>@{account.username}</span>}{account.profileUrl&&<a href={account.profileUrl} target="_blank" rel="noopener noreferrer">View profile <ExternalLink size={13}/></a>}<small>Connected {new Date(account.connectedAt).toLocaleDateString()}</small></div>:<p>{id==='github'?'Connect your GitHub name and profile link.':'Connect your LinkedIn member profile. LinkedIn supplies your name through its sign-in product.'}</p>}
      {account&&!account.configured&&<p className="account-connection-setup">Server setup required: configure the {label} OAuth app. See README → Connected accounts.</p>}
      <div className="account-connection-actions"><button type="button" disabled={!account||!account.configured||!!busy} onClick={()=>run(id)}>{busy===id?<Loader2 size={15} className="animate-spin"/>:<Link2 size={15}/>} {account?.connected?'Reconnect':'Connect'} {label}</button>{account?.connected&&<button type="button" disabled={!!busy} onClick={()=>run(id,true)}><Unlink size={15}/>Disconnect</button>}</div>
    </article>})}</div>
    <p className="account-connection-note">Connections store basic profile details. Authorizing happens on the provider’s website; profile access tokens are discarded after linking. To revoke the provider’s authorization grant as well, remove this app in that provider’s account settings.</p>
    {error&&<p className="account-connection-error" role="alert">{error} <button type="button" disabled={!!busy} onClick={load}>Retry</button></p>}{notice&&<p role="status" className="account-connection-note">{notice}</p>}
  </section>
}
