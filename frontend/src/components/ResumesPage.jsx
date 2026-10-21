import { useRef, useState } from 'react'
import { Upload, FileText, Download, ArrowUpRight, Loader2 } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'
import { downloadBlob } from '../lib/documentFormats'
import './ResumesPage.css'

export default function ResumesPage({token,documents,onDocumentsChange,onOpen}){
  const [file,setFile]=useState(null),[name,setName]=useState(''),[busy,setBusy]=useState(false),[downloading,setDownloading]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dragging,setDragging]=useState(false)
  const input=useRef(null),lock=useRef(false)
  const resumes=documents.filter(document=>!document.deletedAt&&document.tags?.includes('resume')).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
  const choose=selected=>{
    setError('');setNotice('')
    if(!selected)return
    if(!/\.(pdf|docx)$/i.test(selected.name)){setError('Choose a PDF or Word (.docx) resume.');return}
    if(!selected.size||selected.size>10*1024*1024){setError('Choose a nonempty resume no larger than 10 MB.');return}
    setFile(selected);setName(selected.name.replace(/\.[^.]+$/,''))
  }
  const upload=async event=>{
    event.preventDefault()
    if(lock.current||!file||!name.trim())return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{
      const body=new FormData();body.append('pdfFile',file);body.append('name',name.trim());body.append('tags',JSON.stringify(['resume']))
      const response=await fetch('/api/pdfs',{method:'POST',headers:{Authorization:`Bearer ${token}`},body})
      const result=await readApiJson(response)
      if(!response.ok||!result._id)throw new Error(result.message||'Could not save your resume.')
      onDocumentsChange(previous=>[result,...previous]);setFile(null);setName('');if(input.current)input.current.value=''
      setNotice('Resume saved to your account.')
    }catch(err){setError(err.message)}finally{lock.current=false;setBusy(false)}
  }
  const download=async document=>{
    if(downloading)return
    setDownloading(document._id);setError('')
    try{
      const response=await fetch(`/api/pdfs/${document._id}/download`,{headers:{Authorization:`Bearer ${token}`}})
      if(!response.ok){const result=await readApiJson(response);throw new Error(result.message||'Could not download your resume.')}
      downloadBlob(await response.blob(),document.originalName||document.name)
    }catch(err){setError(err.message)}finally{setDownloading(null)}
  }
  return <section className="resumes-page" aria-label="Resume storage">
    <div className="resume-heading"><div><h2>Your resumes</h2><p>Keep versions ready to view, edit, or download.</p></div><span>{resumes.length} saved</span></div>
    <form onSubmit={upload} className="resume-upload-form">
      <input ref={input} id="resume-upload-file" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={event=>{choose(event.target.files[0]);event.target.value=''}} className="sr-only"/>
      <label htmlFor="resume-upload-file" className={`resume-dropzone${dragging?' is-dragging':''}`} onDragOver={event=>{event.preventDefault();if(!busy)setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);if(!busy)choose(event.dataTransfer.files[0])}}>
        <Upload size={25}/><strong>{file?file.name:'Choose a resume or drag it here'}</strong><span>PDF or Word (.docx) · Up to 10 MB</span>
      </label>
      <div className="resume-upload-details"><label htmlFor="resume-name">Resume name<input id="resume-name" value={name} maxLength={120} disabled={busy} onChange={event=>setName(event.target.value)} placeholder="e.g. Software engineering resume" required/></label><button type="submit" className="resume-primary" disabled={busy||!file||!name.trim()}>{busy?<Loader2 size={16} className="animate-spin"/>:<Upload size={16}/>} {busy?'Saving…':'Upload resume'}</button></div>
    </form>
    {error&&<p className="resume-error" role="alert">{error}</p>}{notice&&<p className="resume-notice" role="status">{notice}</p>}
    <div className="resume-list">{resumes.map(document=><article className="resume-card" key={document._id}><div className="resume-file-icon"><FileText size={22}/></div><div className="resume-file-info"><h3>{document.name}</h3><p>{document.originalName} · {new Date(document.createdAt).toLocaleDateString()}</p></div><div className="resume-file-actions"><button type="button" onClick={()=>onOpen(document._id)} aria-label={`Open ${document.name}`}><ArrowUpRight size={16}/>Open</button><button type="button" disabled={!!downloading} onClick={()=>download(document)} aria-label={`Download ${document.name}`}>{downloading===document._id?<Loader2 size={16} className="animate-spin"/>:<Download size={16}/>}Download</button></div></article>)}</div>
    {!resumes.length&&<div className="resume-empty"><FileText size={30}/><h3>No resumes saved yet</h3><p>Upload your first resume above. It will stay available here when you sign back in.</p></div>}
    <p className="resume-library-note">Resumes are also available in Documents, where you can rename, organize, or remove them.</p>
  </section>
}
