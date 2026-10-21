import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page } from 'react-pdf'
import { replacementCss, loadPageFontStyles } from '../lib/pdfTextStyle'

const EMPTY=[]
const ContinuousPage=memo(function ContinuousPage({number,active,activeReady,activePage,scale,rotation,fallback,items,renderStroke,onActivate,onReady,viewer,file}){
  const ref=useRef(null),pageProxy=useRef(null),initialSize=useRef(fallback||{w:612,h:792,rotation:0}),[near,setNear]=useState(active),[base,setBase]=useState(null)
  useEffect(()=>{
    const observer=new IntersectionObserver(entries=>setNear(entries[0].isIntersecting),{root:viewer.current,rootMargin:'1000px 0px'})
    if(ref.current)observer.observe(ref.current)
    return()=>observer.disconnect()
  },[viewer])
  useEffect(()=>{if(near&&items.some(item=>item.textStyle?.embedded))loadPageFontStyles(file,number-1).catch(()=>{})},[near,file,number,items])
  useEffect(()=>{if(active&&pageProxy.current)onReady(pageProxy.current)},[active,onReady])
  const dimensions=base||initialSize.current,quarter=rotation%180!==0
  const width=(quarter?dimensions.h:dimensions.w)*scale,height=(quarter?dimensions.w:dimensions.h)*scale
  const showEditor=active&&activeReady
  const handleActivateKeyDown=event=>{
    if(event.key!=='Enter'&&event.key!==' ')return
    event.preventDefault()
    onActivate(number)
  }
  return <section ref={ref} className={`pdf-continuous-page${active?' is-active':''}`} data-continuous-page={number} aria-label={`Page ${number}`}>
    <div className="pdf-continuous-label"><span>Page {number}</span><button type="button" aria-pressed={active} onClick={()=>onActivate(number)}>{active?'Editing this page':'Select page'}</button></div>
    <div role={active?undefined:'button'} tabIndex={active?undefined:0} aria-label={active?`Editing page ${number}`:`Activate page ${number} for editing`} onClick={()=>{if(!active)onActivate(number,{page:pageProxy.current})}} onKeyDown={active?undefined:handleActivateKeyDown} className="pdf-page-surface pdf-continuous-surface" style={{width,height}}>
      {(near||active)?<Page pageNumber={number} scale={scale} rotate={(dimensions.rotation+rotation)%360} renderTextLayer={false} renderAnnotationLayer={false} onLoadSuccess={page=>{pageProxy.current=page;const viewport=page.getViewport({scale:1});setBase(previous=>previous?.w===viewport.width&&previous?.h===viewport.height&&previous?.rotation===page.rotate?previous:{w:viewport.width,h:viewport.height,rotation:page.rotate||0});if(active)onReady(page)}} loading={<div className="pdf-continuous-placeholder">Loading page {number}…</div>} error={<div className="pdf-continuous-placeholder">Could not render page {number}.</div>}/>:<div className="pdf-continuous-placeholder">Page {number}</div>}
      {showEditor&&<div className="pdf-continuous-active-layer">{activePage}</div>}
      {!showEditor&&(near||active)&&base&&<div className="pdf-passive-annotations" style={{left:(width-base.w*scale)/2,top:(height-base.h*scale)/2,width:base.w*scale,height:base.h*scale,transform:`rotate(${rotation}deg)`}}>
        {items.filter(item=>item.sourceText).map(item=><div key={`cover-${item.id}`} style={{position:'absolute',left:item.sourceText.x*scale,top:item.sourceText.y*scale,width:item.sourceText.width*scale,height:item.sourceText.height*scale,background:item.sourceText.background||'#fff'}}/>)}
        <svg viewBox={`0 0 ${base.w} ${base.h}`} style={{position:'absolute',inset:0,width:'100%',height:'100%'}}>{items.filter(item=>item.points).map(item=>renderStroke(item,item.id))}</svg>
        {items.filter(item=>item.tool==='image').map(item=><img key={item.id} src={item.dataUrl} alt={item.label||'Annotation'} draggable={false} style={{position:'absolute',left:item.x*scale,top:item.y*scale,width:item.width*scale,height:item.height*scale}}/>)}
        {items.filter(item=>item.tool==='text').map(item=><div key={item.id} style={{position:'absolute',left:item.x*scale,top:item.y*scale,color:item.color||'#000',fontSize:(item.fontSize||16)*scale,...replacementCss(item,scale),lineHeight:1.2,whiteSpace:'pre',padding:`${2*scale}px ${4*scale}px`}}>{item.text}</div>)}
      </div>}
    </div>
  </section>
})

