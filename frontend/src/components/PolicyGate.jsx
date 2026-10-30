import {useEffect,useState} from 'react'
import TermsPage from './TermsPage'
import PrivacyPage from './PrivacyPage'
import {TERMS_VERSION,PRIVACY_VERSION} from '../lib/legalPolicy'
import {readApiJson} from '../lib/apiResponse'
import {ShieldCheck,FileText,ArrowUpRight,ArrowRight,LogOut,Loader2} from 'lucide-react'
import {LEGAL_UPDATED_DATE} from '../lib/legalPolicy'
import './TermsPage.css'
import PolicySupport from './PolicySupport'

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
  if(['terms','privacy'].includes(route.split('/')[1]))return <><div className="policy-reading-bar"><a href="#/home">← Return to policy review</a><a href={route.split('/')[1]==='terms'?'#/privacy':'#/terms'}>{route.split('/')[1]==='terms'?'Read Privacy Policy':'Read Terms and Conditions'} ↗</a></div>{route.split('/')[1]==='terms'?<TermsPage signedIn/>:<PrivacyPage signedIn/>}</>
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
  return <main className="policy-gate platform-viewport"><div className="policy-shell">
    <div className="policy-brand"><ShieldCheck size={20}/><span>ASSIGNMENT TRACKER</span><span className="policy-status">Policy review</span></div>
    <header className="policy-intro"><span className="policy-eyebrow">YOUR WORKSPACE · YOUR CHOICES</span><h1>A moment to review<br/>what’s changed.</h1><p>Review our current terms and privacy practices before returning to your workspace.</p></header>
    <div className="policy-layout"><section className="policy-documents" aria-labelledby="policy-documents-heading"><h2 id="policy-documents-heading">Your policy documents</h2><p className="policy-caption">Updated {LEGAL_UPDATED_DATE} · Open either document to read the full policy.</p>
      <a className="policy-document-card" href="#/terms"><FileText size={24}/><span><strong>Terms and Conditions</strong><small>Platform use, AI features and your responsibilities</small><em>Version {TERMS_VERSION} · Read document</em></span><ArrowUpRight size={20}/></a>
      <a className="policy-document-card" href="#/privacy"><ShieldCheck size={24}/><span><strong>Privacy Policy</strong><small>Your data, documents, AI processing and controls</small><em>Version {PRIVACY_VERSION} · Read document</em></span><ArrowUpRight size={20}/></a>
      <div className="policy-explanation"><ShieldCheck size={18}/><p>These policies cover extensive AI processing of personal data and documents, external providers, retention and your available controls.</p></div>
      <PolicySupport token={token}/>
    </section><section className="policy-agreement" aria-labelledby="policy-agreement-heading"><span className="policy-eyebrow">REQUIRED TO CONTINUE</span><h2 id="policy-agreement-heading">Confirm your agreement</h2><p className="policy-caption">Workspace access is paused until you accept both current documents. You can sign out at any time.</p>
    {!status&&!error&&<p role="status">Checking policy versions…</p>}
    {error&&<p role="alert">{error} <button type="button" onClick={()=>setRevision(value=>value+1)}>Retry</button></p>}
    {mismatch?<p role="alert">A newer policy version is available. <button type="button" onClick={()=>window.location.reload()}>Reload to review</button></p>:status&&<>
      <label className="signup-terms-agree"><input type="checkbox" checked={terms} disabled={busy} onChange={event=>setTerms(event.target.checked)}/>I have reviewed and agree to the current Terms and Conditions.</label>
      <label className="signup-terms-agree"><input type="checkbox" checked={privacy} disabled={busy} onChange={event=>setPrivacy(event.target.checked)}/>I have reviewed and acknowledge the current Privacy Policy and agree to the processing described, subject to applicable rights and feature controls.</label>
      <button type="button" className="policy-continue" disabled={busy||!terms||!privacy} onClick={accept}>{busy?<Loader2 size={18} className="animate-spin"/>:<ArrowRight size={18}/>} {busy?'Saving agreement…':'Agree and continue'}</button>
    </>}
    <button type="button" className="policy-signout" disabled={busy} onClick={onSignOut}><LogOut size={15}/>Sign out instead</button>
    </section></div><footer className="policy-footer"><span>Clear terms. Informed choices.</span><a href="#/terms">Terms and Conditions</a><a href="#/privacy">Privacy Policy</a></footer>
  </div></main>
}
