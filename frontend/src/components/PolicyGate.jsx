import {useEffect,useState} from 'react'
import TermsPage from './TermsPage'
import PrivacyPage from './PrivacyPage'
import {TERMS_VERSION,PRIVACY_VERSION} from '../lib/legalPolicy'
import {readApiJson} from '../lib/apiResponse'
import './TermsPage.css'

export default function PolicyGate({token,onSignOut,children}){
  const [status,setStatus]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const [terms,setTerms]=useState(false),[privacy,setPrivacy]=useState(false),[revision,setRevision]=useState(0)
  const [route,setRoute]=useState(window.location.hash)
  useEffect(()=>{const change=()=>setRoute(window.location.hash);window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change)},[])
  useEffect(()=>{
    let active=true,checking=false
    const controller=new AbortController()
    const check=async()=>{
      if(checking)return
      checking=true
      try{
        const response=await fetch('/api/account/policies',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'})
        const data=await readApiJson(response)
        if(!response.ok)throw new Error(data.message||'Could not check current policies.')
        if(active){setStatus(data);setError('')}
      }catch(err){if(active){setStatus(null);setError(err.message)}}finally{checking=false}
    }
    check()
    const interval=setInterval(check,60000)
    window.addEventListener('focus',check)
    return()=>{active=false;controller.abort();clearInterval(interval);window.removeEventListener('focus',check)}
  },[token,revision])
  if(route.split('/')[1]==='terms')return <TermsPage signedIn/>
  if(route.split('/')[1]==='privacy')return <PrivacyPage signedIn/>
  if(status?.required===false)return children
  const mismatch=status&&(status.termsVersion!==TERMS_VERSION||status.privacyVersion!==PRIVACY_VERSION)
  const accept=async()=>{
    if(busy||!terms||!privacy||mismatch)return
    setBusy(true);setError('')
    try{
      const response=await fetch('/api/account/policies/accept',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({termsVersion:TERMS_VERSION,privacyVersion:PRIVACY_VERSION,termsAccepted:terms,privacyAccepted:privacy})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not save agreement.')
      setStatus(data)
    }catch(err){setError(err.message)}finally{setBusy(false)}
  }
  return <main className="terms-page platform-viewport"><div className="terms-wrap"><h1>Review updated policies</h1><p role="alert">You cannot continue using your workspace until you review and accept the current Terms and Conditions and Privacy Policy.</p>
    {!status&&!error&&<p role="status">Checking policy versions…</p>}
    {error&&<p role="alert">{error} <button type="button" onClick={()=>setRevision(value=>value+1)}>Retry</button></p>}
    {mismatch?<p role="alert">A newer policy version is available. <button type="button" onClick={()=>window.location.reload()}>Reload to review</button></p>:status&&<>
      <p>These policies explain extensive AI processing of personal data and documents, external providers, retention and your available controls.</p>
      <p><a href="#/terms">Read Terms and Conditions (version {TERMS_VERSION})</a></p><p><a href="#/privacy">Read Privacy Policy (version {PRIVACY_VERSION})</a></p>
      <label className="signup-terms-agree"><input type="checkbox" checked={terms} disabled={busy} onChange={event=>setTerms(event.target.checked)}/>I have reviewed and agree to the current Terms and Conditions.</label>
      <label className="signup-terms-agree"><input type="checkbox" checked={privacy} disabled={busy} onChange={event=>setPrivacy(event.target.checked)}/>I have reviewed and acknowledge the current Privacy Policy and agree to the processing described, subject to applicable rights and feature controls.</label>
      <button type="button" className="signup-terms-open" disabled={busy||!terms||!privacy} onClick={accept}>{busy?'Saving agreement…':'Agree and continue'}</button>
    </>}
    <p><button type="button" disabled={busy} onClick={onSignOut}>Sign out instead</button></p>
  </div></main>
}