export default function PDFContinuousView({file,count,currentPage,activePage,activePageReady,scale,rotation,fallback,annotations,renderStroke,onActivate,onPageReady,onDocumentReady,viewer,options}){
  const cache=useRef(new Map()),live=useRef(null),[stackElement,setStackElement]=useState(null)
  live.current={renderStroke,onActivate,onPageReady,onDocumentReady,currentPage}
  const callbacks=useMemo(()=>({renderStroke:(...args)=>live.current.renderStroke(...args),onActivate:(...args)=>live.current.onActivate(...args),onReady:page=>{if(page.pageNumber===live.current.currentPage)live.current.onPageReady(page)},onDocumentReady:document=>live.current.onDocumentReady(document)}),[])
  useEffect(()=>{
    const viewport=viewer.current,element=stackElement
    if(!viewport||!element)return
    let frame=0,timer=0,disposed=false
    const check=()=>{
      frame=0;if(disposed)return
      const bounds=viewport.getBoundingClientRect(),top=Math.max(0,bounds.top),bottom=Math.min(window.innerHeight,bounds.bottom)
      if(bottom<=top)return
      let best=null,bestScore=0,currentScore=0
      for(const section of element.children){
        const surface=section.querySelector('.pdf-continuous-surface');if(!surface)continue
        const rect=surface.getBoundingClientRect(),visible=Math.max(0,Math.min(bottom,rect.bottom)-Math.max(top,rect.top))
        const score=visible/Math.max(1,Math.min(rect.height,bottom-top)),number=Number(section.dataset.continuousPage)
        if(number===live.current.currentPage)currentScore=score
        if(score>bestScore){bestScore=score;best=number}
      }
      // Hysteresis prevents rapid switching when two pages share the viewport.
      if(best&&best!==live.current.currentPage&&bestScore>.5&&bestScore>currentScore+.18)live.current.onActivate(best,{automatic:true})
    }
    const schedule=()=>{clearTimeout(timer);cancelAnimationFrame(frame);frame=0;if(!disposed)timer=setTimeout(()=>{frame=requestAnimationFrame(check)},180)}
    viewport.addEventListener('scroll',schedule,{passive:true})
    viewport.addEventListener('pointerup',schedule,true)
    viewport.addEventListener('pointercancel',schedule,true)
    viewport.addEventListener('focusout',schedule)
    window.addEventListener('resize',schedule)
    const observer=new ResizeObserver(schedule);observer.observe(viewport)
    schedule()
    return()=>{disposed=true;clearTimeout(timer);cancelAnimationFrame(frame);observer.disconnect();viewport.removeEventListener('scroll',schedule);viewport.removeEventListener('pointerup',schedule,true);viewport.removeEventListener('pointercancel',schedule,true);viewport.removeEventListener('focusout',schedule);window.removeEventListener('resize',schedule)}
  },[viewer,file,count,stackElement])
  const byPage=useMemo(()=>{
    const map=new Map();for(const item of annotations){const page=item.page||1;if(!map.has(page))map.set(page,[]);map.get(page).push(item)}
    for(const [page,items]of map){const previous=cache.current.get(page);if(previous?.length===items.length&&items.every((item,index)=>item===previous[index]))map.set(page,previous)}
    cache.current=map;return map
  },[annotations])
  useEffect(()=>{viewer.current?.querySelector(`[data-continuous-page="${currentPage}"]`)?.scrollIntoView({block:'start'})},[]) // Preserve the selected page when switching views.
  return <Document onLoadSuccess={callbacks.onDocumentReady} className="pdf-continuous-document" options={options} file={file} loading={<p>Loading continuous view…</p>} error={<p role="alert">Could not load continuous view. Switch to single-page view to retry.</p>}><div ref={setStackElement} className="pdf-continuous-stack">{Array.from({length:count||1},(_,index)=><ContinuousPage file={file} key={index+1} number={index+1} active={currentPage===index+1} activeReady={currentPage===index+1&&activePageReady} activePage={currentPage===index+1?activePage:null} scale={scale} rotation={rotation} fallback={fallback} items={byPage.get(index+1)||EMPTY} renderStroke={callbacks.renderStroke} onActivate={callbacks.onActivate} onReady={callbacks.onReady} viewer={viewer}/>)}</div></Document>
}
