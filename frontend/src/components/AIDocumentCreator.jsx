import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Loader2, FileText } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'
import './AIDocumentCreator.css'

export default function AIDocumentCreator({token,folderId,sourceFolder,onClose,onCreated}){
  const [prompt,setPrompt]=useState(''),[title,setTitle]=useState(''),[text,setText]=useState(''),[stage,setStage]=useState(''),[error,setError]=useState('')
  const controller=useRef(null),locked=useRef(false),panel=useRef(null)
  const [coverage,setCoverage]=useState(null)
  const [needsKey,setNeedsKey]=useState(false)
  useEffect(()=>{const previous=document.activeElement;panel.current?.scrollIntoView({block:'nearest'});panel.current?.querySelector('textarea')?.focus();return()=>{controller.current?.abort();if(previous?.isConnected)previous.focus({preventScroll:true})}},[])
  const generate=async()=>{
    if(locked.current||(!sourceFolder&&!prompt.trim()))return
    locked.current=true;setStage('generating');setError('');setNeedsKey(false)
    controller.current=new AbortController();const timer=setTimeout(()=>controller.current?.abort(),70000)
    try{
      const request = sourceFolder
        ? { prompt: prompt.trim() || 'Write 15 mixed-difficulty practice problems with a separate answer key.', sourceFolderId: sourceFolder._id }
        : { prompt }
      const response=await fetch('/api/documents/generate',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(request),signal:controller.current.signal})
      const draft=await readApiJson(response)
      if(draft.code==='PERSONAL_GEMINI_KEY_REQUIRED')setNeedsKey(true)
      if (sourceFolder) setCoverage({ sources: draft.sources || [], skipped: draft.skipped || [] })
      if(!response.ok)throw new Error(draft.message||'Could not generate a document.')
      if(typeof draft.title!=='string'||typeof draft.text!=='string')throw new Error('The server returned an invalid draft.')
      setTitle(draft.title);setText(draft.text)
    }catch(error){setError(error.name==='AbortError'?'Generation was canceled or timed out. Your previous draft has been kept.':error.message)}
    finally{clearTimeout(timer);locked.current=false;setStage('')}
  }
  const create=async()=>{
    if(locked.current||!title.trim()||!text.trim())return
    locked.current=true;setStage('creating');setError('')
    try{
      const response=await fetch('/api/documents/create-generated',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({title,text,folderId:folderId||null})})
      const file=await readApiJson(response)
      if(!response.ok)throw new Error(file.message||'Could not create the PDF.')
      if(!file._id)throw new Error('The server did not confirm creation. Refresh the library before retrying.')
      onCreated(file)
    }catch(error){setError(error.message)}finally{locked.current=false;setStage('')}
  }
  return <div className="library-modal-backdrop"><section ref={panel} className="ai-document-creator" role="region" aria-labelledby="ai-document-title" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'&&stage!=='creating'){event.preventDefault();onClose()}}}>
    <header><div><Sparkles size={19}/><h3 id="ai-document-title">{sourceFolder ? 'Create practice packet' : 'Create with AI'}</h3></div><button type="button" disabled={stage==='creating'} onClick={onClose} aria-label="Close AI document generator"><X size={18}/></button></header>
    <p>{sourceFolder ? `Generate practice problems and an answer key from files directly in ${sourceFolder.name}.` : 'Turn an idea into notes, a study guide, a worksheet, or a template. Review the draft before creating your document.'}</p>
    <label htmlFor="ai-document-prompt">{sourceFolder ? 'Topics, difficulty, or number of problems (optional)' : 'What would you like to create?'}</label><textarea id="ai-document-prompt" rows={3} maxLength={6000} value={prompt} disabled={!!stage} onChange={event=>setPrompt(event.target.value)} placeholder={sourceFolder ? 'For example, 20 problems with extra practice on related rates' : 'Create a study guide on related rates, with key formulas, worked examples, and practice questions…'}/>
    <div className="ai-document-generate"><small>{sourceFolder ? 'Sends supported file contents and saved text annotations to Gemini. Up to 20 files in this folder.' : 'Uses your configured Gemini key. Only this description is sent.'}</small><button type="button" disabled={!!stage||(!sourceFolder&&!prompt.trim())} onClick={generate}>{stage==='generating'?<Loader2 size={15} className="animate-spin"/>:<Sparkles size={15}/>} {stage==='generating'?'Generating…':text?'Regenerate draft':'Generate draft'}</button>{stage==='generating'&&<button type="button" onClick={()=>controller.current?.abort()}>Stop</button>}</div>
    {coverage && <details open={coverage.skipped.length > 0}>
      <summary>{coverage.sources.length} sources included · {coverage.skipped.length} skipped</summary>
      <ul>{coverage.sources.map((source,index)=><li key={index}>{source.name}{source.notice ? ` — ${source.notice}` : ''}</li>)}
      {coverage.skipped.map((source,index)=><li key={`skipped-${index}`}>Skipped: {source}</li>)}</ul>
    </details>}
    {(text||title)&&<div className="ai-document-draft"><label htmlFor="ai-document-name">Document name</label><input id="ai-document-name" value={title} maxLength={120} disabled={!!stage} onChange={event=>setTitle(event.target.value)}/><label htmlFor="ai-document-text">Review and edit your draft</label><textarea id="ai-document-text" rows={14} maxLength={20000} value={text} disabled={!!stage} onChange={event=>setText(event.target.value)}/><small>{text.length.toLocaleString()} / 20,000 characters · AI content may need corrections.</small></div>}
    {error&&<p className="ai-document-error" role="alert">{error}</p>}
    {needsKey&&<a className="underline" href="#/account" target="_blank" rel="noopener noreferrer">Open Account → AI settings</a>}
    <footer><p>The PDF opens with editable text blocks. Add highlights and annotations, save your edits, and use Download in the PDF editor to export the finished document.</p><button type="button" disabled={stage==='creating'} onClick={onClose}>Cancel</button><button className="library-primary" type="button" disabled={!!stage||!title.trim()||!text.trim()} onClick={create}>{stage==='creating'?<Loader2 size={16} className="animate-spin"/>:<FileText size={16}/>} {stage==='creating'?'Creating PDF…':'Create PDF & open editor'}</button></footer>
  </section></div>
}
