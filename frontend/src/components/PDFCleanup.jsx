import {useEffect,useRef,useState} from 'react'
import {X} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import CoverLetterError from './CoverLetterError'
import './PDFCleanup.css'

export default function PDFCleanup({open,onClose,pdfId,token,page,onPrepare,onApply}){
  const [comments,setComments]=useState(''),[scope,setScope]=useState('page'),[busy,setBusy]=useState(false),[error,setError]=useState(null),[draft,setDraft]=useState(null),[notice,setNotice]=useState('')
  const controller=useRef(null),input=useRef(null)
  useEffect(()=>{if(open)input.current?.focus({preventScroll:true})},[open])
  useEffect(()=>()=>controller.current?.abort(),[])
  const reset=()=>{controller.current?.abort();setDraft(null);setError(null);setNotice('')}
  const close=()=>{reset();onClose()}
  const generate=async event=>{
    event.preventDefault();if(busy)return
    const request=new AbortController();controller.current=request;setBusy(true);setDraft(null);setError(null);setNotice('Reading editable PDF text…')
    try{
      const snapshot=await onPrepare(scope,request.signal)
      if(request.signal.aborted)return
      setNotice('Preparing cleanup from your comments…')
      const response=await fetch(`/api/pdfs/${pdfId}/cleanup`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:request.signal,body:JSON.stringify({comments,texts:snapshot.texts})})
      const data=await readApiJson(response)
      if(!response.ok){const failure=new Error(data.message||'Could not prepare cleanup.');failure.diagnostics=data.diagnostics;throw failure}
      if(!Array.isArray(data.replacements))throw new Error('The server returned an invalid cleanup response.')
      setDraft({...data,snapshot,replacements:data.replacements.map(item=>({...item,selected:true}))});setNotice(data.replacements.length?'Review the proposed changes before applying.':'No text changes were suggested.')
    }catch(error){if(!request.signal.aborted)setError({message:error.message,diagnostics:{source:'browser',stage:'PDF cleanup',timestamp:new Date().toISOString(),...error.diagnostics}})}finally{if(controller.current===request){setBusy(false);setNotice(previous=>request.signal.aborted?'Cleanup canceled.':previous)}}
  }
  const apply=()=>{
    try{onApply(draft.snapshot,draft.replacements.filter(item=>item.selected));setDraft(null);setError(null);setNotice('Cleanup applied. Use Undo or Ctrl+Z to revert; changes use the editor’s usual save flow.')}
    catch(error){setError({message:error.message,diagnostics:{source:'browser',stage:'Applying PDF cleanup',timestamp:new Date().toISOString()}})}
  }
  if(!open)return null
  return <aside className="pdf-cleanup" aria-label="Clean up PDF" data-keep-text-active>
    <header><strong>Clean up PDF</strong><button type="button" onClick={close} aria-label="Close PDF cleanup"><X size={17}/></button></header>
    <p>Describe what to fix. AI proposes text corrections while keeping the original fonts, sizes and positions. Ink, drawings and images stay unchanged.</p>
    <form onSubmit={generate}><label>Scope<select value={scope} disabled={busy} onChange={event=>{reset();setScope(event.target.value)}}><option value="page">Current page ({page})</option><option value="document">Whole PDF (up to 20 pages)</option></select></label>
      <label>Your comments<textarea ref={input} rows={5} value={comments} maxLength={6000} required disabled={busy} onChange={event=>{reset();setComments(event.target.value)}} placeholder="Fix typos, tidy punctuation, and clarify the second paragraph. Keep my wording and all equations."/></label>
      <p>Only editable text from this scope and your comments are sent to your configured AI.</p><button type="submit" disabled={busy||!comments.trim()}>{busy?'Preparing cleanup…':'Prepare cleanup'}</button>{busy&&<button type="button" onClick={()=>controller.current?.abort()}>Cancel</button>}
    </form>
    {notice&&<p role="status">{notice}</p>}{error&&<CoverLetterError error={error}/>}
    {draft&&<section><h3>Review changes</h3>{draft.warnings?.map((warning,index)=><p key={index}>{warning}</p>)}
      {draft.replacements.map((item,index)=><div className="pdf-cleanup-change" key={item.id}><label className="pdf-cleanup-check"><input type="checkbox" checked={item.selected} onChange={event=>setDraft(previous=>({...previous,replacements:previous.replacements.map((value,n)=>n===index?{...value,selected:event.target.checked}:value)}))}/>Page {draft.snapshot.texts.find(text=>text.id===item.id)?.page} · Include change</label><blockquote>{draft.snapshot.texts.find(text=>text.id===item.id)?.text}</blockquote><textarea aria-label={`Replacement ${index+1}`} rows={3} maxLength={6000} value={item.text} onChange={event=>setDraft(previous=>({...previous,replacements:previous.replacements.map((value,n)=>n===index?{...value,text:event.target.value}:value)}))}/>{item.reason&&<p>{item.reason}</p>}</div>)}
      {!!draft.replacements.length&&<button type="button" disabled={!draft.replacements.some(item=>item.selected)} onClick={apply}>Apply selected changes</button>}
    </section>}
  </aside>
}
