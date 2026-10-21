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
    const box=(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number)
    if(box.length===4&&box[2]>0&&box[3]>0){svg.setAttribute('width',String(Math.min(box[2],1200)));svg.setAttribute('height',String(Math.min(box[2],1200)*box[3]/box[2]))}
    const image=document.createElement('img');image.alt='Imported handwriting';image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));svg.replaceWith(image)
  })
  root.querySelectorAll('img').forEach(img=>{if(!/^data:image\/(png|jpeg|gif|webp|svg\+xml)[;,]/i.test(img.getAttribute('src')||''))img.remove()})
  root.querySelectorAll('a').forEach(link=>{link.removeAttribute('href');link.removeAttribute('target')})
  return root.innerHTML
}

function NativePagePreview({page}){
  const [url,setUrl]=useState('')
  useEffect(()=>{
    const bytes=Uint8Array.from(atob(page.pdfData),character=>character.charCodeAt(0))
    const next=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));setUrl(next)
    return()=>URL.revokeObjectURL(next)
  },[page.pdfData])
  return url?<iframe className="onenote-native-preview" title={`OneNote page: ${page.title}`} src={url}/>:<p>Preparing preview…</p>
}

export default function OneNoteImport({token,folderId,onClose,onCreated,initialFile=null,initialTags=[]}){
  const [file,setFile]=useState(initialFile),[title,setTitle]=useState(initialFile?.name.replace(/\.(one|onepkg)$/i,'')||'Imported notebook'),[data,setData]=useState(null),[selected,setSelected]=useState(new Set()),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const lock=useRef(false),paper=useRef(null),autoStarted=useRef(false)
  const [compatibility,setCompatibility]=useState(false),[previewIndex,setPreviewIndex]=useState(0)
  const pages=useMemo(()=>data?.pages.map(page=>({...page,html:safePage(page.html)}))||[],[data])
  const run=async callback=>{if(lock.current)return;lock.current=true;setError('');try{await callback()}catch(err){setError(err.message||'Could not import this notebook.')}finally{lock.current=false;setBusy('')}}
  const extract=()=>run(async()=>{
    if(!file||!/\.(one|onepkg)$/i.test(file.name))throw new Error('Choose a .one section or .onepkg notebook package.')
    if(file.size>10*1024*1024)throw new Error('Choose a notebook package no larger than 10 MB.')
    setBusy('Reading notebook…');setData(null)
    const body=new FormData();body.append('pdfFile',file);body.append('mode',compatibility?'compatibility':'native')
    const response=await fetch('/api/documents/import-onenote',{method:'POST',headers:{Authorization:`Bearer ${token}`},body})
    const result=await readApiJson(response)
    if(!response.ok)throw new Error(result.message||'Could not read this notebook.')
    if(!Array.isArray(result.pages)||!result.pages.length)throw new Error('No readable pages were found.')
    setData(result);setPreviewIndex(0);setSelected(new Set(result.pages.map((_,index)=>index)))
  })
  useEffect(()=>{if(initialFile&&!autoStarted.current){autoStarted.current=true;extract()}},[initialFile])
  const save=()=>run(async()=>{
    if(!selected.size||!title.trim())return
    setBusy('Preparing notes…')
    const {PDFDocument}=await import('pdf-lib'),pdf=await PDFDocument.create()
    if(data.mode==='native'){
      for(const [index,page] of pages.entries()){
        if(!selected.has(index))continue
        setBusy(`Preserving page ${index+1} of ${pages.length}…`)
        const bytes=Uint8Array.from(atob(page.pdfData),character=>character.charCodeAt(0))
        const original=await PDFDocument.load(bytes)
        if(!original.getPageCount())throw new Error(`OneNote returned no PDF pages for ${page.title}. Import stopped.`)
        for(const copy of await pdf.copyPages(original,original.getPageIndices()))pdf.addPage(copy)
      }
    }else{
    await document.fonts.ready
    await Promise.all([...paper.current.querySelectorAll('img')].map(img=>img.decode().catch(()=>{throw new Error('An imported image could not be rendered. Deselect that page or export it as PDF from OneNote.')})))
    // Rasterize sanitized ink at an explicit size before html2canvas sees it.
    // Browser SVG default dimensions otherwise squash or clip ink-only pages.
    const exportPaper=paper.current.cloneNode(true)
    const originals=[...paper.current.querySelectorAll('img')],copies=[...exportPaper.querySelectorAll('img')]
    for(let index=0;index<originals.length;index++){
      const image=originals[index]
      if(!image.src.startsWith('data:image/svg+xml'))continue
      const canvas=document.createElement('canvas'),ratio=image.naturalHeight/Math.max(1,image.naturalWidth)
      canvas.width=Math.min(2400,Math.max(600,image.naturalWidth*2));canvas.height=Math.max(1,Math.min(12000,Math.round(canvas.width*ratio)))
      const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height)
      copies[index].src=canvas.toDataURL('image/png')
    }
    const {default:html2pdf}=await import('html2pdf.js'),sections=splitMarkdownExport(exportPaper)
    try{
      for(let index=0;index<sections.chunks.length;index++){
        setBusy(`Creating notes ${index+1} / ${sections.chunks.length}…`)
        const worker=html2pdf().set({margin:[15,15,15,15],image:{type:'jpeg',quality:.92},html2canvas:{scale:1.5,backgroundColor:'#ffffff',logging:false,useCORS:false},jsPDF:{unit:'mm',format:'a4',compress:true},enableLinks:false,pagebreak:{mode:['css','legacy'],avoid:['tr','img','h1','h2']}}).from(sections.chunks[index]).toPdf()
        const converted=await worker.get('pdf'),part=await PDFDocument.load(converted.output('arraybuffer'))
        for(const page of await pdf.copyPages(part,part.getPageIndices()))pdf.addPage(page)
        const canvas=await worker.get('canvas');if(canvas){canvas.width=0;canvas.height=0}
      }
    }finally{sections.dispose()}
    }
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
    <p>Annotation-preserving import uses desktop OneNote on the Windows backend to export the original pages, including ink over printouts. If unavailable, export your document as PDF in OneNote and upload that PDF.</p>
    <label className="onenote-compatibility"><input type="checkbox" checked={compatibility} disabled={!!busy} onChange={event=>{setCompatibility(event.target.checked);setData(null)}}/>Use compatibility import instead (may lose handwriting, annotations, and original layout)</label>
    <div className="markdown-pdf-options"><label>OneNote file<input type="file" accept=".one,.onepkg" disabled={!!busy} onChange={event=>{const next=event.target.files[0];setFile(next||null);setData(null);setError('');if(next)setTitle(next.name.replace(/\.(one|onepkg)$/i,''))}}/></label><label>Document name<input value={title} maxLength={120} disabled={!!busy} onChange={event=>setTitle(event.target.value)}/></label><button disabled={!file||!!busy} onClick={extract}><Upload size={16}/>Read notebook</button></div>
    {data&&<>
      <ul className="onenote-warnings">{data.warnings?.map((warning,index)=><li key={index}>{warning}</li>)}</ul>
      <div className="onenote-selection"><strong>{selected.size} of {pages.length} pages selected</strong><button disabled={!!busy} onClick={()=>setSelected(new Set(pages.map((_,index)=>index)))}>Select all</button><button disabled={!!busy} onClick={()=>setSelected(new Set())}>Clear selection</button><div>{pages.map((page,index)=><label key={index}><input type="checkbox" checked={selected.has(index)} disabled={!!busy} onChange={()=>setSelected(previous=>{const next=new Set(previous);next.has(index)?next.delete(index):next.add(index);return next})}/><span>{page.title}<small>{page.section}</small></span></label>)}</div></div>
      {data.mode==='native'?<div className="markdown-pdf-preview"><label>Preview source page <select value={previewIndex} onChange={event=>setPreviewIndex(Number(event.target.value))}>{pages.map((page,index)=><option key={index} value={index}>{index+1}. {page.title}</option>)}</select></label><NativePagePreview page={pages[previewIndex]}/><p>Each source page may span multiple PDF sheets. Saving keeps every sheet from each selected page, with OneNote’s rendering intact.</p></div>:<div className="markdown-pdf-preview"><div className="markdown-pdf-preview-label">Compatibility preview · layout and ink may differ</div><article ref={paper} className="markdown-pdf-paper onenote-paper"><div className="assistant-markdown">{pages.map((page,index)=>selected.has(index)&&<section key={index} className="onenote-page"><p className="onenote-section">{page.section}</p><h1>{page.title}</h1><div dangerouslySetInnerHTML={{__html:page.html}}/></section>)}</div></article></div>}
    </>}
    {error&&<p role="alert" className="markdown-pdf-error">{error}</p>}
    <footer><p role="status">{busy||'Up to 10 MB per package and 200 source pages. Larger notebooks can be imported in parts.'}</p><button className="library-primary" disabled={!!busy||!data||!selected.size||!title.trim()} onClick={save}>Save & open notes</button></footer>
  </section>
}
