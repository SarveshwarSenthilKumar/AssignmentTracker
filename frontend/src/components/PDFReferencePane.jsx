import PDFInkLayer from './PDFInkLayer'
import { useEffect, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Maximize, ArrowLeftRight } from 'lucide-react'
import './PDFReferencePane.css'

export default function PDFReferencePane({file,count,page,onPage,onClose,onEdit,annotations,usePressure,options}){
  const scroll=useRef(null),[width,setWidth]=useState(360),[zoom,setZoom]=useState(1),[loaded,setLoaded]=useState(null)
  useEffect(()=>{
    const observer=new ResizeObserver(entries=>setWidth(Math.max(120,entries[0].contentRect.width-32)))
    if(scroll.current)observer.observe(scroll.current)
    return()=>observer.disconnect()
  },[])
  useEffect(()=>{scroll.current?.scrollTo({top:0,left:0})},[page,file])
  const base=loaded?.file===file&&loaded.page===page?loaded:null
  const renderWidth=Math.max(100,Math.round(width*zoom)),scale=base?renderWidth/base.w:1
  const items=annotations.filter(item=>(item.page||1)===page)
  return <aside className="pdf-reference-pane" aria-label="Side page reference">
    <header><div><strong>Side page</strong><span>Reference view</span></div><button type="button" className="pdf-control" onClick={onClose} title="Close side page" aria-label="Close side page"><X size={17}/></button></header>
    <div className="pdf-reference-controls">
      <button type="button" className="pdf-control" disabled={page<=1} onClick={()=>onPage(page-1)} aria-label="Previous reference page"><ChevronLeft size={16}/></button>
      <label>Page <select aria-label="Reference page" value={page} onChange={event=>onPage(Number(event.target.value))}>{Array.from({length:count},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select><span> / {count}</span></label>
      <button type="button" className="pdf-control" disabled={page>=count} onClick={()=>onPage(page+1)} aria-label="Next reference page"><ChevronRight size={16}/></button>
      <button type="button" className="pdf-control" onClick={()=>setZoom(value=>Math.max(.5,value-.25))} disabled={zoom<=.5} aria-label="Zoom reference out"><ZoomOut size={15}/></button>
      <button type="button" className="pdf-control" onClick={()=>setZoom(value=>Math.min(3,value+.25))} disabled={zoom>=3} aria-label="Zoom reference in"><ZoomIn size={15}/></button>
      <button type="button" className="pdf-control" onClick={()=>setZoom(1)} title="Fit reference width" aria-label="Fit reference width"><Maximize size={15}/></button>
      <button type="button" className="pdf-control" onClick={onEdit} title="Swap this page with the editing page"><ArrowLeftRight size={15}/>Edit this page</button>
    </div>
    <div ref={scroll} className="pdf-reference-scroll">
      <Document file={file} options={options} loading={<p>Loading side page…</p>} error={<p role="alert">Could not load the side page. Close and reopen it to retry.</p>}>
        <div className="pdf-page-surface pdf-reference-surface" style={{width:renderWidth,position:'relative'}}>
          <Page key={page} pageNumber={page} width={renderWidth} renderTextLayer={false} renderAnnotationLayer={false} loading={<p>Loading page {page}…</p>} onLoadSuccess={pdfPage=>{const viewport=pdfPage.getViewport({scale:1});setLoaded({page,file,w:viewport.width,h:viewport.height})}}/>
          {base&&<div className="pdf-reference-annotations" style={{width:renderWidth,height:base.h*scale}}>
            <PDFInkLayer items={items} width={base.w} height={base.h} scale={scale} usePressure={usePressure}/>
            {items.filter(item=>item.tool==='image').map(item=><img key={item.id} src={item.dataUrl} alt={item.label||'Annotation'} draggable={false} style={{position:'absolute',left:item.x*scale,top:item.y*scale,width:item.width*scale,height:item.height*scale}}/>)}
            {items.filter(item=>item.tool==='text').map(item=><div key={item.id} style={{position:'absolute',left:item.x*scale,top:item.y*scale,color:item.color||'#000',fontSize:(item.fontSize||16)*scale,fontFamily:'Helvetica, Arial, sans-serif',lineHeight:1.2,whiteSpace:'pre',padding:`${2*scale}px ${4*scale}px`}}>{item.text}</div>)}
          </div>}
        </div>
      </Document>
    </div>
  </aside>
}
