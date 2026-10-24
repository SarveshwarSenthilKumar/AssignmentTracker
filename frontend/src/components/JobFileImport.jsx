import {useEffect,useRef,useState} from 'react'
import {FileText,Upload} from 'lucide-react'

export default function JobFileImport({busy,onImport,progress,onCancel}){
  const [file,setFile]=useState(null),[error,setError]=useState(''),[dragging,setDragging]=useState(false)
  const input=useRef(null)
  const [mode,setMode]=useState(()=>{try{return localStorage.getItem('jobs-file-extraction-mode')==='ai'?'ai':'local'}catch{return 'local'}})
  useEffect(()=>{try{localStorage.setItem('jobs-file-extraction-mode',mode)}catch{}},[mode])
  const choose=selected=>{
    if(busy||!selected)return
    setError('')
    if(!/\.(pdf|png|jpe?g|webp)$/i.test(selected.name)){setError('Choose PDF, PNG, JPEG or WebP.');return}
    if(!selected.size||selected.size>10*1024*1024){setError('Choose a nonempty file up to 10 MB.');return}
    setFile(selected)
  }
  return <details className="jobs-file-import"><summary>Import from a screenshot, image or PDF</summary>
    <fieldset className="jobs-import-mode" disabled={!!busy}><legend>Extraction method</legend><label><input type="radio" name="job-extraction-mode" checked={mode==='local'} onChange={()=>setMode('local')}/>Local OCR · no AI tokens</label><label><input type="radio" name="job-extraction-mode" checked={mode==='ai'} onChange={()=>setMode('ai')}/>AI · Gemini</label></fieldset>
    <p>{mode==='local'?'PDF text, image OCR and field extraction run locally in your browser. No file or recognized text is sent to the server until you save. No AI key or tokens are used. First-time OCR downloads its engine and English data.':'The selected file is sent to your configured Gemini AI to extract job fields. This uses your API quota and requires a Gemini key plus AI recognition permission in Account. It does not run local OCR first.'} Both modes produce an editable draft for review before saving. Switching modes never starts an import automatically.</p>
    <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={!!busy} className="sr-only" aria-label="Choose a job image or PDF" onChange={event=>{choose(event.currentTarget.files[0]);event.currentTarget.value=''}}/>
    <button className={`jobs-file-drop${dragging?' is-dragging':''}`} type="button" disabled={!!busy} onClick={()=>input.current?.click()} onDragOver={event=>{event.preventDefault();if(!busy)setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);if(event.dataTransfer.files.length!==1){setError('Choose one job image or PDF at a time.');return}choose(event.dataTransfer.files[0])}}><FileText size={22}/><span>{file?file.name:'Choose a file or drop it here'}</span><small>Up to 10 MB · PDF: up to 12 pages · One job per file</small></button>
    {progress&&<div className="jobs-local-progress" role="status"><span>{progress.message}</span>{progress.progress!==undefined&&<progress max="100" value={progress.progress} aria-label="Current OCR stage progress"/>}</div>}
    {error&&<p role="alert" className="jobs-error">{error}</p>}
    <div className="jobs-actions"><button type="button" disabled={!!busy||!file} onClick={()=>onImport(file,mode)}><Upload size={15}/>{busy==='file'?mode==='ai'?'Analyzing with AI…':'Reading locally…':mode==='ai'?'Extract with AI':'Extract locally · no AI'}</button>{busy==='file'&&<button type="button" onClick={onCancel}>Cancel import</button>}{file&&<button type="button" disabled={!!busy} onClick={()=>{setFile(null);setError('')}}>Clear file</button>}</div>
  </details>
}
