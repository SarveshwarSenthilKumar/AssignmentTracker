import { useRef, useState } from 'react'
import { Paperclip, Upload, Link2, X } from 'lucide-react'
import { MediaPreview } from './TaskAttachments'
import './TaskAttachments.css'

export default function CalendarAttachments({entry,tasks,documents,folders,token,onChange,onDocumentsChange,onOpenTask,onOpenDocument,disabled=false,onBusyChange}) {
  const [picker,setPicker]=useState(''),[query,setQuery]=useState(''),[folder,setFolder]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[preview,setPreview]=useState(null)
  const input=useRef(null),lock=useRef(false)
  const taskIds=entry.taskIds||[],documentIds=entry.documentIds||[],blocked=disabled||busy
  const change=(key,id,linked)=>onChange(key,linked?'add':'remove',id)
  const upload=async files=>{
    if(blocked||lock.current)return
    lock.current=true;setBusy(true);onBusyChange?.(true);setError('');setNotice('')
    let count=0;const failures=[]
    try {
      for(const file of Array.from(files)) {
        if(documentIds.length+count>=100){failures.push('An entry can have up to 100 documents.');break}
        if(file.size>10*1024*1024){failures.push(`${file.name}: exceeds 10 MB`);continue}
        try {
          const body=new FormData();body.append('pdfFile',file);body.append('name',file.name);if(folder)body.append('pdfFolderId',folder)
          const response=await fetch('/api/pdfs',{method:'POST',headers:{Authorization:`Bearer ${token}`},body})
          const data=await response.json();if(!response.ok)throw new Error(data.message||'Upload failed.')
          onDocumentsChange(previous=>[data,...previous]);change('documentIds',data._id,true);count++
        } catch(error){failures.push(`${file.name}: ${error.message}`)}
      }
      setNotice(`${count} ${count===1?'file':'files'} stored in Documents. Save the entry to keep these links.`)
      if(failures.length)setError(failures.join('; '))
    } finally {lock.current=false;setBusy(false);onBusyChange?.(false)}
  }
  const editable=!!onChange
  const available=(picker==='tasks'?tasks:documents.filter(file=>!file.deletedAt)).filter(item=>!(picker==='tasks'?taskIds:documentIds).includes(item._id)&&`${item.text||item.name} ${item.originalName||''}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="task-attachments" aria-label="Calendar tasks, files and media" aria-busy={busy} onDragOver={event=>{if(editable&&event.dataTransfer.types.includes('Files'))event.preventDefault()}} onDrop={event=>{if(editable&&event.dataTransfer.files.length){event.preventDefault();event.stopPropagation();upload(event.dataTransfer.files)}}}>
    <header><div><strong><Paperclip size={15}/>Tasks, files & media <span>{taskIds.length+documentIds.length}</span></strong><small>{editable?'Links save with this entry. Uploads stay in Documents even if you cancel.':'Linked to this calendar entry · originals remain in Tasks and Documents'}</small></div></header>
    {editable&&<><div className="task-attachment-toolbar"><button type="button" disabled={blocked} onClick={()=>{setPicker(picker==='tasks'?'':'tasks');setQuery('')}}><Link2 size={14}/>Link tasks</button><button type="button" disabled={blocked} onClick={()=>{setPicker(picker==='documents'?'':'documents');setQuery('')}}><Link2 size={14}/>Link documents</button><button type="button" disabled={blocked} onClick={()=>input.current?.click()}><Upload size={14}/>{busy?'Uploading…':'Upload files'}</button><select aria-label="Calendar upload destination" value={folder} disabled={blocked} onChange={event=>setFolder(event.target.value)}><option value="">Store in Unfiled</option>{folders.map(folder=><option key={folder._id} value={folder._id}>{folder.name}</option>)}</select><input ref={input} type="file" multiple hidden aria-label="Upload calendar files and media" onChange={event=>{upload(event.target.files);event.target.value=''}}/></div><small>Drop files here · images, audio, video, and documents · up to 10 MB each</small>
    {picker&&<div className="task-attachment-picker"><input aria-label={`Search ${picker} to attach`} placeholder={`Search ${picker}…`} value={query} disabled={blocked} onChange={event=>setQuery(event.target.value)}/><div>{available.map(item=><button type="button" key={item._id} disabled={blocked||(picker==='tasks'?taskIds:documentIds).length>=100} onClick={()=>change(picker==='tasks'?'taskIds':'documentIds',item._id,true)}><span>{item.text||item.name}<small>{picker==='tasks'?item.status:item.originalName}</small></span><Link2 size={14}/></button>)}{!available.length&&<small>No matching items available to link.</small>}</div></div>}</>}
    {error&&<p role="alert" className="task-attachment-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className="task-attachment-grid">{taskIds.map(id=>{const task=tasks.find(task=>task._id===id);return <article key={`task:${id}`}><strong>{task?.text||'Task unavailable'}</strong><small>{task?`Task · ${task.status}`:'This task may have been deleted.'}</small><div className="task-attachment-actions">{task&&!editable&&<button type="button" disabled={blocked} onClick={()=>onOpenTask(task)}>Open task</button>}{editable&&<button type="button" disabled={blocked} onClick={()=>change('taskIds',id,false)}><X size={13}/>Unlink task</button>}</div></article>})}
    {documentIds.map(id=>{const file=documents.find(file=>file._id===id&&!file.deletedAt);return <article key={`file:${id}`}><strong>{file?.name||'Document unavailable'}</strong><small>{file?.mimeType||'This document may be in Trash or deleted.'}</small><div className="task-attachment-actions">{file&&<><button type="button" disabled={blocked} onClick={()=>onOpenDocument(id)}>Open</button>{['image','audio','video'].includes(file.mimeType?.split('/')[0])&&<button type="button" onClick={()=>setPreview(preview===id?null:id)}>{preview===id?'Hide preview':'Preview'}</button>}</>}{editable&&<button type="button" disabled={blocked} onClick={()=>change('documentIds',id,false)}><X size={13}/>Unlink file</button>}</div>{file&&preview===id&&<MediaPreview file={file} token={token}/>}</article>})}</div>
    {!taskIds.length&&!documentIds.length&&<small>No tasks or files attached.</small>}
  </section>
}
