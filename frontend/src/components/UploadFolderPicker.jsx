import {useEffect,useId,useRef,useState} from 'react'
import {FolderPlus,Loader2,X} from 'lucide-react'
import {folderTree} from '../lib/folderHierarchy'
import {readApiJson} from '../lib/apiResponse'
import './UploadFolderPicker.css'

export default function UploadFolderPicker({folders=[],value,onChange,token,onCreated,onPendingChange,disabled=false}){
  const id=useId(),lock=useRef(false),input=useRef(null)
  const [open,setOpen]=useState(false),[name,setName]=useState(''),[parent,setParent]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  useEffect(()=>()=>onPendingChange?.(false),[onPendingChange])
  const toggle=next=>{if(busy)return;setOpen(next);onPendingChange?.(next);setError('');if(next){setName('');setParent(value||'');setNotice('');requestAnimationFrame(()=>input.current?.focus())}}
  const create=async()=>{
    if(lock.current||disabled)return
    if(!name.trim()){setError('Enter a folder name.');input.current?.focus();return}
    lock.current=true;setBusy(true);setError('')
    try{
      const response=await fetch('/api/pdf-folders',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({name:name.trim(),parentId:parent||null,color:'#6d879e'})})
      const folder=await readApiJson(response)
      if(!response.ok||!folder._id)throw new Error(folder.message||'Could not create the folder.')
      onCreated(folder);onChange(folder._id);setOpen(false);onPendingChange?.(false);setNotice(`“${folder.name}” created and selected for this upload.`)
    }catch(err){setError(err.message||'Could not create the folder.')}
    finally{lock.current=false;setBusy(false)}
  }
  return <div className="upload-folder-picker"><label htmlFor={`${id}-destination`}>Save in folder</label><div className="upload-folder-row"><select id={`${id}-destination`} value={value||''} disabled={disabled||busy||open} onChange={event=>{onChange(event.target.value);setNotice('')}}><option value="">Unfiled</option>{folderTree(folders).map(folder=><option key={folder._id} value={folder._id}>{folder.path}</option>)}</select><button type="button" disabled={disabled||busy} aria-expanded={open} aria-controls={`${id}-create`} onClick={()=>toggle(!open)}><FolderPlus size={16}/>New folder</button></div>
    {open&&<div id={`${id}-create`} className="upload-folder-create"><div className="upload-folder-heading"><strong>Create a destination folder</strong><button type="button" disabled={busy||disabled} aria-label="Cancel new folder" onClick={()=>toggle(false)}><X size={15}/></button></div><label htmlFor={`${id}-name`}>Folder name</label><input ref={input} id={`${id}-name`} value={name} maxLength={120} disabled={busy||disabled} placeholder="e.g. Biology notes" onChange={event=>setName(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();create()}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();toggle(false)}}}/><label htmlFor={`${id}-parent`}>Parent folder</label><select id={`${id}-parent`} value={parent} disabled={busy||disabled} onChange={event=>setParent(event.target.value)}><option value="">Top level</option>{folderTree(folders).map(folder=><option key={folder._id} value={folder._id}>{folder.path}</option>)}</select><p>The new folder will be selected automatically. Creating it keeps your chosen file and upload details.</p>{error&&<p className="upload-folder-error" role="alert">{error}</p>}<div className="upload-folder-actions"><button type="button" disabled={busy||disabled} onClick={()=>toggle(false)}>Cancel</button><button type="button" className="upload-folder-primary" disabled={busy||disabled||!name.trim()} onClick={create}>{busy?<Loader2 size={15} className="animate-spin"/>:<FolderPlus size={15}/>} {busy?'Creating…':'Create & select folder'}</button></div></div>}
    {notice&&<p role="status" className="upload-folder-notice">{notice}</p>}
  </div>
}
