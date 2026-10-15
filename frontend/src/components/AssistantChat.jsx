import { useEffect, useRef, useState } from 'react'
import { X, Send, Square, Plus, MessageSquare, History, Pin, Archive, Trash2, Download, Copy, RefreshCw, Pencil, PanelLeftClose, Maximize2, Minimize2, RotateCcw, GitBranch, Link2, ArrowDown } from 'lucide-react'
import { activeTimeZone } from '../lib/timeZone'
import { captureScreen, readAssistantResponse, retryLabel, diagnosticRetryWindows, clientFailure } from '../lib/assistant'
import AssistantDiagnostics from './AssistantDiagnostics'
import AssistantMarkdown from './AssistantMarkdown'
import AssistantFiles from './AssistantFiles'
import { SHORTCUTS, matchesShortcut } from '../lib/shortcuts'
import useAssistantResize from '../hooks/useAssistantResize'
import './AssistantChat.css'

export default function AssistantChat({open,onClose,token,section,documentId,documentName,onOpenSource,mode='panel',routeConversationId,onConversationChange,onOpenPage,documents=[],onDocumentsChange}) {
  const sizing=useAssistantResize({open,mode})
  const [messages,setMessages]=useState([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(null),[checking,setChecking]=useState(false)
  const [workspace,setWorkspace]=useState(true),[screen,setScreen]=useState(true),[file,setFile]=useState(true)
  const [responseStyle,setResponseStyle]=useState('balanced'),[documentIds,setDocumentIds]=useState([]),[uploading,setUploading]=useState(false),[contextOpen,setContextOpen]=useState(false),[atBottom,setAtBottom]=useState(true)
  const [diagnostics,setDiagnostics]=useState(null),[failure,setFailure]=useState(null),[testing,setTesting]=useState(false),[clock,setClock]=useState(Date.now()),[chatRetryAt,setChatRetryAt]=useState(0),[testRetryAt,setTestRetryAt]=useState(0)
  const [chat,setChat]=useState(null),[chats,setChats]=useState([]),[historyOpen,setHistoryOpen]=useState(true),[query,setQuery]=useState(''),[archived,setArchived]=useState(false),[nextOffset,setNextOffset]=useState(null),[historyLoading,setHistoryLoading]=useState(false),[loading,setLoading]=useState(false),[managing,setManaging]=useState(false),[renaming,setRenaming]=useState(false),[title,setTitle]=useState(''),[confirmDelete,setConfirmDelete]=useState(false),[notice,setNotice]=useState('')
  const field=useRef(null),bottom=useRef(null),controller=useRef(null),lock=useRef(false),statusController=useRef(null),testController=useRef(null),testLock=useRef(false),active=useRef(null),historyVersion=useRef(0),selectionVersion=useRef(0),restored=useRef(false),drafts=useRef(new Map()),draft=useRef(''),mounted=useRef(true),managementLock=useRef(false)
  const chatWait=Math.max(0,Math.ceil((chatRetryAt-clock)/1000)),testWait=Math.max(0,Math.ceil((testRetryAt-clock)/1000))
  const remoteBusy=!!chat?.generatingUntil&&Date.parse(chat.generatingUntil)>clock
  const disabled=busy||testing||loading||managing||remoteBusy||uploading
  const uploadLock=useRef(false),messagesArea=useRef(null),routeRef=useRef(routeConversationId)
  routeRef.current=routeConversationId
  const remember=report=>{
    if(!report)return
    setDiagnostics(report)
    const windows=diagnosticRetryWindows(report)
    if(windows.chatUntil!==undefined)setChatRetryAt(windows.chatUntil)
    if(windows.testUntil!==undefined)setTestRetryAt(windows.testUntil)
  }
  const fail=error=>{error=clientFailure(error);setError(error.message);setFailure(error.diagnostics||null);remember(error.diagnostics)}
  const api=async(path='',options={})=>readAssistantResponse(await fetch(`/api/assistant/conversations${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}}))
  const editInput=value=>{draft.current=value;setInput(value)}
  const applyChat=(value,settings=true)=>{
    active.current=value;setChat(value);setMessages(value?.messages||[])
    onConversationChange?.(value?._id||null)
    if(settings){setWorkspace(value?.settings?.workspace??true);setScreen(value?.settings?.screen??true);setFile(value?.settings?.file??true);setResponseStyle(value?.settings?.responseStyle||'balanced');setDocumentIds(value?.settings?.documentIds||[])}
  }
  const openChat=async id=>{
    if(lock.current||testLock.current||managementLock.current||uploadLock.current)return
    drafts.current.set(active.current?._id||'new',draft.current)
    const version=++selectionVersion.current;setLoading(true);setAtBottom(true);setError('');setFailure(null);setNotice('');setRenaming(false);setConfirmDelete(false)
    try{const value=await api(`/${id}`);if(version!==selectionVersion.current||!mounted.current)return;applyChat(value);editInput(drafts.current.get(id)||'');if(window.matchMedia('(max-width:700px)').matches)setHistoryOpen(false)}
    catch(error){if(version===selectionVersion.current&&mounted.current)fail(error)}
    finally{if(version===selectionVersion.current&&mounted.current)setLoading(false)}
  }
  const loadHistory=async(offset=0)=>{
    const version=++historyVersion.current;setHistoryLoading(true)
    try{
      const data=await api(`?archived=${archived}&q=${encodeURIComponent(query)}&offset=${offset}`)
      if(version!==historyVersion.current||!mounted.current)return
      setChats(previous=>offset?[...previous,...data.conversations.filter(item=>!previous.some(old=>old._id===item._id))]:data.conversations);setNextOffset(data.nextOffset)
      if(!restored.current){restored.current=true;if(!routeRef.current&&!active.current&&!draft.current&&data.conversations.length&&!archived&&!query)openChat(data.conversations[0]._id)}
    }catch(error){if(version===historyVersion.current&&mounted.current)fail(error)}
    finally{if(version===historyVersion.current&&mounted.current)setHistoryLoading(false)}
  }
  const check=async()=>{
    statusController.current?.abort();const request=new AbortController();statusController.current=request;setChecking(true)
    try{const response=await fetch('/api/assistant/status',{headers:{Authorization:`Bearer ${token}`},signal:request.signal});const data=await readAssistantResponse(response);setStatus(data);if(data.lastResult)remember(data.lastResult)}
    catch(error){if(error.name!=='AbortError'&&mounted.current)fail(error)}
    finally{if(!request.signal.aborted&&mounted.current)setChecking(false)}
  }
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;selectionVersion.current++;historyVersion.current++;controller.current?.abort();statusController.current?.abort();testController.current?.abort()}},[])
  useEffect(()=>{if(!open)return;check();if(!routeRef.current&&active.current&&!lock.current)openChat(active.current._id);const previous=document.activeElement;field.current?.focus();return()=>previous?.isConnected&&previous.focus({preventScroll:true})},[open,token])
  useEffect(()=>{if(open&&mode==='page'&&routeConversationId&&routeConversationId!==active.current?._id)openChat(routeConversationId)},[open,mode,routeConversationId,busy])
  useEffect(()=>{if(open&&mode==='page'&&!routeConversationId)onConversationChange?.(active.current?._id||null)},[open,mode])
  useEffect(()=>{if(!open)return;const timer=setTimeout(()=>loadHistory(),250);return()=>{clearTimeout(timer);historyVersion.current++}},[open,query,archived,token])
  useEffect(()=>{
    if(!open)return
    setClock(Date.now());if(Math.max(chatRetryAt,testRetryAt,Date.parse(chat?.generatingUntil)||0)<=Date.now())return
    const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer)
  },[open,chatRetryAt,testRetryAt,chat?.generatingUntil])
  useEffect(()=>{
    if(!open||!chat?.generatingUntil||busy)return
    let cancelled=false
    const refresh=async()=>{try{const value=await api(`/${chat._id}`);if(!cancelled&&active.current?._id===value._id)applyChat(value,false)}catch(error){if(!cancelled){fail(error);clearInterval(timer)}}}
    const timer=setInterval(refresh,2500);refresh();return()=>{cancelled=true;clearInterval(timer)}
  },[open,chat?._id,chat?.generatingUntil,busy])
  useEffect(()=>{if(!open||mode==='page')return;document.body.classList.add('assistant-open');return()=>document.body.classList.remove('assistant-open')},[open,mode])
  useEffect(()=>{if(open&&atBottom&&messagesArea.current)messagesArea.current.scrollTop=messagesArea.current.scrollHeight},[messages,busy,open,atBottom])
  useEffect(()=>{
    if(!open)return
    const listener=event=>{
      if(event.isComposing||event.repeat)return
      for(const id of ['assistant-new','assistant-history','assistant-search'])if(matchesShortcut(event,SHORTCUTS.find(item=>item.id===id))){event.preventDefault();event.stopImmediatePropagation();if(id==='assistant-new')newChat();else if(id==='assistant-history')setHistoryOpen(value=>!value);else{setHistoryOpen(true);setTimeout(()=>document.getElementById('assistant-search')?.focus(),0)}return}
      if(event.key==='Escape'&&(mode!=='page'||confirmDelete||renaming)){event.preventDefault();event.stopImmediatePropagation();if(confirmDelete)setConfirmDelete(false);else if(renaming)setRenaming(false);else onClose()}
    }
    window.addEventListener('keydown',listener,true);return()=>window.removeEventListener('keydown',listener,true)
  },[open,onClose,confirmDelete,renaming,mode,disabled])
  const testConnection=async()=>{
    if(lock.current||testLock.current||managementLock.current||uploadLock.current||remoteBusy||testWait)return
    testLock.current=true;setTesting(true);setError('');setFailure(null);const request=new AbortController();testController.current=request
    try{const response=await fetch('/api/assistant/test',{method:'POST',headers:{Authorization:`Bearer ${token}`},signal:request.signal});const data=await readAssistantResponse(response);remember(data.diagnostics)}
    catch(error){if(error.name!=='AbortError')fail(error)}
    finally{testLock.current=false;if(mounted.current){setTesting(false);check()}}
  }
  const send=async(event,{regenerate=false,question:retryQuestion}={})=>{
    event?.preventDefault();const question=(retryQuestion??draft.current).trim()
    if((!regenerate&&!question)||lock.current||testLock.current||managementLock.current||uploadLock.current||loading||remoteBusy||chatWait||!status?.configured||chat?.archived)return
    lock.current=true;setBusy(true);setAtBottom(true);setError('');setFailure(null);setNotice('');let current=active.current
    const request=new AbortController();controller.current=request
    try{
      if(!current){current=await api('',{method:'POST',signal:request.signal});if(!mounted.current)return;applyChat(current,false)}
      const previous=current.messages||[]
      if(!regenerate){const visible=previous.at(-1)?.role==='user'&&previous.at(-1)?.content===question?previous.slice(0,-1):previous;setMessages([...visible,{role:'user',content:question,createdAt:new Date().toISOString()}]);editInput('');drafts.current.delete(current._id);drafts.current.delete('new')}
      const response=await fetch('/api/assistant/chat',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},signal:request.signal,body:JSON.stringify({conversationId:current._id,revision:current.revision,question,regenerate,section,timeZone:activeTimeZone(),includeWorkspace:workspace,includeScreen:screen,includeDocument:file,fileContext:file,documentIds,responseStyle,documentId:file?documentId||null:null,screen:screen?captureScreen():''})})
      const data=await readAssistantResponse(response);if(!mounted.current)return;remember(data.diagnostics);applyChat(data.conversation)
    }catch(error){
      if(!mounted.current)return
      if(error.name==='AbortError'){setError('Request stopped. Your saved conversation is preserved.');setFailure(null)}else fail(error)
      if(!regenerate)editInput(question)
      if(current){try{const saved=await api(`/${current._id}`);if(mounted.current)applyChat(saved)}catch{setError('Could not refresh the saved chat. Reopen it before retrying.')}}
    }finally{lock.current=false;if(mounted.current){setBusy(false);field.current?.focus();check();loadHistory()}}
  }
  const newChat=()=>{
    if(disabled||lock.current)return
    setArchived(false);setQuery('');setContextOpen(false)
    restored.current=true;selectionVersion.current++;setAtBottom(true);drafts.current.set(active.current?._id||'new',draft.current);applyChat(null);editInput(drafts.current.get('new')||'');setError('');setFailure(null);setNotice('');setRenaming(false);setConfirmDelete(false);if(window.matchMedia('(max-width:700px)').matches)setHistoryOpen(false);field.current?.focus()
  }
  const updateChat=async(changes,{fromUpload=false}={})=>{
    if(!active.current||(!fromUpload&&disabled)||managementLock.current)return
    managementLock.current=true;setManaging(true);setError('');setFailure(null)
    try{const value=await api(`/${active.current._id}`,{method:'PATCH',body:JSON.stringify({...changes,revision:active.current.revision})});applyChat(value);setRenaming(false);loadHistory()}
    catch(error){fail(error)}finally{managementLock.current=false;setManaging(false)}
  }
  const changeSetting=(key,value)=>{
    const settings={workspace,screen,file,responseStyle,documentIds,[key]:value}
    if(chat)updateChat({settings});else{setWorkspace(settings.workspace);setScreen(settings.screen);setFile(settings.file);setResponseStyle(settings.responseStyle);setDocumentIds(settings.documentIds)}
  }
  const uploadFiles=async files=>{
    if(disabled||uploadLock.current)return
    const chosen=Array.from(files);if(!chosen.length)return
    if(chosen.length+documentIds.length>5){setError('Attach up to five files. Remove a file before uploading more.');return}
    uploadLock.current=true;setUploading(true);setError('');setNotice('')
    const ids=[...documentIds],failures=[]
    try{
      for(const item of chosen){
        if(item.size>10*1024*1024){failures.push(`${item.name}: exceeds 10 MB`);continue}
        try{const body=new FormData();body.append('pdfFile',item);body.append('name',item.name);const response=await fetch('/api/pdfs',{method:'POST',headers:{Authorization:`Bearer ${token}`},body});const value=await readAssistantResponse(response);if(!mounted.current)return;onDocumentsChange?.(previous=>[value,...previous]);ids.push(value._id)}catch(error){failures.push(`${item.name}: ${error.message}`)}
      }
      if(active.current)await updateChat({settings:{workspace,screen,file,responseStyle,documentIds:ids}},{fromUpload:true});else setDocumentIds(ids)
      if(failures.length)setError(failures.join('; '));setNotice('Uploaded files are saved in Documents. Attachments are included with each question until removed.')
    }finally{uploadLock.current=false;setUploading(false)}
  }
  const deleteChat=async()=>{
    if(!chat||disabled||managementLock.current)return
    managementLock.current=true;setManaging(true);setError('')
    try{await api(`/${chat._id}?revision=${chat.revision}`,{method:'DELETE'});drafts.current.delete(chat._id);applyChat(null);editInput('');setConfirmDelete(false);setNotice('Chat deleted.');loadHistory()}
    catch(error){fail(error)}finally{managementLock.current=false;setManaging(false)}
  }
  const branchChat=async message=>{
    if(!chat||disabled||managementLock.current)return
    managementLock.current=true;setManaging(true);setError('');setFailure(null)
    drafts.current.set(chat._id,draft.current)
    try{
      const data=await api(`/${chat._id}/fork`,{method:'POST',body:JSON.stringify({messageId:message._id})})
      applyChat(data.conversation);editInput(data.question);setArchived(false);setQuery('');setAtBottom(true);setNotice(data.question?'Edit the question below and send it in this new branch. The original chat is preserved.':'New branch created. The original chat is preserved.');setRenaming(false);setConfirmDelete(false);loadHistory();field.current?.focus()
    }catch(error){fail(error)}finally{managementLock.current=false;setManaging(false)}
  }
  const copy=async text=>{try{await navigator.clipboard.writeText(text);setNotice('Copied to clipboard.')}catch{setNotice('Clipboard unavailable. Select the message text to copy it.')}}
  const exportChat=()=>{
    if(!chat)return
    const content=`# ${chat.title}\n\n`+messages.map(message=>`## ${message.role==='user'?'You':'Assistant'}\n\n${message.content}\n`).join('\n')
    const url=URL.createObjectURL(new Blob([content],{type:'text/markdown;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`${chat.title.replace(/[^a-zA-Z0-9 _-]/g,'').slice(0,80)||'conversation'}.md`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Chat exported as Markdown.')
  }
  const last=messages.at(-1)
  return open&&<aside ref={sizing.panelRef} data-assistant-ui className={`assistant-panel has-history is-expanded is-resizable${sizing.interacting?' is-interacting':''}${mode==='page'?' is-page':''}${historyOpen?' history-visible':''}`} role={mode==='page'?'region':'dialog'} aria-modal={mode==='page'?undefined:false} aria-labelledby="assistant-title" onKeyDown={event=>event.stopPropagation()}>
    <header className="assistant-header" {...sizing.headerProps} title={mode==='panel'?'Drag the header to move. Drag any edge or corner to resize.':undefined}><div><MessageSquare size={18}/><div><h2 id="assistant-title">Workspace assistant</h2><p>{mode==='page'?'Your AI workspace · Gemini':'Saved conversations · Gemini'}</p></div></div><div><button type="button" onClick={sizing.reset} aria-label="Reset assistant size and position" title="Reset size and position"><RotateCcw size={15}/></button><button type="button" onClick={()=>setHistoryOpen(!historyOpen)} aria-label="Toggle chat history" aria-expanded={historyOpen}><History size={16}/></button><button type="button" disabled={disabled} onClick={newChat} aria-label="Start a new chat"><Plus size={16}/></button>{mode!=='page'&&<><button type="button" onClick={onOpenPage} title="Open AI assistant page">Open page</button><button type="button" className="assistant-expand" onClick={sizing.toggleMaximize} aria-label={sizing.maximized?'Restore previous assistant size':'Fill available screen'} title={sizing.maximized?'Restore previous size':'Fill available screen'} aria-pressed={sizing.maximized}>{sizing.maximized?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button type="button" onClick={onClose} aria-label="Close assistant"><X size={18}/></button></>}</div></header>
    <div className="assistant-workspace">
      {historyOpen&&<nav className="assistant-history" aria-label="Saved conversations"><div className="assistant-history-heading"><strong>Chat history</strong><button type="button" onClick={()=>setHistoryOpen(false)} aria-label="Hide chat history"><PanelLeftClose size={15}/></button></div><button type="button" disabled={disabled} onClick={newChat}><Plus size={14}/>New chat</button><label className="sr-only" htmlFor="assistant-search">Search chats and messages</label><input id="assistant-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search chats and messages…" maxLength={100}/><div className="assistant-history-tabs"><button type="button" aria-pressed={!archived} onClick={()=>setArchived(false)}>Recent</button><button type="button" aria-pressed={archived} onClick={()=>setArchived(true)}>Archived</button></div><div className="assistant-history-list">{historyLoading&&!chats.length&&<p role="status">Loading history…</p>}{!historyLoading&&!chats.length&&<p>{query?'No matching conversations.':archived?'No archived chats.':'Your saved chats will appear here.'}</p>}{chats.map(item=><button type="button" key={item._id} className={chat?._id===item._id?'is-active':''} aria-current={chat?._id===item._id?'true':undefined} disabled={disabled} onClick={()=>openChat(item._id)}><span>{item.pinned&&<Pin size={12}/>}<span>{item.title}</span></span><small>{new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:activeTimeZone()}).format(new Date(item.updatedAt))}</small></button>)}{nextOffset!==null&&<button type="button" disabled={historyLoading} onClick={()=>loadHistory(nextOffset)}>{historyLoading?'Loading…':'Load older chats'}</button>}</div><button type="button" disabled={historyLoading} onClick={()=>loadHistory()}><RefreshCw size={13}/>Refresh history</button></nav>}
      <section className="assistant-thread" aria-label="Current conversation" aria-busy={loading}>
        <div className="assistant-chat-toolbar"><div><strong>{chat?.title||'New chat'}</strong><small>{loading?'Opening conversation…':chat?.archived?'Archived · Restore to continue':chat?'Saved to your account':'Start a conversation to save it'}</small></div>{chat&&<div><button type="button" disabled={disabled} aria-label="Reload saved chat" onClick={()=>openChat(chat._id)}><RefreshCw size={14}/></button><button type="button" disabled={disabled} aria-label="Rename chat" onClick={()=>{setTitle(chat.title);setRenaming(!renaming);setConfirmDelete(false)}}><Pencil size={14}/></button><button type="button" disabled={disabled} aria-label={chat.pinned?'Unpin chat':'Pin chat'} aria-pressed={chat.pinned} onClick={()=>updateChat({pinned:!chat.pinned})}><Pin size={14}/></button><button type="button" disabled={disabled} aria-label={chat.archived?'Restore chat':'Archive chat'} onClick={()=>updateChat({archived:!chat.archived})}><Archive size={14}/></button><button type="button" aria-label="Copy private chat link" onClick={()=>copy(window.location.href.split('#')[0]+'#/assistant/'+chat._id)}><Link2 size={14}/></button><button type="button" disabled={loading||busy} aria-label="Export chat as Markdown" onClick={exportChat}><Download size={14}/></button><button type="button" disabled={disabled} aria-label="Delete chat" onClick={()=>{setConfirmDelete(!confirmDelete);setRenaming(false)}}><Trash2 size={14}/></button></div>}</div>
        {renaming&&<form className="assistant-rename" onSubmit={event=>{event.preventDefault();updateChat({title})}}><label htmlFor="assistant-chat-title">Chat title</label><input id="assistant-chat-title" value={title} maxLength={120} onChange={event=>setTitle(event.target.value)} autoFocus/><button disabled={disabled||!title.trim()} type="submit">Save</button><button type="button" onClick={()=>setRenaming(false)}>Cancel</button></form>}
        {confirmDelete&&<div className="assistant-delete-confirm" role="alert"><p>Delete this chat and all its messages? This cannot be undone.</p><button type="button" disabled={disabled} onClick={deleteChat}>Delete chat</button><button type="button" disabled={managing} onClick={()=>setConfirmDelete(false)}>Keep chat</button></div>}
        <details className="assistant-context assistant-context-settings" open={contextOpen} onToggle={event=>setContextOpen(event.currentTarget.open)}><summary>Context & preferences <span>{workspace?'Workspace on':'Workspace off'} · {documentIds.length} attached {documentIds.length===1?'file':'files'} · {responseStyle}</span></summary><span>Current page: {documentId?documentName||'Open document':section}</span><div><label><input type="checkbox" checked={workspace} disabled={disabled||chat?.archived} onChange={event=>changeSetting('workspace',event.target.checked)}/>My workspace</label><label><input type="checkbox" checked={screen} disabled={disabled||chat?.archived} onChange={event=>changeSetting('screen',event.target.checked)}/>Visible screen text</label><label><input type="checkbox" checked={file} disabled={disabled||chat?.archived} onChange={event=>changeSetting('file',event.target.checked)}/>Open file{!documentId?' (none open)':''}</label></div><label className="assistant-response-preference">Response length<select value={responseStyle} disabled={disabled||chat?.archived} onChange={event=>changeSetting('responseStyle',event.target.value)}><option value="concise">Concise</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option></select></label><small>Chats are saved to your account. Selected context, attachments and recent messages are sent to Google Gemini with each question. Visible screen text is not a screenshot. The assistant answers and drafts content; it cannot modify your workspace or browse the web.</small></details>
        {status&&!status.configured&&<div className="assistant-setup" role="status"><strong>Connect the AI service</strong><p>Set GEMINI_API_KEY in backend/.env and restart the backend. Your saved chats remain available without an API key.</p><button type="button" disabled={checking} onClick={check}>{checking?'Checking…':'Check connection'}</button></div>}
        <AssistantDiagnostics status={status} result={diagnostics} testing={testing} checking={checking} busy={disabled} testWait={testWait} onTest={testConnection} onRefresh={()=>{setError('');setFailure(null);check()}}/>
        <div className="assistant-messages" ref={messagesArea} onScroll={event=>{const area=event.currentTarget;setAtBottom(area.scrollHeight-area.scrollTop-area.clientHeight<100)}} role="log" aria-label="Assistant conversation" aria-live="polite" aria-relevant="additions text">
          {!messages.length&&!loading&&<div className="assistant-empty assistant-welcome"><MessageSquare size={26}/><p className="assistant-eyebrow">YOUR WORKSPACE, IN CONVERSATION</p><h3>What would you like to work on?</h3><p>Think through an idea, understand a document, or make a plan around your work. Your conversations stay organized here.</p><div className="assistant-starters">{[{title:'Plan my week',text:'Help me plan this week around my upcoming deadlines and calendar appointments.'},{title:'Understand a file',text:'Summarize the attached files and explain their key ideas, with references.'},{title:'Learn something',text:'Help me understand a topic step by step. Start by asking what I want to learn.'},{title:'Draft and refine',text:'Help me draft something clearly. Ask me about the audience, purpose, and tone first.'}].map(item=><button type="button" key={item.title} disabled={disabled||chat?.archived} onClick={()=>{editInput(item.text);field.current?.focus()}}><strong>{item.title}</strong><span>{item.text}</span></button>)}</div><small>Answers may need review. Source links open the relevant workspace item.</small></div>}
          {messages.map((message,index)=><article className={`assistant-message is-${message.role} ${message.failed?'is-failed':''}`} key={message._id||index}><div className="assistant-message-meta"><strong>{message.role==='user'?'You':'Assistant'}</strong>{message.createdAt&&<time dateTime={message.createdAt}>{new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:activeTimeZone()}).format(new Date(message.createdAt))}</time>}<button type="button" disabled={disabled||!message._id} aria-label={message.role==="user"?"Edit question in a new branch":"Continue in a new branch"} title={message.role==="user"?"Edit question in a new branch":"Continue in a new branch"} onClick={()=>branchChat(message)}>{message.role==="user"?<Pencil size={12}/>:<GitBranch size={12}/>}</button><button type="button" aria-label="Copy message" onClick={()=>copy(message.content)}><Copy size={12}/></button></div>{message.role==='user'?<div className="assistant-user-text">{message.content}</div>:<AssistantMarkdown content={message.content} sources={message.sources} onOpenSource={source=>{if(onOpenSource(source)!==false)onClose();else setError('Close the current document editor before opening this item, or refresh the workspace if it was removed.')}}/>}{message.attachments?.length>0&&<div className="assistant-saved-attachments">{message.attachments.map(item=><button type="button" key={item.id} onClick={()=>{if(onOpenSource({type:'document',id:item.id,title:item.name})!==false)onClose();else setError('Close the current editor before opening this file.')}}>{item.name||'Attached file'}</button>)}</div>}{message.failed&&<small>This question did not receive an answer. Retry below or edit your question.</small>}{message.partial&&<small>The answer reached its length limit. Ask a follow-up for more detail.</small>}{message.context&&<details><summary>Context used</summary><small>{message.context.workspaceIncluded?`${message.context.includedTasks??0} tasks · ${message.context.includedCalendarEntries??0} calendar entries · ${message.context.includedDocuments??0} document records`:'Workspace context off'}{message.context.screenIncluded?' · Screen text included':''}</small>{(message.context.documents||[message.context.document].filter(Boolean)).map(item=><small key={item.id}>{item.name}: {item.notice}</small>)}<small>Recent conversation messages are included; older messages remain in history. Workspace context is refreshed for each question.</small></details>}</article>)}
          {(busy||remoteBusy)&&<p className="assistant-thinking" role="status">{busy?'Thinking…':'A reply is running in another tab…'}{busy&&<button type="button" onClick={()=>controller.current?.abort()}><Square size={12}/>Stop</button>}</p>}
          {!disabled&&chat&&!chat.archived&&last&&<div className="assistant-answer-actions">{last.role==='assistant'?<button type="button" disabled={chatWait>0||!status?.configured} onClick={()=>send(null,{regenerate:true})}><RefreshCw size={13}/>Regenerate answer</button>:<button type="button" disabled={chatWait>0||!status?.configured} onClick={()=>send(null,{question:last.content})}><RefreshCw size={13}/>Retry question</button>}{last.role==='assistant'&&last.partial&&<button type="button" disabled={chatWait>0||!status?.configured} onClick={()=>send(null,{question:'Continue your previous answer from where it stopped, without repeating earlier content.'})}>Continue answer</button>}</div>}{!atBottom&&messages.length>0&&<button type="button" className="assistant-jump" onClick={()=>{setAtBottom(true);messagesArea.current?.scrollTo({top:messagesArea.current.scrollHeight,behavior:'smooth'})}}><ArrowDown size={13}/>Jump to latest</button>}<div ref={bottom}/>
        </div>
        {notice&&<div className="assistant-notice" role="status">{notice}</div>}
        {chat?.generationError&&!error&&<div className="assistant-error">{chat.generationError}</div>}
        {error&&<div className="assistant-error assistant-error-card" role="alert"><strong>{error}</strong>{failure?.action&&<p>{failure.action}</p>}{failure?.actionUrl&&/^https:\/\/(aistudio\.google\.com|ai\.google\.dev)\//.test(failure.actionUrl)&&<a href={failure.actionUrl} target="_blank" rel="noopener noreferrer">Review Gemini guidance ↗</a>}{failure?.code&&<small>Provider code: {failure.code}</small>}{chatWait>0&&<small>Retry available in {retryLabel(chatWait)}.</small>}</div>}
        {chat?.archived?<div className="assistant-archived-banner"><span>This conversation is archived.</span><button type="button" disabled={disabled} onClick={()=>updateChat({archived:false})}>Restore to continue</button></div>:<form className="assistant-composer" onSubmit={send}><AssistantFiles documents={documents} selected={documentIds} onChange={ids=>changeSetting('documentIds',ids)} onUpload={uploadFiles} disabled={disabled} uploading={uploading}/><label className="sr-only" htmlFor="assistant-question">Ask the assistant</label><textarea id="assistant-question" ref={field} value={input} maxLength={4000} rows={3} disabled={disabled} placeholder={status?.configured?'Message the assistant…':'Connect Gemini to send a message…'} onChange={event=>editInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();send(event)}}}/><div><small>Enter to send · Shift+Enter for a new line</small><button type="submit" disabled={disabled||chatWait>0||!input.trim()||!status?.configured}><Send size={15}/>{chatWait>0?`Retry in ${retryLabel(chatWait)}`:'Send'}</button></div></form>}
      </section>
    </div>
    <span id="assistant-resize-help" className="sr-only">Drag to resize. With a resize handle focused, use arrow keys for 10 pixel steps, Shift and arrow keys for 40 pixel steps, or Home to reset. Escape cancels an active drag. Double-click a handle to reset the size.</span>
    <span data-assistant-dimensions className="assistant-size-readout" aria-hidden="true"/>
    {(mode==='page'?['e','s','se']:['n','e','s','w','ne','nw','se','sw']).map(direction=><button key={direction} type="button" className={`assistant-resize-handle resize-${direction}`} aria-label={`Resize assistant ${ {n:'top',e:'right',s:'bottom',w:'left',ne:'top right',nw:'top left',se:'bottom right',sw:'bottom left'}[direction]}`} aria-describedby="assistant-resize-help" title="Drag to resize · Double-click to reset" {...sizing.handleProps(direction)}/>)}
  </aside>
}
