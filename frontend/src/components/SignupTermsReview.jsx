import {useEffect,useRef,useState} from 'react'
import {TermsContent,TERMS_VERSION} from './TermsPage'
import {LEGAL_UPDATED_DATE} from '../lib/legalPolicy'

export default function SignupTermsReview({reviewed,accepted,onReviewed,onAccepted,disabled}){
  const [open,setOpen]=useState(false),reader=useRef(null)
  const complete=useRef(onReviewed);complete.current=onReviewed
  useEffect(()=>{
    if(!open)return
    const element=reader.current
    if(!element)return
    const check=()=>{if(element.clientHeight>0&&element.scrollHeight-element.scrollTop-element.clientHeight<=4)complete.current()}
    element.focus({preventScroll:true});check()
    const observer=new ResizeObserver(check);observer.observe(element)
    return()=>observer.disconnect()
  },[open])
  return <section className="signup-terms" aria-label="Required terms review"><h2>Review before creating your account</h2><p>Open the terms and scroll to the end, then choose whether to agree. Version {TERMS_VERSION}.</p><button type="button" className="signup-terms-open" disabled={disabled} aria-expanded={open} aria-controls="signup-terms-reader" onClick={()=>setOpen(value=>!value)}>{open?'Hide terms':reviewed?'Review terms again':'Read Terms and Conditions'}</button>
    {open&&<div id="signup-terms-reader" className="signup-terms-reader terms-page" ref={reader} tabIndex={0} role="region" aria-label="Terms and Conditions, scroll to the end" onScroll={event=>{const element=event.currentTarget;if(element.scrollHeight-element.scrollTop-element.clientHeight<=4)onReviewed()}}><h2>Terms and Conditions</h2><p>Version {TERMS_VERSION} · Draft · {LEGAL_UPDATED_DATE}</p><p>Operator identity and deployment-specific details remain to be finalized.</p><TermsContent/><p className="signup-terms-end">End of terms. You can now use the agreement checkbox below.</p></div>}
    <p id="signup-terms-status" role="status">{reviewed?'End of terms reached. Please indicate your agreement below.':'Review the terms to enable the agreement checkbox.'}</p><label className="signup-terms-agree"><input type="checkbox" required disabled={disabled||!reviewed} checked={accepted} aria-describedby="signup-terms-status" onChange={event=>onAccepted(event.target.checked)}/><span>I have reviewed and agree to the Terms and Conditions (version {TERMS_VERSION}), including the described extensive use of AI with my data and documents through enabled features.</span></label><p>AI processing may send personal data and document content to Gemini. Review the <a href="#/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> for purposes, recipients and supported controls. Opening this link does not submit the form.</p>
  </section>
}

