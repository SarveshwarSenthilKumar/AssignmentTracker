import { useEffect, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import PDFInkLayer from './PDFInkLayer'
import { pdfTextLines } from '../lib/pdfTextBox'
import './PDFBookView.css'

function BookPage({ number, width, annotations, usePressure }) {
  const [base,setBase]=useState(null)
  const scale=base?width/base.w:1
  const items=annotations.filter(item=>(item.page||1)===number)
  return <div className="pdf-book-page" style={{width}}>
    <Page pageNumber={number} width={width} renderTextLayer={false} renderAnnotationLayer={false}
      onLoadSuccess={page=>{const viewport=page.getViewport({scale:1});setBase({w:viewport.width,h:viewport.height})}}/>
    {base&&<div className="pdf-book-annotations" style={{height:base.h*scale}}>
      <PDFInkLayer items={items} width={base.w} height={base.h} scale={scale} usePressure={usePressure}/>
      {items.filter(item=>item.tool==='image').map(item=><img key={item.id} src={item.dataUrl} alt={item.label||'Insert'} style={{position:'absolute',left:item.x*scale,top:item.y*scale,width:item.width*scale,height:item.height*scale}}/>)}
      {items.filter(item=>item.sourceText).map(item=><div key={`cover-${item.id}`} style={{position:'absolute',left:item.sourceText.x*scale,top:item.sourceText.y*scale,width:item.sourceText.width*scale,height:item.sourceText.height*scale,background:item.sourceText.background||'#fff'}}/>)}
      {items.filter(item=>item.tool==='text').map(item=><div key={item.id} style={{
        position:'absolute',left:item.x*scale,top:item.y*scale,width:item.textBoxWidth?item.textBoxWidth*scale:undefined,
        minHeight:item.stickyNote?(item.noteHeight??110)*scale:undefined,background:item.stickyNote?item.noteColor||'#fff1a8':undefined,
        color:item.color||'#000',fontSize:(item.fontSize||16)*scale,fontFamily:'Helvetica, Arial, sans-serif',
        lineHeight:1.2,whiteSpace:'pre',padding:`${2*scale}px ${4*scale}px`,boxSizing:'border-box'
      }}>{pdfTextLines(item).join('\n')}</div>)}
    </div>}
    <span className="pdf-book-page-number">{number}</span>
  </div>
}

export default function PDFBookView({file,count,page,onPage,onEdit,annotations,usePressure,options}) {
  const root=useRef(null)
  const [width,setWidth]=useState(600)
  const [zoom,setZoom]=useState(1)
  const first=Math.floor((page-1)/2)*2+1
  useEffect(()=>{
    const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width))
    observer.observe(root.current)
    return()=>observer.disconnect()
  },[])
  const turn=direction=>onPage(Math.max(1,Math.min(count,first+direction*2)))
  return <section ref={root} className="pdf-book" aria-label="Two-page book view">
    <nav aria-label="Book navigation">
      <button type="button" disabled={first===1} onClick={()=>turn(-1)}>← Previous spread</button>
      <span>Pages {first}{first<count?`–${first+1}`:''} of {count}</span>
      <button type="button" disabled={first+1>=count} onClick={()=>turn(1)}>Next spread →</button>
      <label>Zoom <select value={zoom} onChange={event=>setZoom(Number(event.target.value))}>
        <option value={1}>Fit spread</option><option value={1.5}>150%</option><option value={2}>200%</option>
      </select></label>
      <button type="button" onClick={()=>onEdit(page)}>Edit current page</button>
    </nav>
    <div className="pdf-book-scroll" tabIndex={0} onKeyDown={event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();event.stopPropagation();turn(event.key==='ArrowLeft'?-1:1)}
    }}>
      <Document file={file} options={options} error={<p role="alert">Could not open Book view.</p>}>
        <div className="pdf-book-spread" key={first}>
          {[first,first+1].filter(number=>number<=count).map(number=><BookPage key={number} number={number}
            width={Math.max(140,(width-56)/2)*zoom} annotations={annotations} usePressure={usePressure}/>)}
          {first===count&&<div className="pdf-book-empty" aria-hidden="true"/>}
        </div>
      </Document>
    </div>
  </section>
}
