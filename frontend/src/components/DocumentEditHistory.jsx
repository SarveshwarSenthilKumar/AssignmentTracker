import {useEffect,useRef,useState} from 'react'
import {History,X,RefreshCw} from 'lucide-react'
import {sharedDocumentRequest} from '../lib/sharedDocumentRequest'
import './DocumentEditHistory.css'

export default function DocumentEditHistory({url,token,onClose}) {
  const [items,setItems]=useState([]),[cursor,setCursor]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState('')
  const loadRef=useRef(null),close=useRef(null),cursorRef=useRef(null)
  cursorRef.current=cursor
  useEffect(()=>{
    const controller=new AbortController(),opener=document.activeElement
    close.current?.focus()
    let loading=false,older=false
    setItems([]);setCursor(null);setError('')
    const load=async(more,refresh=false)=>{
      if(loading||controller.signal.aborted)return
      if(older&&!more&&!refresh)return
      if(refresh)older=false
      loading=true;setBusy(true);setError('')
      try{
        const before=more&&cursorRef.current?`&before=${encodeURIComponent(cursorRef.current)}`:''
        const response=await sharedDocumentRequest(`${url}?limit=40${before}`,{signal:controller.signal,cache:'no-store',headers:token?{Authorization:`Bearer ${token}`}:{}})
        const data=await response.json()
        if(!response.ok){if([401,403,404].includes(response.status))setItems([]);throw new Error(data.message||'Could not load edit history.')}
        if(controller.signal.aborted)return
        setItems(previous=>{
          const merged=new Map((more?previous:[]).map(item=>[item.id,item]))
          data.items.forEach(item=>merged.set(item.id,item))
          return [...merged.values()].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,data.limit||300)
        })
        if(more||!older)setCursor(data.nextCursor)
        if(more)older=true
      }catch(error){if(!controller.signal.aborted)setError(error.message)}
      finally{loading=false;if(!controller.signal.aborted)setBusy(false)}
    }
    loadRef.current=load;load(false)
    const timer=setInterval(()=>load(false),4000)
    return()=>{controller.abort();clearInterval(timer);loadRef.current=null;if(opener?.isConnected)opener.focus({preventScroll:true})}
  },[url,token])
  const query=search.trim().toLowerCase()
  const visible=items.filter(item=>`${item.actor} ${item.action} ${item.pages.map(page=>`page ${page}`).join(' ')}`.toLowerCase().includes(query))
  return <aside className="document-edit-history" role="dialog" aria-label="Document edit history" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();onClose()}}}>
    <header><h2><History size={18}/>Edit history</h2><button type="button" ref={close} aria-label="Close edit history" onClick={onClose}><X size={18}/></button></header>
    <div className="document-history-controls"><input type="search" aria-label="Filter edit history" placeholder="Search people, actions, or pages…" value={search} onChange={event=>setSearch(event.target.value)}/><button type="button" disabled={busy} onClick={()=>loadRef.current?.(false,true)} aria-label="Refresh latest edit history"><RefreshCw size={16}/></button></div>
    <p className="document-history-note">Shows the latest 300 saved edit groups. Continuous edits are grouped together. Earlier edits from before history was enabled are unavailable.</p>
    {error&&<p className="document-history-error" role="alert">{error}</p>}
    <ol aria-busy={busy}>{visible.map(item=><li key={item.id}><strong>{item.actor}</strong><span>{item.action}</span>{item.pages.length>0&&<small>Page{item.pages.length===1?'':'s'} {item.pages.join(', ')}</small>}<time dateTime={item.at} title={`Started ${new Date(item.startedAt||item.at).toLocaleString()}`}>{new Date(item.at).toLocaleString()}</time>{item.updates>1&&<small>{item.updates} updates grouped</small>}</li>)}</ol>
    {!busy&&!error&&!visible.length&&<p className="document-history-empty">{query?'No matching edits.':'No edits recorded yet. New saved changes will appear here.'}</p>}
    <footer>{busy&&<span role="status">Loading history…</span>}{cursor&&<button type="button" disabled={busy} onClick={()=>loadRef.current?.(true)}>Load older edits</button>}</footer>
  </aside>
}
