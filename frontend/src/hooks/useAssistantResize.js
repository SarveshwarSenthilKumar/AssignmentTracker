import { useLayoutEffect, useRef, useState } from 'react'

const STORAGE_KEY='assignment-tracker:assistant-layout:v1'
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value))
function storedLayout(){
  try{
    const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'),result={}
    for(const mode of ['panel','page'])if(value[mode]&&['width','height'].every(key=>Number.isFinite(value[mode][key])&&value[mode][key]>0)){
      result[mode]={width:value[mode].width,height:value[mode].height}
      if(mode==='panel'&&['x','y'].every(key=>Number.isFinite(value[mode][key]))){result[mode].x=value[mode].x;result[mode].y=value[mode].y}
    }
    return result
  }catch{return {}}
}
function limits(element,mode){
  const view=window.visualViewport,margin=window.innerWidth<500?6:12
  const left=(view?.offsetLeft||0)+margin,top=(view?.offsetTop||0)+margin
  const width=Math.max(1,(view?.width||window.innerWidth)-margin*2),height=Math.max(1,(view?.height||window.innerHeight)-margin*2)
  const maxWidth=mode==='page'?Math.max(1,element?.parentElement?.clientWidth||width):width
  const maxHeight=mode==='page'?5000:height
  return {left,top,maxWidth,maxHeight,minWidth:Math.min(300,maxWidth),minHeight:Math.min(360,maxHeight)}
}
function fit(value,bounds,mode){
  const width=clamp(value?.width??(mode==='page'?bounds.maxWidth:Math.min(760,bounds.maxWidth)),bounds.minWidth,bounds.maxWidth)
  const height=clamp(value?.height??(mode==='page'?Math.max(500,window.innerHeight-225):bounds.maxHeight),bounds.minHeight,bounds.maxHeight)
  return {width,height,x:clamp(value?.x??bounds.left+bounds.maxWidth-width,bounds.left,bounds.left+bounds.maxWidth-width),y:clamp(value?.y??bounds.top,bounds.top,bounds.top+bounds.maxHeight-height)}
}

