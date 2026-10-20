import { useEffect, useRef, useState } from 'react'
import { allowOnPointerDown, getCenter, isPenInput } from '../lib/vendor/excalidraw/pointerInput'

const CONTROL='button,input,textarea,select,a,[contenteditable="true"]'
const consume=event=>{event.preventDefault();event.stopPropagation()}

// Excalidraw v0.18.0 input policy adapted to a PDF viewport. Upstream
// attribution/license: ../lib/vendor/excalidraw/SOURCE.md and LICENSE.
// Real pointer events flow to the annotation tools; no delayed event replay,
// contact-size classifier, or capture-loss-triggered undo is used.
export default function usePDFTouchInput({viewer,overlay,scrollWithFinger,canDrawTouch,onDrawEnd,resetAnnotation,beginTouchAnnotation,endTouchAnnotation,resetKey,tool}){
  const [activity,setActivity]=useState('idle')
  const state=useRef({touches:new Map(),controls:new Set(),pen:null,draw:null,pan:null,frame:0,blockedUntil:0,mounted:true})
  const latest=useRef(null)
  latest.current={scrollWithFinger,canDrawTouch,onDrawEnd,resetAnnotation,beginTouchAnnotation,endTouchAnnotation,tool}
  const report=value=>{if(state.current.mounted)setActivity(previous=>previous===value?previous:value)}
  const suppressClick=()=>{state.current.blockedUntil=performance.now()+350}
  const accepted=()=>new Map([...state.current.touches].filter(([,contact])=>contact.kind!=='ignored'))
  const capture=id=>{try{viewer.current?.setPointerCapture(id)}catch{}}
  const release=id=>{try{if(viewer.current?.hasPointerCapture(id))viewer.current.releasePointerCapture(id);if(overlay.current?.hasPointerCapture(id))overlay.current.releasePointerCapture(id)}catch{}}
  const flushPan=()=>{
    const current=state.current,element=viewer.current,pan=current.pan
    cancelAnimationFrame(current.frame);current.frame=0
    if(!pan||!element)return
    element.scrollLeft+=pan.dx;element.scrollTop+=pan.dy
    pan.dx=0;pan.dy=0
  }
  const cancelTouchInk=()=>{
    const current=state.current
    if(current.draw!==null){current.draw=null;latest.current.resetAnnotation({rollbackTouch:true})}
  }
  const rebasePan=()=>{
    flushPan()
    const current=state.current,pointers=accepted(),center=getCenter(pointers)
    // A third touch is ambiguous (often a palm): freeze until at most two remain.
    current.pan=center?{last:center,dx:0,dy:0,frozen:pointers.size>2}:null
    pointers.forEach(contact=>{contact.kind='pan';capture(contact.id)})
    report(center&&pointers.size<=2?'scrolling':'idle')
  }
  const movePan=()=>{
    const current=state.current,pan=current.pan
    if(!pan||pan.frozen)return
    const center=getCenter(accepted())
    if(!center)return
    pan.dx+=pan.last.x-center.x;pan.dy+=pan.last.y-center.y;pan.last=center
    if(!current.frame)current.frame=requestAnimationFrame(flushPan)
  }
  const reset=()=>{
    const current=state.current
    cancelTouchInk();cancelAnimationFrame(current.frame);current.frame=0;current.pan=null
    const ids=[...current.touches.keys()];if(current.pen!==null)ids.push(current.pen)
    current.touches.clear();current.controls.clear();current.pen=null
    ids.forEach(release);latest.current.resetAnnotation();report('idle')
  }
  const ownPen=id=>{
    const current=state.current
    cancelTouchInk();cancelAnimationFrame(current.frame);current.frame=0;current.pan=null
    current.touches.forEach(contact=>{contact.kind='ignored'})
    latest.current.resetAnnotation();current.pen=id;report('pen')
  }
  const finish=(event,canceled=false)=>{
    const current=state.current,id=event.pointerId
    if(current.controls.delete(id))return
    if(isPenInput(event)){
      if(current.pen!==id)return
      // Commit at pointer-up BEFORE releasing capture or resetting any refs.
      if(canceled)latest.current.resetAnnotation()
      else latest.current.onDrawEnd(event)
      current.pen=null;report('idle');return
    }
    if(event.pointerType!=='touch')return
    const contact=current.touches.get(id)
    if(!contact)return
    if(contact.kind==='draw'){
      if(canceled)cancelTouchInk()
      else{
        latest.current.onDrawEnd(event)
        current.draw=null;latest.current.endTouchAnnotation?.(id)
      }
      consume(event);suppressClick()
    }else if(contact.kind==='interaction'){
      if(canceled)cancelTouchInk()
      else{current.draw=null;latest.current.endTouchAnnotation?.(id)}
    }else{
      if(contact.kind==='pan'&&!canceled){contact.x=event.clientX;contact.y=event.clientY;movePan()}
      consume(event);suppressClick()
    }
    flushPan();current.touches.delete(id);release(id)
    if(contact.kind==='pan')rebasePan()
    if(!accepted().size&&current.pen===null)report('idle')
  }
  const handlers={
    onClickCapture:event=>{if(event.detail!==0&&performance.now()<state.current.blockedUntil)consume(event)},
    onContextMenuCapture:event=>{if(state.current.touches.size||state.current.pen!==null)consume(event)},
    onPointerDownCapture:event=>{
      const current=state.current,id=event.pointerId
      if(event.target.closest?.(CONTROL)){
        if(event.pointerType==='touch'&&current.pen!==null){current.touches.set(id,{id,kind:'ignored'});consume(event)}
        else current.controls.add(id)
        return
      }
      if(isPenInput(event)){
        if(current.pen!==null&&current.pen!==id){consume(event);return}
        ownPen(id);return
      }
      if(event.pointerType==='mouse'){
        if(current.pen!==null||accepted().size)consume(event)
        return
      }
      if(event.pointerType!=='touch')return
      const contact={id,x:event.clientX,y:event.clientY,kind:current.pen!==null?'ignored':'draw'}
      current.touches.set(id,contact)
      if(contact.kind==='ignored'){consume(event);return}
      const pointers=accepted()
      const allow=allowOnPointerDown(latest.current.scrollWithFinger,event,latest.current.tool)
      if(latest.current.scrollWithFinger||!allow||pointers.size>1||current.pan||!overlay.current?.contains(event.target)){
        consume(event);cancelTouchInk();rebasePan();return
      }
      contact.kind=latest.current.canDrawTouch(event)?'draw':'interaction'
      current.draw=id;latest.current.beginTouchAnnotation?.(id);report('drawing')
      // Forward the actual pointerdown to the existing drawing/move/text handler.
    },
    onPointerMoveCapture:event=>{
      const current=state.current,id=event.pointerId
      if(current.controls.has(id))return
      if(isPenInput(event)){
        if(current.pen!==null&&current.pen!==id)consume(event)
        else if(current.pen===null&&event.buttons)ownPen(id)
        return
      }
      if(event.pointerType!=='touch')return
      const contact=current.touches.get(id)
      if(!contact){if(current.pen!==null||current.draw!==null)consume(event);return}
      if(contact.kind==='ignored'){consume(event);return}
      contact.x=event.clientX;contact.y=event.clientY
      if(contact.kind==='pan'){consume(event);movePan()}
      // Never reinterpret or erase an accepted stroke based on contact geometry.
    },
    onPointerUpCapture:event=>finish(event),
    onPointerCancelCapture:event=>finish(event,true),
    // Capture is allowed to transfer between child annotations and the viewport.
    // Only actual pointercancel, blur, or an explicit mode change cancels ink.
    onLostPointerCaptureCapture:()=>{}
  }
  useEffect(()=>{
    const current=state.current;current.mounted=true
    const hidden=()=>{if(document.hidden)reset()}
    const outsideEnd=event=>{
      // Bubble phase, and only outside the viewer: never preempt React's handlers.
      if(viewer.current?.contains(event.target))return
      if(current.touches.has(event.pointerId)||current.pen===event.pointerId)finish(event,event.type==='pointercancel')
      current.controls.delete(event.pointerId)
    }
    window.addEventListener('blur',reset);document.addEventListener('visibilitychange',hidden)
    window.addEventListener('pointerup',outsideEnd);window.addEventListener('pointercancel',outsideEnd)
    return()=>{
      current.mounted=false;cancelAnimationFrame(current.frame)
      const ids=[...current.touches.keys()];if(current.pen!==null)ids.push(current.pen)
      current.touches.clear();current.controls.clear();current.draw=null;current.pen=null;current.pan=null;ids.forEach(release)
      window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden)
      window.removeEventListener('pointerup',outsideEnd);window.removeEventListener('pointercancel',outsideEnd)
    }
  },[])
  useEffect(()=>{reset()},[scrollWithFinger,resetKey])
  return {handlers,activity}
}
