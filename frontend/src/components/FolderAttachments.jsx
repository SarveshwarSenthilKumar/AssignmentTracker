import {useRef,useState} from 'react'
import {Paperclip,Upload,Link2,FileText,X,Download,Loader2} from 'lucide-react'
import {readApiJson} from '../lib/apiResponse'
import {downloadBlob} from '../lib/documentFormats'
import {MediaPreview} from './TaskAttachments'
import './FolderAttachments.css'

export default function FolderAttachments({folder,base,token,documents=[],onDocumentsChange,onFoldersChange,onOpen,disabled=false}){
  const [busy,setBusy]=useState(false),[picker,setPicker]=useState(false),[query,setQuery]=useState(''),[preview,setPreview]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[drag,setDrag]=useState(false)
  const lock=useRef(false),input=useRef(null)
  const ids=folder.attachmentIds||[],attached=ids.map(id=>documents.find(file=>file._id===id&&!file.deletedAt)||{_id:id,name:'File unavailable',missing:true})
  const available=documents.filter(file=>!file.deletedAt&&!ids.includes(file._id)&&[file.name,file.originalName].join(' ').toLowerCase().includes(query.toLowerCase()))
  const request=async(method,body)=>{
    const response=await fetch(`${base}/${folder._id}/attachments`,{method,headers:{Authorization:`Bearer ${token}`,...(method==='PUT'?{'Content-Type':'application/json'}:{})},body:method==='PUT'?JSON.stringify(body):body})
    const data=await readApiJson(response)
    if(!response.ok||!data.folder?._id)throw new Error(data.message||'Could not save the attachment.')
    onFoldersChange(previous=>previous.map(item=>item._id===data.folder._id?data.folder:item))
    if(data.document)onDocumentsChange(previous=>[data.document,...previous.filter(file=>file._id!==data.document._id)])
    return data
  }
  const run=async action=>{if(lock.current||disabled)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await action()}catch(err){setError(err.message)}finally{lock.current=false;setBusy(false)}}
  const upload=files=>{const chosen=Array.from(files);if(!chosen.length)return;return run(async()=>{
    let count=0;const failures=[]
    for(const file of chosen){
      if(ids.length+count>=50){failures.push(`${file.name}: folder attachment limit reached`);continue}
      if(file.size>10*1024*1024){failures.push(`${file.name}: exceeds 10 MB`);continue}
      try{const body=new FormData();body.append('pdfFile',file);await request('POST',body);count++}catch(err){failures.push(`${file.name}: ${err.message}`)}
    }
    setNotice(`${count} file${count===1?'':'s'} attached. Files are also available in Documents.`)
    if(failures.length)setError(failures.join('; '))
  })}
  const link=(file,linked)=>run(async()=>{await request('PUT',{documentId:file._id,linked});setNotice(linked?'Document attached to this folder description.':'Attachment removed from the description. The file remains in Documents.');if(!linked&&preview===file._id)setPreview(null)})
  const download=file=>run(async()=>{const response=await fetch(`/api/pdfs/${file._id}/download`,{headers:{Authorization:`Bearer ${token}`}});if(!response.ok)throw new Error('Could not download this attachment.');await downloadBlob(await response.blob(),file.originalName||file.name)})
  return <section className={`folder-attachments${drag?' is-dragging':''}`} tabIndex={0} aria-label="Folder description attachments" aria-busy={busy} onDragOver={event=>{if(event.dataTransfer.types.includes('Files')){event.preventDefault();event.stopPropagation();if(!busy&&!disabled)setDrag(true)}}} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget))setDrag(false)}} onDrop={event=>{if(event.dataTransfer.files.length){event.preventDefault();event.stopPropagation();setDrag(false);upload(event.dataTransfer.files)}}} onPaste={event=>{if(event.clipboardData.files.length){event.preventDefault();event.stopPropagation();upload(event.clipboardData.files)}}}>
    <div className="folder-attachments-heading"><strong><Paperclip size={15}/>Files & media <span>{ids.length}/50</span></strong><small>Drop files or paste images here · up to 10 MB each</small></div><div className="folder-attachments-tools"><button type="button" disabled={busy||disabled||ids.length>=50} onClick={()=>input.current?.click()}>{busy?<Loader2 size={14} className="animate-spin"/>:<Upload size={14}/>}Upload files</button><button type="button" disabled={busy||disabled||ids.length>=50} aria-expanded={picker} onClick={()=>setPicker(!picker)}><Link2 size={14}/>Attach existing document</button><input ref={input} type="file" multiple hidden aria-label="Upload folder attachments" onChange={event=>{upload(event.target.files);event.target.value=''}}/></div>
    {picker&&<div className="folder-attachments-picker"><input aria-label="Search documents to attach" placeholder="Find a document…" value={query} onChange={event=>setQuery(event.target.value)}/><div>{available.slice(0,80).map(file=><button type="button" key={file._id} disabled={busy||disabled||ids.length>=50} onClick={()=>link(file,true)}><FileText size={14}/><span>{file.name}<small>{file.originalName}</small></span><Link2 size={13}/></button>)}</div><small>{available.length>80?'Showing 80 matches. Search to narrow the list.':!available.length?'No available documents match.':''}</small></div>}
    {error&&<p role="alert" className="folder-attachments-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <div className="folder-attachments-grid">{attached.map(file=><article key={file._id}><div className="folder-attachment-title"><FileText size={19}/><div><strong>{file.name}</strong><small>{file.originalName||'This file may be in Trash or removed.'}</small></div></div><div className="folder-attachment-actions">{!file.missing&&<><button type="button" disabled={busy||disabled} onClick={()=>onOpen(file._id)}>Open</button>{['image','audio','video'].includes(file.mimeType?.split('/')[0])&&<button type="button" onClick={()=>setPreview(preview===file._id?null:file._id)} aria-expanded={preview===file._id}>{preview===file._id?'Hide preview':'Preview'}</button>}<button type="button" disabled={busy||disabled} aria-label={`Download ${file.name}`} onClick={()=>download(file)}><Download size={14}/></button></>}<button type="button" disabled={busy||disabled} aria-label={`Remove attachment ${file.name}`} title="Remove attachment link; keep file in Documents" onClick={()=>link(file,false)}><X size={14}/></button></div>{preview===file._id&&!file.missing&&<MediaPreview file={file} token={token}/>}</article>)}</div>
    {!attached.length&&<p className="folder-attachments-empty">Add images, PDFs, recordings or reference files alongside this folder’s description.</p>}
  </section>
}
