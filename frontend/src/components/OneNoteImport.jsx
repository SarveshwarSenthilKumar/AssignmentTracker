import { useEffect, useMemo, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { FileText, X, Upload } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'
import { splitMarkdownExport } from '../lib/markdownPdfExport'
import './MarkdownPDFCreator.css'
import './OneNoteImport.css'

function safePage(html){
  const clean=DOMPurify.sanitize(html,{USE_PROFILES:{html:true,svg:true},FORBID_TAGS:['style','foreignObject','audio','video','iframe','form','input'],FORBID_ATTR:['style','srcset']})
  const root=document.createElement('div');root.innerHTML=clean
  root.querySelectorAll('svg').forEach(svg=>{
    svg.querySelectorAll('image,use,animate,animateTransform,set,script,foreignObject,a').forEach(node=>node.remove())
    svg.querySelectorAll('*').forEach(node=>{for(const attr of [...node.attributes])if(/href/i.test(attr.name)||/url\s*\(/i.test(attr.value))node.removeAttribute(attr.name)})
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg')
    const image=document.createElement('img');image.alt='Imported handwriting';image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));svg.replaceWith(image)
  })
  root.querySelectorAll('img').forEach(img=>{if(!/^data:image\/(png|jpeg|gif|webp|svg\+xml)[;,]/i.test(img.getAttribute('src')||''))img.remove()})
  root.querySelectorAll('a').forEach(link=>{link.removeAttribute('href');link.removeAttribute('target')})
  return root.innerHTML
}

