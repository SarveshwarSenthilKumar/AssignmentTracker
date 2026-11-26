import {useEffect,useRef,useState} from 'react'
import {Share2} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import CopyTaskFolderLink from './CopyTaskFolderLink'
import './TaskFolderSharing.css'

export default function TaskFolderSharing({folder,token}){
  const [open,setOpen]=useState(false),[share,setShare]=useState(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const lock=useRef(false)
  const endpoint='/api/task-folder-shares/'+folder._id
  const request=async(method,signal)=>{
    const response=await fetch(endpoint,{method,signal,cache:'no-store',headers:{Authorization:'Bearer '+token}})
    if(response.status===204)return {active:false,path:null}
    const data=await readApiJson(response)
    if(!response.ok)throw new Error(data.message||'Could not manage folder sharing.')
    return data
  }
  useEffect(()=>{
    if(!open)return
    const controller=new AbortController()
    setShare(null);setError('')
    request('GET',controller.signal)
      .then(data=>{if(!controller.signal.aborted)setShare(data)})
      .catch(error=>{if(!controller.signal.aborted)setError(error.message)})
    return()=>controller.abort()
  },[open,endpoint,token])
  const change=async method=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('')
    try{setShare(await request(method))}
    catch(error){setError(error.message)}
    finally{lock.current=false;setBusy(false)}
  }
  const url=share?.path?new URL(share.path,window.location.href).href:''
  return <section className="task-folder-sharing" aria-label="Task folder sharing">
    <button type="button" aria-expanded={open} disabled={busy} onClick={()=>setOpen(value=>!value)}><Share2 size={16} aria-hidden="true"/>Share task folder</button>
    {open&&<div className="task-folder-sharing-panel">
      <h3>Share {folder.name}</h3>
      <p>Anyone with the link can view and forward the task titles, statuses, and due dates in this folder. Revoke the link to close access for everyone.</p>
      {!share&&!error&&<p role="status">Loading link settings…</p>}
      {url&&<CopyTaskFolderLink key={url} url={url}/>}
      {share?.active&&!url&&<p>Revoke this link and create a new one to get a copyable address.</p>}
      {share&&<button type="button" disabled={busy} onClick={()=>change(share.active?'DELETE':'POST')}>
        {busy?'Saving…':share.active?'Revoke link':'Create link'}
      </button>}
      {error&&<p role="alert">{error}</p>}
    </div>}
  </section>
}
