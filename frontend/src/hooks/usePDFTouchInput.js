import { useEffect, useRef, useState } from 'react'
import { allowOnPointerDown, getCenter, isPenInput } from '../lib/vendor/excalidraw/pointerInput'
import {scrollPhysics} from '../lib/pdfScrollSettings'

const CONTROL='button,input,textarea,select,a,[contenteditable="true"]'
const consume=event=>{event.preventDefault();event.stopPropagation()}
const flingVelocity=(pan,now=performance.now())=>{
  if(!pan||pan.frozen||now-pan.lastMotion>100)return null
  const samples=pan.samples||[],first=samples[0],last=samples[samples.length-1]
  if(!first||!last||last.t-first.t<8)return pan.carry&&now-pan.carry.t<100?pan.carry:null
  let x=(first.x-last.x)/(last.t-first.t),y=(first.y-last.y)/(last.t-first.t)
  const speed=Math.hypot(x,y)
  if(speed<.06)return null
  if(speed>4.5){x*=4.5/speed;y*=4.5/speed}
  return {x,y,t:now}
}

// Excalidraw v0.18.0 input policy adapted to a PDF viewport. Upstream
// attribution/license: ../lib/vendor/excalidraw/SOURCE.md and LICENSE.
// Real pointer events flow to the annotation tools; no delayed event replay,
// contact-size classifier, or capture-loss-triggered undo is used.
export default function usePDFTouchInput({viewer,overlay,scrollWithFinger,scrollSettings,canDrawTouch,onDrawEnd,resetAnnotation,beginTouchAnnotation,endTouchAnnotation,resetKey,tool,onPinchStart,onPinchMove,onPinchEnd}){
  const [activity,setActivity]=useState('idle')
  const state=useRef({touches:new Map(),controls:new Set(),pen:null,draw:null,pan:null,pinch:null,frame:0,momentumFrame:0,wheelFrame:0,wheelX:0,wheelY:0,blockedUntil:0,mounted:true})
  const latest=useRef(null)
  latest.current={scrollWithFinger,scrollSettings,canDrawTouch,onDrawEnd,resetAnnotation,beginTouchAnnotation,endTouchAnnotation,tool,onPinchStart,onPinchMove,onPinchEnd}
  const report=value=>{if(state.current.mounted)setActivity(previous=>previous===value?previous:value)}
  const suppressClick=()=>{state.current.blockedUntil=performance.now()+350}
  const accepted=()=>new Map([...state.current.touches].filter(([,contact])=>contact.kind!=='ignored'))
  const stopMomentum=()=>{
    const current=state.current
    const running=current.momentumFrame||current.wheelFrame
    cancelAnimationFrame(current.wheelFrame);current.wheelFrame=0;current.wheelX=0;current.wheelY=0
    if(!running)return
    cancelAnimationFrame(current.momentumFrame);current.momentumFrame=0
    if(!accepted().size&&current.pen===null)report('idle')
  }
  const startMomentum=velocity=>{
    stopMomentum()
    const physics=scrollPhysics(latest.current.scrollSettings)
    if(!velocity||!physics.momentum||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return false
    const current=state.current
    let vx=velocity.x*physics.gain,vy=velocity.y*physics.gain,last=performance.now(),started=last
    const decayTime=physics.decayTime,maxDuration=Math.min(8500,Math.max(600,decayTime*2200/325))
    let positionX=viewer.current?.scrollLeft||0,positionY=viewer.current?.scrollTop||0
    // Exponential friction integrates distance using elapsed time, independent
    // of refresh rate. Balanced settings retain the original 325 ms decay.
    const step=now=>{
      const element=viewer.current
      if(!current.mounted||!element||current.pen!==null||accepted().size||latest.current.scrollSettings?.momentum===false||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){current.momentumFrame=0;report('idle');return}
      const dt=Math.min(64,Math.max(0,now-last));last=now
      const decay=Math.exp(-dt/decayTime),maxX=Math.max(0,element.scrollWidth-element.clientWidth),maxY=Math.max(0,element.scrollHeight-element.clientHeight)
      positionX=Math.max(0,Math.min(maxX,positionX+vx*decayTime*(1-decay)));positionY=Math.max(0,Math.min(maxY,positionY+vy*decayTime*(1-decay)))
      element.scrollLeft=positionX;element.scrollTop=positionY
      // A clamped edge stops only that axis, without bouncing or jitter.
      vx=positionX<=0&&vx<0||positionX>=maxX&&vx>0?0:vx*decay
      vy=positionY<=0&&vy<0||positionY>=maxY&&vy>0?0:vy*decay
      if(Math.hypot(vx,vy)<.02||now-started>maxDuration){current.momentumFrame=0;report('idle');return}
      current.momentumFrame=requestAnimationFrame(step)
    }
    report('scrolling');current.momentumFrame=requestAnimationFrame(step);return true
  }
  const capture=id=>{try{viewer.current?.setPointerCapture(id)}catch{}}
  const release=id=>{try{if(viewer.current?.hasPointerCapture(id))viewer.current.releasePointerCapture(id);if(overlay.current?.hasPointerCapture(id))overlay.current.releasePointerCapture(id)}catch{}}
  const flushPan=()=>{
    const current=state.current,element=viewer.current,pan=current.pan
    cancelAnimationFrame(current.frame);current.frame=0
    if(!pan||!element)return
    if(current.pinch){
      const contacts=[...accepted().values()]
      if(contacts.length===2){const distance=Math.hypot(contacts[1].x-contacts[0].x,contacts[1].y-contacts[0].y);current.pinch.ratio=distance/current.pinch.distance;latest.current.onPinchMove?.(current.pinch.ratio,getCenter(accepted()))}
      return
    }
    element.scrollLeft+=pan.dx;element.scrollTop+=pan.dy
    pan.dx=0;pan.dy=0
  }
  const endPinch=canceled=>{if(!state.current.pinch)return;state.current.pinch=null;latest.current.onPinchEnd?.(canceled)}
  const cancelTouchInk=()=>{
    const current=state.current
    if(current.draw!==null){current.draw=null;latest.current.resetAnnotation({rollbackTouch:true})}
  }
  const rebasePan=()=>{
    flushPan()
    const current=state.current,pointers=accepted(),center=getCenter(pointers)
    const now=performance.now(),previousPinch=current.pinch
    const carry=pointers.size===1&&previousPinch&&Math.abs((previousPinch.ratio||1)-1)<.035?flingVelocity(current.pan,now):null
    if(pointers.size!==2)endPinch(pointers.size>2)
    if(pointers.size===2&&!current.pinch&&latest.current.onPinchStart){
      const contacts=[...pointers.values()],distance=Math.hypot(contacts[1].x-contacts[0].x,contacts[1].y-contacts[0].y)
      if(distance>=12){current.pinch={distance};latest.current.onPinchStart(center)}
    }
    // A third touch is ambiguous (often a palm): freeze until at most two remain.
    current.pan=center?{last:center,dx:0,dy:0,frozen:pointers.size>2,samples:[{...center,t:now}],lastMotion:carry?now:0,carry}:null
    pointers.forEach(contact=>{contact.kind='pan';capture(contact.id)})
    report(center?'scrolling':'idle')
  }
  const movePan=()=>{
    const current=state.current,pan=current.pan
    if(!pan||pan.frozen)return
    const center=getCenter(accepted())
    if(!center)return
    const now=performance.now()
    if(Math.hypot(center.x-pan.last.x,center.y-pan.last.y)>.1){
      pan.lastMotion=now;pan.carry=null;pan.samples.push({...center,t:now})
      while(pan.samples.length>2&&pan.samples[1].t<now-100)pan.samples.shift()
    }
    if(!current.pinch){const {gain}=scrollPhysics(latest.current.scrollSettings);pan.dx+=(pan.last.x-center.x)*gain;pan.dy+=(pan.last.y-center.y)*gain}pan.last=center
    if(!current.frame)current.frame=requestAnimationFrame(flushPan)
  }
  const reset=()=>{
    const current=state.current
    stopMomentum()
    endPinch(true)
    cancelTouchInk();cancelAnimationFrame(current.frame);current.frame=0;current.pan=null
    const ids=[...current.touches.keys()];if(current.pen!==null)ids.push(current.pen)
    current.touches.clear();current.controls.clear();current.pen=null
    ids.forEach(release);latest.current.resetAnnotation();report('idle')
  }
  const ownPen=id=>{
    const current=state.current
    stopMomentum()
    endPinch(true)
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
      if(canceled)endPinch(true)
      if(contact.kind==='pan'&&!canceled){contact.x=event.clientX;contact.y=event.clientY;movePan()}
      consume(event);suppressClick()
    }
    flushPan()
    const velocity=contact.kind==='pan'&&!canceled&&(!current.pinch||Math.abs((current.pinch.ratio||1)-1)<.035)?flingVelocity(current.pan):null
    current.touches.delete(id);release(id)
    if(contact.kind==='pan')rebasePan()
    if(!accepted().size&&current.pen===null){if(!startMomentum(velocity))report('idle')}
  }
  const handlers={
    onClickCapture:event=>{if(event.detail!==0&&performance.now()<state.current.blockedUntil)consume(event)},
    onContextMenuCapture:event=>{if(state.current.touches.size||state.current.pen!==null)consume(event)},
    onPointerDownCapture:event=>{
      const current=state.current,id=event.pointerId
      stopMomentum()
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
    window.addEventListener('pointerdown',stopMomentum,true)
    const interruptWheel=event=>{
      if(latest.current.scrollSettings?.wheelEnabled!==false&&viewer.current?.contains(event.target)&&!event.ctrlKey&&!event.metaKey&&!event.target.closest(CONTROL))return
      stopMomentum()
    }
    window.addEventListener('wheel',interruptWheel,{capture:true,passive:true})
    window.addEventListener('keydown',stopMomentum,true)
    window.addEventListener('pointerup',outsideEnd);window.addEventListener('pointercancel',outsideEnd)
    return()=>{
      endPinch(true)
      current.mounted=false;stopMomentum();cancelAnimationFrame(current.frame)
      const ids=[...current.touches.keys()];if(current.pen!==null)ids.push(current.pen)
      current.touches.clear();current.controls.clear();current.draw=null;current.pen=null;current.pan=null;ids.forEach(release)
      window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden)
      window.removeEventListener('pointerdown',stopMomentum,true)
      window.removeEventListener('wheel',interruptWheel,true)
      window.removeEventListener('keydown',stopMomentum,true)
      window.removeEventListener('pointerup',outsideEnd);window.removeEventListener('pointercancel',outsideEnd)
    }
  },[])
  useEffect(()=>{reset()},[scrollWithFinger,resetKey])
  useEffect(()=>{
    const element=viewer.current
    if(!element)return
    let last=0,positionX=0,positionY=0
    const step=now=>{
      const current=state.current,physics=scrollPhysics(latest.current.scrollSettings)
      if(!current.mounted||!physics.wheelEnabled||current.pen!==null||accepted().size){stopMomentum();return}
      const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      const dt=Math.min(64,Math.max(1,now-last));last=now
      const ratio=!physics.momentum||reduced?1:1-Math.exp(-dt/Math.max(20,Math.min(650,physics.decayTime/2)))
      const dx=current.wheelX*ratio,dy=current.wheelY*ratio
      current.wheelX-=dx;current.wheelY-=dy
      const maxX=Math.max(0,element.scrollWidth-element.clientWidth),maxY=Math.max(0,element.scrollHeight-element.clientHeight)
      positionX=Math.max(0,Math.min(maxX,positionX+dx));positionY=Math.max(0,Math.min(maxY,positionY+dy))
      element.scrollLeft=positionX;element.scrollTop=positionY
      if(positionX<=0&&current.wheelX<0||positionX>=maxX&&current.wheelX>0)current.wheelX=0
      if(positionY<=0&&current.wheelY<0||positionY>=maxY&&current.wheelY>0)current.wheelY=0
      if(Math.hypot(current.wheelX,current.wheelY)<.25){element.scrollLeft=positionX+current.wheelX;element.scrollTop=positionY+current.wheelY;current.wheelX=0;current.wheelY=0;current.wheelFrame=0;report('idle');return}
      current.wheelFrame=requestAnimationFrame(step)
    }
    const wheel=event=>{
      const current=state.current,physics=scrollPhysics(latest.current.scrollSettings)
      if(!physics.wheelEnabled||event.ctrlKey||event.metaKey||event.defaultPrevented||current.pen!==null||accepted().size||event.target.closest(CONTROL))return
      const unit=event.deltaMode===1?16:event.deltaMode===2?element.clientHeight:1
      let dx=event.deltaX*unit,dy=event.deltaY*unit
      if(event.shiftKey&&!dx){dx=dy;dy=0}
      const canX=dx<0?element.scrollLeft>0:dx>0&&element.scrollLeft<element.scrollWidth-element.clientWidth
      const canY=dy<0?element.scrollTop>0:dy>0&&element.scrollTop<element.scrollHeight-element.clientHeight
      if(!canX&&!canY)return
      if(!event.cancelable)return
      event.preventDefault()
      cancelAnimationFrame(current.momentumFrame);current.momentumFrame=0
      if(!current.wheelFrame){positionX=element.scrollLeft;positionY=element.scrollTop;last=performance.now()}
      current.wheelX+=dx*physics.gain;current.wheelY+=dy*physics.gain
      report('scrolling')
      if(!current.wheelFrame)current.wheelFrame=requestAnimationFrame(step)
    }
    element.addEventListener('wheel',wheel,{passive:false})
    return()=>{element.removeEventListener('wheel',wheel);cancelAnimationFrame(state.current.wheelFrame);state.current.wheelFrame=0;state.current.wheelX=0;state.current.wheelY=0}
  },[viewer,resetKey])
  return {handlers,activity}
}
