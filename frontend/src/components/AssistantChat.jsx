import { useEffect, useRef, useState } from 'react'
import { X, Send, Square, RotateCcw, MessageSquare, ArrowUpRight } from 'lucide-react'
import { activeTimeZone } from '../lib/timeZone'
import { answerParts, captureScreen, chatHistory, readAssistantResponse, retryLabel, diagnosticRetryWindows, clientFailure } from '../lib/assistant'
import AssistantDiagnostics from './AssistantDiagnostics'
import './AssistantChat.css'

export default function AssistantChat({open,onClose,token,section,documentId,documentName,onOpenSource}) {
  const [messages,setMessages]=useState([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(null),[checking,setChecking]=useState(false)
  const [workspace,setWorkspace]=useState(true),[screen,setScreen]=useState(true),[file,setFile]=useState(true)
  const [diagnostics,setDiagnostics]=useState(null),[failure,setFailure]=useState(null),[testing,setTesting]=useState(false),[clock,setClock]=useState(Date.now()),[chatRetryAt,setChatRetryAt]=useState(0),[testRetryAt,setTestRetryAt]=useState(0)
  const field=useRef(null),bottom=useRef(null),controller=useRef(null),lock=useRef(false),statusController=useRef(null),testController=useRef(null),testLock=useRef(false)
  const chatWait=Math.max(0,Math.ceil((chatRetryAt-clock)/1000)),testWait=Math.max(0,Math.ceil((testRetryAt-clock)/1000))
  const remember=report=>{
    if(!report)return
    setDiagnostics(report)
    const windows=diagnosticRetryWindows(report)
    if(windows.chatUntil!==undefined)setChatRetryAt(windows.chatUntil)
    if(windows.testUntil!==undefined)setTestRetryAt(windows.testUntil)
  }
  useEffect(()=>{
    if(!open)return
    setClock(Date.now());const until=Math.max(chatRetryAt,testRetryAt);if(until<=Date.now())return
    const timer=setInterval(()=>{const now=Date.now();setClock(now);if(now>=until)clearInterval(timer)},1000)
    return()=>clearInterval(timer)
  },[open,chatRetryAt,testRetryAt])
  const check=async()=>{
    statusController.current?.abort();const request=new AbortController();statusController.current=request;setChecking(true)
    try {const response=await fetch('/api/assistant/status',{headers:{Authorization:`Bearer ${token}`},signal:request.signal});const data=await readAssistantResponse(response);setStatus(data);if(data.lastResult)remember(data.lastResult)}
    catch(error){error=clientFailure(error);if(error.name!=='AbortError'){setError(error.message);setFailure(error.diagnostics||null);remember(error.diagnostics)}}
    finally{if(!request.signal.aborted)setChecking(false)}
  }
  useEffect(()=>{if(open){check();const previous=document.activeElement;field.current?.focus();return()=>previous?.isConnected&&previous.focus({preventScroll:true})}},[open,token])
  useEffect(()=>()=>{controller.current?.abort();statusController.current?.abort();testController.current?.abort()},[])
  useEffect(()=>{if(!open)return;document.body.classList.add('assistant-open');return()=>document.body.classList.remove('assistant-open')},[open])
  useEffect(()=>{if(open)bottom.current?.scrollIntoView({block:'nearest'})},[messages,busy,open])
  useEffect(()=>{
    if(!open)return
    const listener=event=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();onClose()}}
    window.addEventListener('keydown',listener,true);return()=>window.removeEventListener('keydown',listener,true)
  },[open,onClose])
  const testConnection=async()=>{
    if(lock.current||testLock.current||testWait)return
    testLock.current=true;setTesting(true);setError('');setFailure(null);const request=new AbortController();testController.current=request
    try {const response=await fetch('/api/assistant/test',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:request.signal});const data=await readAssistantResponse(response);remember(data.diagnostics)}
    catch(error){error=clientFailure(error);if(error.name!=='AbortError'){setError(error.message);setFailure(error.diagnostics||null);remember(error.diagnostics)}}
    finally{testLock.current=false;setTesting(false);check()}
  }
  const send=async event=>{
    event.preventDefault();const question=input.trim();if(!question||lock.current||testLock.current||chatWait||!status?.configured)return
    lock.current=true;setBusy(true);setError('');setFailure(null)
    const previous=messages.filter(message=>!message.failed),next=[...previous,{role:'user',content:question}]
    setMessages(next);setInput('');const request=new AbortController();controller.current=request
    try {
      const response=await fetch('/api/assistant/chat',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:request.signal,body:JSON.stringify({messages:chatHistory(next),section,timeZone:activeTimeZone(),includeWorkspace:workspace,includeScreen:screen,includeDocument:!!documentId&&file,documentId:documentId||null,screen:screen?captureScreen():''})})
      const data=await readAssistantResponse(response);remember(data.diagnostics)
      if(typeof data.text!=='string'||!data.text.trim())throw new Error('The assistant returned no answer.')
      setMessages([...next,{role:'assistant',content:data.text,sources:data.sources||[],context:data.context,partial:data.partial}])
    } catch(error){error=clientFailure(error);setMessages([...previous,{role:'user',content:question,failed:true}]);setInput(question);setError(error.name==='AbortError'?'Request stopped. You can edit your question and try again.':error.message);setFailure(error.diagnostics||null);remember(error.diagnostics)}
    finally{lock.current=false;setBusy(false);field.current?.focus();check()}
  }
  const clear=()=>{if(lock.current||testLock.current)return;setMessages([]);setError('');setFailure(null);setInput('');field.current?.focus()}
  return <>
    {open&&<aside data-assistant-ui className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title" onKeyDown={event=>event.stopPropagation()}>
      <header className="assistant-header"><div><MessageSquare size={18}/><div><h2 id="assistant-title">Workspace assistant</h2><p>Ask about your work or anything else</p></div></div><div><button type="button" disabled={busy||testing} onClick={clear} aria-label="Start a new chat"><RotateCcw size={16}/></button><button type="button" onClick={onClose} aria-label="Close assistant"><X size={18}/></button></div></header>
      <div className="assistant-context"><span>Context · {documentId?documentName||'Open document':section}</span><div><label><input type="checkbox" checked={workspace} disabled={busy} onChange={event=>setWorkspace(event.target.checked)}/>My workspace</label><label><input type="checkbox" checked={screen} disabled={busy} onChange={event=>setScreen(event.target.checked)}/>Visible screen text</label>{documentId&&<label><input type="checkbox" checked={file} disabled={busy} onChange={event=>setFile(event.target.checked)}/>Open file content</label>}</div><small>Selected context and this conversation are sent to OpenAI with your question. Screen text is not a screenshot. Chat stays in this tab; the assistant cannot change your data.</small></div>
      {status&&!status.configured&&<div className="assistant-setup" role="status"><strong>Connect the AI service</strong><p>The backend needs an OpenAI API key before this assistant can answer. Set OPENAI_API_KEY in backend/.env and restart the backend. The key stays on the server.</p><button type="button" disabled={checking} onClick={()=>{setError('');check()}}>{checking?'Checking…':'Check connection'}</button></div>}
      <AssistantDiagnostics status={status} result={diagnostics} testing={testing} checking={checking} busy={busy} testWait={testWait} onTest={testConnection} onRefresh={()=>{setError('');setFailure(null);check()}}/>
      <div className="assistant-messages" role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions text">
        {!messages.length&&<div className="assistant-empty"><h3>How can I help?</h3><p>Summarize upcoming deadlines, explain a task or file, plan around calendar appointments, or ask a general question.</p><div>{['What should I work on next?','Explain what I’m viewing.','What is due this week?'].map(question=><button type="button" key={question} onClick={()=>{setInput(question);field.current?.focus()}}>{question}</button>)}</div></div>}
        {messages.map((message,index)=><article className={`assistant-message is-${message.role} ${message.failed?'is-failed':''}`} key={index}><strong>{message.role==='user'?'You':'Assistant'}</strong><div>{(message.role==='user'?[{text:message.content}]:answerParts(message.content,message.sources)).map((part,index)=>part.source?<button type="button" className="assistant-source" key={index} onClick={()=>{if(onOpenSource(part.source)!==false)onClose();else setError('Close the current document editor before opening this item, or refresh the workspace if it was removed.')}}>{part.source.title}<ArrowUpRight size={12}/></button>:<span key={index}>{part.text}</span>)}</div>{message.partial&&<small>The answer reached its length limit. Ask a follow-up for more detail.</small>}{message.context&&<details><summary>Context used</summary><small>{message.context.workspaceIncluded?`${message.context.includedTasks??0} tasks · ${message.context.includedCalendarEntries??0} calendar entries · ${message.context.includedDocuments??0} document records`:'Workspace context off'}{message.context.screenIncluded?' · Screen text included':''}</small>{message.context.document&&<small>{message.context.document.name}: {message.context.document.notice}</small>}<small>Context is bounded; large workspaces and long notes may be shortened.</small></details>}</article>)}
        {busy&&<p className="assistant-thinking" role="status">Thinking… <button type="button" onClick={()=>controller.current?.abort()}><Square size={12}/>Stop</button></p>}<div ref={bottom}/>
      </div>
      {error&&<div className="assistant-error assistant-error-card" role="alert"><strong>{error}</strong>{failure?.action&&<p>{failure.action}</p>}{failure?.actionUrl&&/^https:\/\/(platform\.openai\.com|status\.openai\.com)\//.test(failure.actionUrl)&&<a href={failure.actionUrl} target="_blank" rel="noopener noreferrer">{failure.category==='quota'?'Open API billing settings':'Open provider status'} ↗</a>}{failure?.code&&<small>Provider code: {failure.code}</small>}{chatWait>0&&<small>Retry available in {retryLabel(chatWait)}.</small>}</div>}
      <form className="assistant-composer" onSubmit={send}><label className="sr-only" htmlFor="assistant-question">Ask the assistant</label><textarea id="assistant-question" ref={field} value={input} maxLength={4000} rows={3} disabled={busy} placeholder={status?.configured?'Ask about this page, your workspace, or any topic…':'Connect the AI service to start asking questions…'} onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send(event)}}}/><div><small>Enter to send · Shift+Enter for a new line · Esc to close</small><button type="submit" disabled={busy||testing||chatWait>0||!input.trim()||!status?.configured}><Send size={15}/>{chatWait>0?`Retry in ${retryLabel(chatWait)}`:'Send'}</button></div></form>
    </aside>}
  </>
}
