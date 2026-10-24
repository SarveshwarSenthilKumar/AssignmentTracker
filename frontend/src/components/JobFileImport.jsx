import {useRef,useState} from 'react'
import {FileText,Upload} from 'lucide-react'

export default function JobFileImport({busy,onImport}){
  const [file,setFile]=useState(null),[error,setError]=useState(''),[dragging,setDragging]=useState(false)
  const input=useRef(null)
  const choose=selected=>{
    if(busy||!selected)return
    setError('')
    if(!/\.(pdf|png|jpe?g|webp)$/i.test(selected.name)){setError('Choose PDF, PNG, JPEG or WebP.');return}
    if(!selected.size||selected.size>10*1024*1024){setError('Choose a nonempty file up to 10 MB.');return}
    setFile(selected)
  }
  return <details className="jobs-file-import"><summary>Import from a screenshot, image or PDF</summary>
    <p>Upload a screenshot or saved PDF of one job posting, including Handshake pages you can view. This sends the file to your configured Gemini AI for extraction; requires an AI key and AI recognition permission. Review all results before saving. The source file is not added to your document library.</p>
    <input ref={input} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={!!busy} className="sr-only" aria-label="Choose a job image or PDF" onChange={event=>{choose(event.currentTarget.files[0]);event.currentTarget.value=''}}/>
    <button className={`jobs-file-drop${dragging?' is-dragging':''}`} type="button" disabled={!!busy} onClick={()=>input.current?.click()} onDragOver={event=>{event.preventDefault();if(!busy)setDragging(true)}} onDragLeave={()=>setDragging(false)} onDrop={event=>{event.preventDefault();setDragging(false);if(event.dataTransfer.files.length!==1){setError('Choose one job image or PDF at a time.');return}choose(event.dataTransfer.files[0])}}><FileText size={22}/><span>{file?file.name:'Choose a file or drop it here'}</span><small>Up to 10 MB · PDF: up to 12 pages · One job per file</small></button>
    {error&&<p role="alert" className="jobs-error">{error}</p>}
    <div className="jobs-actions"><button type="button" disabled={!!busy||!file} onClick={()=>onImport(file)}><Upload size={15}/>{busy==='file'?'Reading job file…':'Extract job from file'}</button>{file&&<button type="button" disabled={!!busy} onClick={()=>{setFile(null);setError('')}}>Clear file</button>}</div>
  </details>
}
