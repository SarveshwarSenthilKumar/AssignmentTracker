import { useRef, useState } from 'react'
import { Upload, FileText, Download, ArrowUpRight, Loader2 } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'
import { downloadBlob } from '../lib/documentFormats'
import './ResumesPage.css'

export default function CoverLettersPage({token,documents,onDocumentsChange,onOpen}){
  const [files,setFiles]=useState([]),[progress,setProgress]=useState(''),[busy,setBusy]=useState(false),[downloading,setDownloading]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dragging,setDragging]=useState(false)
  const input=useRef(null),lock=useRef(false)
  const coverLetters=documents.filter(document=>!document.deletedAt&&document.tags?.includes('cover-letter')).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))
  const choose=selected=>{
    if(lock.current)return
    setNotice('')
    const accepted=[],errors=[]
    for(const file of Array.from(selected||[])){
      if(!/\.(pdf|docx)$/i.test(file.name)){errors.push(`${file.name}: choose PDF or Word (.docx).`);continue}
      if(!file.size||file.size>10*1024*1024){errors.push(`${file.name}: must be nonempty and no larger than 10 MB.`);continue}
      accepted.push({id:crypto.randomUUID(),file,name:file.name.replace(/\.[^.]+$/,'').slice(0,120),error:''})
    }
    setFiles(previous=>{
      const keys=new Set(previous.map(item=>`${item.file.name}:${item.file.size}:${item.file.lastModified}`))
      return [...previous,...accepted.filter(item=>{const key=`${item.file.name}:${item.file.size}:${item.file.lastModified}`;if(keys.has(key))return false;keys.add(key);return true})]
    })
    setError(errors.join(' '))
  }
  const upload=async event=>{
    event.preventDefault()
    if(lock.current||!files.length||files.some(item=>!item.name.trim()))return
    lock.current=true;setBusy(true);setError('');setNotice('')
    let saved=0,failed=0
    try{
      for(let index=0;index<files.length;index++){
        const item=files[index]
        setProgress(`Uploading ${index+1} of ${files.length}: ${item.file.name}`)
        try{
          const body=new FormData();body.append('pdfFile',item.file);body.append('name',item.name.trim());body.append('tags',JSON.stringify(['cover-letter']))
          const response=await fetch('/api/pdfs',{method:'POST',headers:{Authorization:`Bearer ${token}`},body})
          const result=await readApiJson(response)
          if(!response.ok||!result._id)throw new Error(result.message||'Could not save this cover letter.')
          onDocumentsChange(previous=>[result,...previous]);saved++
          setFiles(previous=>previous.filter(entry=>entry.id!==item.id))
        }catch(err){failed++;setFiles(previous=>previous.map(entry=>entry.id===item.id?{...entry,error:err.message}:entry))}
      }
      setNotice(`${saved} cover ${saved===1?'letter':'letters'} saved.${failed?` ${failed} failed; review the messages and retry the remaining files.`:''}`)
    }finally{lock.current=false;setBusy(false);setProgress('');if(input.current)input.current.value=''}
  }
  const download=async document=>{
    if(downloading)return
    setDownloading(document._id);setError('')
    try{
      const response=await fetch(`/api/pdfs/${document._id}/download`,{headers:{Authorization:`Bearer ${token}`}})
      if(!response.ok){const result=await readApiJson(response);throw new Error(result.message||'Could not download your cover letter.')}
      downloadBlob(await response.blob(),document.originalName||document.name)
    }catch(err){setError(err.message)}finally{setDownloading(null)}
  }
  return <section className="resumes-page" aria-label="Cover letter storage">
    <nav className="resume-job-navigation" aria-label="Career documents"><a href="#/resumes">Your resumes</a><a href="#/cover-letters" aria-current="page">Cover letters</a><a href="#/jobs">Saved jobs &amp; link import</a></nav>
    <div className="resume-heading"><div><h2>Your cover letters</h2><p>Keep versions ready to view, edit, or download.</p></div><span>{coverLetters.length} saved</span></div>
    <form onSubmit={upload} className="resume-upload-form">
      <input ref={input} id="cover-letter-upload-file" type="file" multiple accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={event=>{choose(event.target.files);event.target.value=''}} className="sr-only"/>
      <label htmlFor="cover-letter-upload-file" className={`resume-dropzone${dragging?' is-dragging':''}`} onDragOver={event=>{event.preventDefault();if(!busy)setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);if(!busy)choose(event.dataTransfer.files)}}>
        <Upload size={25}/><strong>{files.length?`${files.length} cover letters ready`:'Choose cover letters or drag them here'}</strong><span>PDF or Word (.docx) · Up to 10 MB each · Select multiple files</span>
      </label>
      {files.length>0&&<div className="cover-letter-upload-queue">{files.map(item=><div className="cover-letter-upload-item" key={item.id}><label>{item.file.name}<input aria-label={`Name for ${item.file.name}`} value={item.name} maxLength={120} disabled={busy} onChange={event=>setFiles(previous=>previous.map(entry=>entry.id===item.id?{...entry,name:event.target.value}:entry))} required/></label><button type="button" disabled={busy} onClick={()=>setFiles(previous=>previous.filter(entry=>entry.id!==item.id))} aria-label={`Remove ${item.file.name} from upload queue`}>Remove</button>{item.error&&<p role="alert" className="resume-error">{item.error}</p>}</div>)}</div>}
      <div className="resume-upload-details"><span role="status">{progress||`${files.length} selected`}</span><button type="submit" className="resume-primary" disabled={busy||!files.length||files.some(item=>!item.name.trim())}>{busy?<Loader2 size={16} className="animate-spin"/>:<Upload size={16}/>} {busy?'Uploading…':`Upload ${files.length||''} cover ${files.length===1?'letter':'letters'}`}</button></div>
    </form>
    {error&&<p className="resume-error" role="alert">{error}</p>}{notice&&<p className="resume-notice" role="status">{notice}</p>}
    <div className="resume-list">{coverLetters.map(document=><article className="resume-card" key={document._id}><div className="resume-file-icon"><FileText size={22}/></div><div className="resume-file-info"><h3>{document.name}</h3><p>{document.originalName} · {new Date(document.createdAt).toLocaleDateString()}</p></div><div className="resume-file-actions"><button type="button" onClick={()=>onOpen(document._id)} aria-label={`Open ${document.name}`}><ArrowUpRight size={16}/>Open</button><button type="button" disabled={!!downloading} onClick={()=>download(document)} aria-label={`Download ${document.name}`}>{downloading===document._id?<Loader2 size={16} className="animate-spin"/>:<Download size={16}/>}Download</button></div></article>)}</div>
    {!coverLetters.length&&<div className="resume-empty"><FileText size={30}/><h3>No cover letters saved yet</h3><p>Upload your first cover letter above. It will stay available here when you sign back in.</p></div>}
    <p className="resume-library-note">Cover letters are also available in Documents, where you can rename, organize, or remove them.</p>
  </section>
}