export default function useAssistantResize({open,mode}){
  const panelRef=useRef(null),geometry=useRef(null),gesture=useRef(null),frame=useRef(null),restore=useRef(null)
  const [layout,setLayout]=useState(storedLayout),[maximized,setMaximized]=useState(false),[interacting,setInteracting]=useState(false)
  const layoutRef=useRef(layout);layoutRef.current=layout
  const apply=value=>{
    geometry.current=value
    const element=panelRef.current;if(!element)return
    for(const [key,number] of Object.entries(value))element.style.setProperty(`--assistant-${key}`,`${number}px`)
    const readout=element.querySelector('[data-assistant-dimensions]');if(readout)readout.textContent=`${Math.round(value.width)} × ${Math.round(value.height)}`
  }
  const save=value=>{
    const next={...layoutRef.current,[mode]:value};layoutRef.current=next;setLayout(next)
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(next))}catch{/* Resizing remains available when browser storage is disabled. */}
  }
  const end=(commit=true)=>{
    const current=gesture.current;if(!current)return
    if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null}
    if(current.next)apply(current.next)
    gesture.current=null
    document.documentElement.style.cursor=current.previousCursor
    document.documentElement.style.userSelect=current.previousSelection
    try{if(current.target.hasPointerCapture(current.pointerId))current.target.releasePointerCapture(current.pointerId)}catch{/* The handle may have unmounted. */}
    setInteracting(false)
    if(commit){restore.current=null;setMaximized(false);save(geometry.current)}else apply(current.start)
  }
  useLayoutEffect(()=>{
    if(!open)return
    const resize=()=>{
      if(gesture.current)end()
      const bounds=limits(panelRef.current,mode)
      apply(fit(mode==='panel'&&maximized?{width:bounds.maxWidth,height:bounds.maxHeight,x:bounds.left,y:bounds.top}:layoutRef.current[mode],bounds,mode))
    }
    resize()
    const cancel=event=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopImmediatePropagation();end(false)}}
    const blur=()=>end()
    window.addEventListener('keydown',cancel,true)
    window.addEventListener('blur',blur)
    window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize)
    let parentWidth=panelRef.current?.parentElement?.clientWidth
    const observer=mode==='page'&&typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>{const width=panelRef.current?.parentElement?.clientWidth;if(width!==parentWidth){parentWidth=width;if(!gesture.current)resize()}}):null
    if(observer&&panelRef.current?.parentElement)observer.observe(panelRef.current.parentElement)
    return()=>{end();window.removeEventListener('keydown',cancel,true);window.removeEventListener('blur',blur);window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('scroll',resize);observer?.disconnect()}
  },[open,mode,layout,maximized])
  const begin=(event,direction)=>{
    if(event.button!==0||event.isPrimary===false||gesture.current||!panelRef.current)return
    if(direction==='move'&&(mode==='page'||event.target.closest('button,a,input,textarea,select,summary')))return
    event.preventDefault();event.stopPropagation()
    const start=geometry.current||fit(null,limits(panelRef.current,mode),mode)
    const cursor=direction==='move'?'grabbing':`${direction}-resize`
    gesture.current={start:{...start},x:event.clientX,y:event.clientY,direction,pointerId:event.pointerId,target:event.currentTarget,previousCursor:document.documentElement.style.cursor,previousSelection:document.documentElement.style.userSelect}
    event.currentTarget.setPointerCapture(event.pointerId)
    document.documentElement.style.cursor=cursor;document.documentElement.style.userSelect='none'
    // Keep the current geometry when starting a drag from the maximized state.
    setInteracting(true)
  }
  const move=event=>{
    const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return
    const bounds=limits(panelRef.current,mode),dx=event.clientX-current.x,dy=event.clientY-current.y,{start,direction}=current
    const next={...start}
    if(direction==='move'){
      next.x=clamp(start.x+dx,bounds.left,bounds.left+bounds.maxWidth-start.width)
      next.y=clamp(start.y+dy,bounds.top,bounds.top+bounds.maxHeight-start.height)
    }else{
      if(direction.includes('e'))next.width=clamp(start.width+dx,bounds.minWidth,mode==='page'?bounds.maxWidth:bounds.left+bounds.maxWidth-start.x)
      if(direction.includes('s'))next.height=clamp(start.height+dy,bounds.minHeight,mode==='page'?bounds.maxHeight:bounds.top+bounds.maxHeight-start.y)
      if(direction.includes('w')){next.width=clamp(start.width-dx,bounds.minWidth,start.x+start.width-bounds.left);next.x=start.x+start.width-next.width}
      if(direction.includes('n')){next.height=clamp(start.height-dy,bounds.minHeight,start.y+start.height-bounds.top);next.y=start.y+start.height-next.height}
    }
    current.next=fit(next,bounds,mode)
    if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;if(gesture.current?.next)apply(gesture.current.next)})
  }
  const keyResize=(event,direction)=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','Escape'].includes(event.key))return
    event.preventDefault();event.stopPropagation()
    if(event.key==='Escape'){end(false);return}
    if(event.key==='Home'){reset();return}
    const bounds=limits(panelRef.current,mode),start=geometry.current,step=event.shiftKey?40:10
    if(!start)return
    const next={...start},horizontal=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,vertical=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0
    if(direction.includes('w')){next.width=clamp(start.width-horizontal,bounds.minWidth,start.x+start.width-bounds.left);next.x=start.x+start.width-next.width}
    if(direction.includes('e'))next.width=clamp(start.width+horizontal,bounds.minWidth,mode==='page'?bounds.maxWidth:bounds.left+bounds.maxWidth-start.x)
    if(direction.includes('n')){next.height=clamp(start.height-vertical,bounds.minHeight,start.y+start.height-bounds.top);next.y=start.y+start.height-next.height}
    if(direction.includes('s'))next.height=clamp(start.height+vertical,bounds.minHeight,mode==='page'?bounds.maxHeight:bounds.top+bounds.maxHeight-start.y)
    setMaximized(false);apply(next);save(next)
  }
  const reset=()=>{end();restore.current=null;setMaximized(false);save(fit(null,limits(panelRef.current,mode),mode))}
  const toggleMaximize=()=>{
    end()
    if(maximized){setMaximized(false);save(restore.current||fit(null,limits(panelRef.current,mode),mode));restore.current=null}
    else{restore.current=geometry.current;setMaximized(true)}
  }
  const pointerHandlers={onPointerMove:move,onPointerUp:()=>end(),onPointerCancel:()=>end(false),onLostPointerCapture:()=>end()}
  return {panelRef,maximized,interacting,reset,toggleMaximize,headerProps:{onPointerDown:event=>begin(event,'move'),...pointerHandlers},handleProps:direction=>({onPointerDown:event=>begin(event,direction),onKeyDown:event=>keyResize(event,direction),onDoubleClick:reset,...pointerHandlers})}
}
