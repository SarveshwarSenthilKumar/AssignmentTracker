import {useEffect,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import './AccountConnections.css'
import GitHubConnection from './GitHubConnection'
import LinkedInConnection from './LinkedInConnection'

const providers=[['github','GitHub'],['linkedin','LinkedIn']]
export default function AccountConnections({token}){
  const [accounts,setAccounts]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('')
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
  return <section className="account-connections" aria-labelledby="connected-accounts-title"><h3 id="connected-accounts-title">Connected accounts</h3><p>Link your GitHub and LinkedIn profiles to your account.</p>
    {!accounts&&!error&&<p role="status">Loading connections…</p>}
    <div className="account-connection-grid"><GitHubConnection key={`${token}:github`} token={token} account={accounts?.github} onChanged={load}/><LinkedInConnection key={`${token}:linkedin`} token={token} account={accounts?.linkedin} onChanged={load}/></div>
    <p className="account-connection-note">GitHub uses your account’s encrypted personal access token for read-only repository browsing. LinkedIn accepts a supplied OAuth access token to read basic profile details, then discards it. Neither manual connection requires provider app credentials on this server. These connections do not automatically share data with AI.</p>
    {error&&<p className="account-connection-error" role="alert">{error} <button type="button" onClick={load}>Retry</button></p>}{notice&&<p role="status" className="account-connection-note">{notice}</p>}
  </section>
}
