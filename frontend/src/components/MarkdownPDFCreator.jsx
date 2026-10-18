import { useEffect, useRef, useState } from 'react'
import { X, Download, FileText, Loader2 } from 'lucide-react'
import AssistantMarkdown from './AssistantMarkdown'
import { readApiJson } from '../lib/apiResponse'
import { downloadBlob } from '../lib/documentFormats'
import { prepareMarkdownExport } from '../lib/markdownPdfExport'
import './MarkdownPDFCreator.css'

export default function MarkdownPDFCreator({token,folderId,onClose,onCreated}){
  const [title,setTitle]=useState('Markdown document'),[markdown,setMarkdown]=useState(''),[format,setFormat]=useState('a4'),[busy,setBusy]=useState(''),[error,setError]=useState('')
  const paper=useRef(null),panel=useRef(null),file=useRef(null),lock=useRef(false)
  useEffect(()=>{const previous=document.activeElement;panel.current?.scrollIntoView({block:'nearest'});panel.current?.querySelector('textarea')?.focus();return()=>{if(previous?.isConnected)previous.focus({preventScroll:true})}},[])
  const create=async save=>{
    if(lock.current||!markdown.trim()||!title.trim())return
    lock.current=true;setBusy(save?'Saving PDF…':'Preparing PDF…');setError('')
    try{
      await Promise.all(Array.from(document.fonts).filter(font=>font.family.includes('KaTeX')).map(font=>font.load()))
      await document.fonts.ready
      const element=paper.current
      if(element.scrollHeight>12000)throw new Error('This document is too long for browser conversion. Split it into shorter documents (about 12 pages each).')
      if(element.querySelector('.katex-error'))throw new Error('A math expression could not be formatted. Correct the highlighted expression before exporting.')
      const exportElement=await prepareMarkdownExport(element)
      const {default:html2pdf}=await import('html2pdf.js')
      const worker=html2pdf().set({margin:[15,15,18,15],image:{type:'png'},html2canvas:{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:false},jsPDF:{unit:'mm',format,orientation:'portrait',compress:true},enableLinks:true,pagebreak:{mode:['css','legacy'],avoid:['tr','.katex-display','.markdown-pdf-formula','pre','h1','h2','h3','h4']}}).from(exportElement).toPdf()
      const pdf=await worker.get('pdf')
      pdf.setProperties({title:title.trim(),creator:'Assignment Tracker'})
      const pages=pdf.internal.getNumberOfPages()
      for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setFontSize(8);pdf.setTextColor(110);pdf.text(`${page} / ${pages}`,pdf.internal.pageSize.getWidth()/2,pdf.internal.pageSize.getHeight()-8,{align:'center'})}
      const blob=pdf.output('blob'),filename=(title.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/\.pdf$/i,'').trim()||'Markdown document')+'.pdf'
      if(!blob.size)throw new Error('PDF conversion returned an empty file. Try a shorter document.')
      if(!save){downloadBlob(blob,filename);return}
      if(blob.size>10*1024*1024)throw new Error('This PDF exceeds the 10 MB library limit. Download it or split the Markdown into smaller documents.')
      const body=new FormData();body.append('pdfFile',new File([blob],filename,{type:'application/pdf'}));body.append('name',title.trim());body.append('tags',JSON.stringify(['markdown-pdf']));if(folderId)body.append('pdfFolderId',folderId)
      const response=await fetch('/api/pdfs',{method:'POST',headers:{Authorization:`Bearer ${token}`},body})
      const result=await readApiJson(response);if(!response.ok)throw new Error(result.message||'Could not save the PDF.')
      if(!result._id)throw new Error('The server did not confirm saving. Refresh the library before retrying.')
      onCreated(result)
    }catch(error){setError(error.message||'Could not convert this Markdown. Try a shorter document.')}
    finally{lock.current=false;setBusy('')}
  }
  return <section ref={panel} className="markdown-pdf-creator" aria-labelledby="markdown-pdf-heading" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'&&!busy)onClose()}}>
    <header><div><FileText size={19}/><h3 id="markdown-pdf-heading">Markdown to PDF</h3></div><button type="button" disabled={!!busy} onClick={onClose} aria-label="Close Markdown converter"><X size={17}/></button></header>
    <p>Paste Markdown or import an .md file. Typed spaces, line breaks, and extra blank lines between text blocks are preserved in the preview and PDF.</p>
    <div className="markdown-pdf-options"><label>Document name<input value={title} maxLength={120} disabled={!!busy} onChange={event=>setTitle(event.target.value)}/></label><label>Page size<select value={format} disabled={!!busy} onChange={event=>setFormat(event.target.value)}><option value="a4">A4</option><option value="letter">US Letter</option></select></label><input ref={file} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={async event=>{try{const selected=event.target.files[0];if(!selected)return;if(selected.size>150000)throw new Error('Choose a Markdown file smaller than 150 KB.');const value=await selected.text();if(value.length>30000)throw new Error('Use up to 30,000 characters per document.');setMarkdown(value);setTitle(selected.name.replace(/\.[^.]+$/,''));setError('')}catch(error){setError(error.message)}finally{event.target.value=''}}}/><button type="button" disabled={!!busy} onClick={()=>file.current?.click()}>Import .md</button></div>
    <div className="markdown-pdf-workspace"><label className="markdown-pdf-source">Markdown input<textarea rows={22} disabled={!!busy} maxLength={30000} value={markdown} spellCheck={false} onChange={event=>setMarkdown(event.target.value)} placeholder={'# My notes\n\nA paragraph with **bold** and *italic* text.\n\n- First point\n- Second point\n\n$$\nA = \\pi r^2\n$$'}/><small>{markdown.length.toLocaleString()} / 30,000 characters</small></label><div className="markdown-pdf-preview"><div className="markdown-pdf-preview-label">Formatted preview · {format==='a4'?'A4':'US Letter'}</div><article ref={paper} className="markdown-pdf-paper" style={{width:format==='a4'?'180mm':'185.9mm'}}><AssistantMarkdown preserveSpacing content={markdown||'*Your formatted document will appear here.*'}/></article></div></div>
    {error&&<p role="alert" className="markdown-pdf-error">{error}</p>}
    <footer><p>Formatting converts locally—no AI key needed. Exports are high-resolution rendered pages; use the PDF editor to add annotations. External images remain links.</p><button type="button" disabled={!!busy||!markdown.trim()||!title.trim()} onClick={()=>create(false)}><Download size={16}/>Download PDF</button><button type="button" className="library-primary" disabled={!!busy||!markdown.trim()||!title.trim()} onClick={()=>create(true)}>{busy?<Loader2 size={16} className="animate-spin"/>:<FileText size={16}/>} {busy||'Save & open PDF editor'}</button></footer>
  </section>
}
