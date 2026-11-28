import DocumentShareMessage from './DocumentShareMessage'
import {useEffect,useState} from 'react'
import {RefreshCw,ExternalLink,Link2,Search} from 'lucide-react'
import SharedFolders from './SharedFolders'
import DocumentFileIcon from './DocumentFileIcon'
import DocumentShareLink from './DocumentShareLink'
import FriendDocumentDownload from './FriendDocumentDownload'
import './SharedWithMe.css'

export default function SharedWithMe({token}) {
  const [files,setFiles]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[link,setLink]=useState(''),[saving,setSaving]=useState(false),[share,setShare]=useState(null),[version,setVersion]=useState(0)
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setFiles([])
    fetch('/api/shared-with-me/documents',{signal:controller.signal,cache:'no-store',headers:{Authorization:`Bearer ${token}`}}).then(async response=>{
      const data=await response.json();if(!response.ok)throw new Error(data.message||'Could not load shared documents.');if(!controller.signal.aborted)setFiles(data)
    }).catch(error=>{if(!controller.signal.aborted)setError(error.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,version])
  const saveLink=async event=>{
    event.preventDefault();if(saving)return
    setSaving(true);setError('')
    try{
      const url=new URL(link.trim(),window.location.origin)
      const value=/^(?:#\/shared-document\/|\/api\/shared-document\/)([A-Za-z0-9_-]{43})$/.exec(url.hash||url.pathname)?.[1]
      if(!value)throw new Error('Paste a valid document sharing link.')
      const response=await fetch('/api/shared-with-me/documents',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({token:value})})
      const data=await response.json();if(!response.ok)throw new Error(data.message||'Could not add this document.')
      setLink('');setVersion(value=>value+1)
    }catch(error){setError(error.message)}finally{setSaving(false)}
  }
  const visible=files.filter(file=>`${file.name} ${file.originalName} ${file.owner} ${file.role}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <section className="shared-with-me" aria-label="Shared with me">
    <header><div><h2>Shared with me</h2><a href="#/document-activity">Activity inbox</a><p>Documents shared by friends, shared folders, and links you’ve opened while signed in. Your most recent 200 document links are remembered.</p></div><button type="button" onClick={()=>setVersion(value=>value+1)} disabled={loading} aria-label="Refresh shared documents"><RefreshCw size={16}/></button></header>
    <form onSubmit={saveLink} className="shared-link-form"><label>Add a document sharing link<input type="text" inputMode="url" value={link} onChange={event=>setLink(event.target.value)} placeholder="Paste a sharing link…" disabled={saving}/></label><button type="submit" disabled={saving||!link.trim()}><Link2 size={16}/>{saving?'Adding…':'Add link'}</button></form>
    {error&&<p role="alert" className="library-error">{error}</p>}
    <section><h3>Shared documents</h3><label className="shared-document-search"><Search size={16}/><input type="search" aria-label="Search shared documents" placeholder="Search names, owners, or roles…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
      {loading&&<p role="status">Loading shared documents…</p>}
      {!loading&&!error&&!visible.length&&<p>{query?'No matching documents.':'No shared documents yet. Files shared by friends appear here. You can also add a sharing link above.'}</p>}
      <ul className="shared-document-list">{visible.map(file=><li key={file._id}>
        <DocumentFileIcon file={file} size={24}/><div><strong>{file.name}</strong><small>Shared by {file.owner} · {file.role}</small><DocumentShareMessage message={file.friendMessage} label="Private message"/><DocumentShareMessage message={file.shareMessage} label="Link message"/></div>
        <div className="shared-document-actions"><a href={'#/document-discussion/'+file._id}>Comments</a>{file.friendShare&&<FriendDocumentDownload file={file} token={token}/>} {file.openPath&&<a href={file.openPath} target="_blank" rel="noopener noreferrer"><ExternalLink size={15}/>{file.openPath.startsWith('#')?'Open document':'View / download'}</a>}{file.canManageLinks&&<button type="button" onClick={()=>setShare(file)}>Manage links</button>}</div>
      </li>)}</ul>
    </section>
    <SharedFolders token={token} receivedOnly refreshKey={version}/>
    {share&&<DocumentShareLink file={share} token={token} onClose={()=>{setShare(null);setVersion(value=>value+1)}}/>}
  </section>
}
