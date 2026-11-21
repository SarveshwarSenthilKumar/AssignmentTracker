import {useId} from 'react'
import {Lock} from 'lucide-react'
import './DocumentAccessNotice.css'

export default function DocumentAccessNotice({message,onClose,onRetry,onSaveDraft}) {
  const id=useId()
  return <div className="document-access-notice" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onKeyDown={event=>{
    event.stopPropagation()
    if(event.key==='Escape'){event.preventDefault();onClose()}
    if(event.key==='Tab'){
      const buttons=[...event.currentTarget.querySelectorAll('button:not(:disabled)')]
      const first=buttons[0],last=buttons[buttons.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
    }
  }}>
    <section>
      <Lock size={28} aria-hidden="true"/>
      <h2 id={`${id}-title`}>You don’t have access to this document</h2>
      <p id={`${id}-message`}>{message||'This document may be private, its link may no longer be valid, or the owner may have removed your access.'}</p>
      <p>Ask the owner for access or a new sharing link. If you were invited using your account, make sure you’re signed in to that account.</p>
      <div><button type="button" onClick={onClose} autoFocus>Back to app</button>{onRetry&&<button type="button" onClick={onRetry}>Try again</button>}{onSaveDraft&&<button type="button" onClick={onSaveDraft}>Download local draft</button>}</div>
    </section>
  </div>
}
