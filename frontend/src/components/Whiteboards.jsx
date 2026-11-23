import {useEffect,useRef,useState} from 'react'
import {Plus,Presentation,Users,Share2,RefreshCw,ExternalLink,Search,Link2} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import DocumentShareLink from './DocumentShareLink'
import './Whiteboards.css'

export default function Whiteboards({token,documents,onDocumentsChange,onOpen}){
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [query,setQuery]=useState(''),[share,setShare]=useState(null),[shared,setShared]=useState([]),[loading,setLoading]=useState(true),[sharedError,setSharedError]=useState(''),[version,setVersion]=useState(0),[link,setLink]=useState('')
  const lock=useRef(false)
  const sharePanel=useRef(null)
  useEffect(()=>{
    if(!share)return
    sharePanel.current?.scrollIntoView({behavior:'smooth',block:'center'})
    sharePanel.current?.focus({preventScroll:true})
  },[share?._id])
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setSharedError('')
    fetch('/api/shared-with-me/documents',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}).then(async response=>{
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not load shared whiteboards.')
      if(!controller.signal.aborted)setShared(data.filter(file=>file.documentKind==='whiteboard'))
    }).catch(error=>{if(!controller.signal.aborted)setSharedError(error.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,version])
  const create=async event=>{
    event.preventDefault();if(lock.current||!name.trim())return
    lock.current=true;setBusy(true);setError('')
    try{
      const response=await fetch('/api/pdfs/blank-notebook',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),pageCount:1,pageSize:'letter',whiteboard:true})})
      const file=await readApiJson(response)
      if(!response.ok)throw new Error(file.message||'Could not create the whiteboard.')
      if(!file._id)throw new Error('No whiteboard was returned. Refresh Documents before retrying.')
      onDocumentsChange(previous=>[file,...previous.filter(item=>item._id!==file._id)])
      setName('');onOpen(file._id)
    }catch(error){setError(error.message)}finally{lock.current=false;setBusy(false)}
  }
  const join=event=>{
    event.preventDefault();setError('')
    try{
      const url=new URL(link.trim(),window.location.origin)
      const match=/^#\/shared-document\/([A-Za-z0-9_-]{43})$/.exec(url.hash)
      if(url.origin!==window.location.origin||!match)throw new Error('Paste a whiteboard sharing link from this app.')
      window.location.hash=`/shared-document/${match[1]}`
    }catch(error){setError(error.message)}
  }
  const matches=file=>`${file.name} ${file.owner||''}`.toLowerCase().includes(query.trim().toLowerCase())
  const owned=documents.filter(file=>file.documentKind==='whiteboard'&&!file.deletedAt&&matches(file))
  const received=shared.filter(matches)
  return <div className="whiteboards-page">
    <section className="whiteboards-intro"><Presentation size={28}/><div><h2>A shared space for your team</h2><p>Sketch ideas, type, add sticky notes and images, and move objects together in real time. Use <strong>Extend board</strong> in the editor or at the bottom of the canvas to keep adding room below.</p><p>Create a board, then use <strong>Share → Editor</strong> to invite teammates. Choose Viewer for people who should only watch. Everyone works on the same board.</p></div></section>
    <div className="whiteboards-setup">
      <form onSubmit={create}><label htmlFor="new-whiteboard-name">Create a whiteboard</label><div><input id="new-whiteboard-name" value={name} onChange={event=>setName(event.target.value)} maxLength={120} placeholder="Team brainstorm" required disabled={busy}/><button type="submit" disabled={busy||!name.trim()}><Plus size={16}/>{busy?'Creating…':'Create & open'}</button></div><small>2400 × 1600 starting area · Extend downward whenever you need more space</small></form>
      <form onSubmit={join}><label htmlFor="join-whiteboard-link">Join with a team link</label><div><input id="join-whiteboard-link" type="text" inputMode="url" value={link} onChange={event=>setLink(event.target.value)} placeholder="Paste a whiteboard sharing link"/><button type="submit" disabled={!link.trim()}><Link2 size={16}/>Join</button></div><small>Open a link while signed in to keep it in Shared with me.</small></form>
    </div>
    {error&&<p role="alert" className="whiteboards-error">{error}</p>}
    <label className="whiteboards-search"><Search size={17}/><input type="search" aria-label="Search whiteboards" placeholder="Search whiteboards or owners" value={query} onChange={event=>setQuery(event.target.value)}/></label>
    <section><h2>Your whiteboards</h2>{!owned.length&&<p className="whiteboards-empty">{query?'No matching whiteboards.':'Create your first board above. Manage, rename, or delete boards in Documents.'}</p>}<ul className="whiteboards-grid">{owned.map(file=><li key={file._id}><Presentation size={24}/><h3>{file.name}</h3><p>Updated {new Date(file.updatedAt||file.createdAt).toLocaleDateString()}</p><div><button type="button" onClick={event=>onOpen(file._id,event)}>Open board</button><button type="button" onClick={()=>setShare(file)}><Share2 size={15}/>Share</button></div></li>)}</ul></section>
    <section><div className="whiteboards-section-heading"><h2><Users size={18}/>Shared with you</h2><button type="button" aria-label="Refresh shared whiteboards" disabled={loading} onClick={()=>setVersion(value=>value+1)}><RefreshCw size={16}/></button></div>
      {loading&&<p role="status">Loading shared whiteboards…</p>}{sharedError&&<p role="alert" className="whiteboards-error">{sharedError}</p>}{!loading&&!sharedError&&!received.length&&<p className="whiteboards-empty">{query?'No matching shared whiteboards.':'Open a teammate’s sharing link to see their board here.'}</p>}
      <ul className="whiteboards-grid">{received.map(file=><li key={file._id}><Presentation size={24}/><h3>{file.name}</h3><p>Shared by {file.owner} · {file.role}</p><div>{file.openPath&&<a href={file.openPath}><ExternalLink size={15}/>Open board</a>}{file.canManageLinks&&<button type="button" onClick={()=>setShare(file)}><Share2 size={15}/>Share</button>}</div></li>)}</ul>
    </section>
    {share&&<div ref={sharePanel} tabIndex={-1} className="whiteboards-share" role="region" aria-label="Share whiteboard"><DocumentShareLink key={share._id} file={share} token={token} onClose={()=>setShare(null)}/></div>}
  </div>
}