export default function OneNoteImport({token,folderId,onClose,onCreated,initialFile=null,initialTags=[]}){
  const [file,setFile]=useState(initialFile),[title,setTitle]=useState(initialFile?.name.replace(/\.(one|onepkg)$/i,'')||'Imported notebook'),[data,setData]=useState(null),[selected,setSelected]=useState(new Set()),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const lock=useRef(false),paper=useRef(null),autoStarted=useRef(false)
  const pages=useMemo(()=>data?.pages.map(page=>({...page,html:safePage(page.html)}))||[],[data])
  const run=async callback=>{if(lock.current)return;lock.current=true;setError('');try{await callback()}catch(err){setError(err.message||'Could not import this notebook.')}finally{lock.current=false;setBusy('')}}
  const extract=()=>run(async()=>{
    if(!file||!/\.(one|onepkg)$/i.test(file.name))throw new Error('Choose a .one section or .onepkg notebook package.')
    if(file.size>10*1024*1024)throw new Error('Choose a notebook package no larger than 10 MB.')
    setBusy('Reading notebook…');setData(null)
    const body=new FormData();body.append('pdfFile',file)
    const response=await fetch('/api/documents/import-onenote',{method:'POST',headers:{Authorization:`Bearer ${token}`},body})
    const result=await readApiJson(response)
    if(!response.ok)throw new Error(result.message||'Could not read this notebook.')
    if(!Array.isArray(result.pages)||!result.pages.length)throw new Error('No readable pages were found.')
    setData(result);setSelected(new Set(result.pages.map((_,index)=>index)))
  })
  useEffect(()=>{if(initialFile&&!autoStarted.current){autoStarted.current=true;extract()}},[initialFile])
  const save=()=>run(async()=>{
    if(!selected.size||!title.trim())return
    setBusy('Preparing notes…');await document.fonts.ready
    await Promise.all([...paper.current.querySelectorAll('img')].map(img=>img.decode().catch(()=>{throw new Error('An imported image could not be rendered. Deselect that page or export it as PDF from OneNote.')})))
    const {default:html2pdf}=await import('html2pdf.js'),{PDFDocument}=await import('pdf-lib')
    const pdf=await PDFDocument.create(),sections=splitMarkdownExport(paper.current)
    try{
      for(let index=0;index<sections.chunks.length;index++){
        setBusy(`Creating notes ${index+1} / ${sections.chunks.length}…`)
        const worker=html2pdf().set({margin:[15,15,15,15],image:{type:'jpeg',quality:.92},html2canvas:{scale:1.5,backgroundColor:'#ffffff',logging:false,useCORS:false},jsPDF:{unit:'mm',format:'a4',compress:true},enableLinks:false,pagebreak:{mode:['css','legacy'],avoid:['tr','img','h1','h2']}}).from(sections.chunks[index]).toPdf()
        const converted=await worker.get('pdf'),part=await PDFDocument.load(converted.output('arraybuffer'))
        for(const page of await pdf.copyPages(part,part.getPageIndices()))pdf.addPage(page)
        const canvas=await worker.get('canvas');if(canvas){canvas.width=0;canvas.height=0}
      }
    }finally{sections.dispose()}
    pdf.setTitle(title.trim());pdf.setCreator('Assignment Tracker — OneNote import')
    const blob=new Blob([await pdf.save()],{type:'application/pdf'})
    if(blob.size>10*1024*1024)throw new Error('The resulting notes exceed 10 MB. Select fewer pages and import the rest separately.')
    const body=new FormData(),filename=(title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').trim()||'Imported notebook')+'.pdf'
    body.append('pdfFile',new File([blob],filename,{type:'application/pdf'}));body.append('name',title.trim());body.append('tags',JSON.stringify([...new Set(['notes','onenote-import',...initialTags])]));if(folderId)body.append('pdfFolderId',folderId)
    setBusy('Saving notes…')
    const response=await fetch('/api/pdfs',{method:'POST',headers:{Authorization:`Bearer ${token}`},body}),result=await readApiJson(response)
    if(!response.ok||!result._id)throw new Error(result.message||'Could not save the notes document.')
    onCreated(result)
  })
  return <section className="markdown-pdf-creator onenote-import" onKeyDown={event=>event.stopPropagation()} aria-label="Import OneNote notebook">
    <header><div><FileText size={19}/><h3>Import OneNote</h3></div><button disabled={!!busy} onClick={onClose} aria-label="Close OneNote import"><X size={17}/></button></header>
    <p>Import a .one section or .onepkg notebook as a notes PDF, then annotate it in the editor. Text and handwriting become rendered page content. Keep your original file for editing in OneNote.</p>
    <div className="markdown-pdf-options"><label>OneNote file<input type="file" accept=".one,.onepkg" disabled={!!busy} onChange={event=>{const next=event.target.files[0];setFile(next||null);setData(null);setError('');if(next)setTitle(next.name.replace(/\.(one|onepkg)$/i,''))}}/></label><label>Document name<input value={title} maxLength={120} disabled={!!busy} onChange={event=>setTitle(event.target.value)}/></label><button disabled={!file||!!busy} onClick={extract}><Upload size={16}/>Read notebook</button></div>
    {data&&<>
      <ul className="onenote-warnings">{data.warnings?.map((warning,index)=><li key={index}>{warning}</li>)}</ul>
      <div className="onenote-selection"><strong>{selected.size} of {pages.length} pages selected</strong><button disabled={!!busy} onClick={()=>setSelected(new Set(pages.map((_,index)=>index)))}>Select all</button><button disabled={!!busy} onClick={()=>setSelected(new Set())}>Clear selection</button><div>{pages.map((page,index)=><label key={index}><input type="checkbox" checked={selected.has(index)} disabled={!!busy} onChange={()=>setSelected(previous=>{const next=new Set(previous);next.has(index)?next.delete(index):next.add(index);return next})}/><span>{page.title}<small>{page.section}</small></span></label>)}</div></div>
      <div className="markdown-pdf-preview"><div className="markdown-pdf-preview-label">Selected pages · A4 preview</div><article ref={paper} className="markdown-pdf-paper onenote-paper"><div className="assistant-markdown">{pages.map((page,index)=>selected.has(index)&&<section key={index} className="onenote-page"><p className="onenote-section">{page.section}</p><h1>{page.title}</h1><div dangerouslySetInnerHTML={{__html:page.html}}/></section>)}</div></article></div>
    </>}
    {error&&<p role="alert" className="markdown-pdf-error">{error}</p>}
    <footer><p role="status">{busy||'Up to 10 MB per package and 200 source pages. Larger notebooks can be imported in parts.'}</p><button className="library-primary" disabled={!!busy||!data||!selected.size||!title.trim()} onClick={save}>Save & open notes</button></footer>
  </section>
}
