import { useEffect, useRef, useState } from 'react'

const FINGER_DECISION_MS=75
const PAN_SLOP=5
const CONTROL='button,input,textarea,select,a,[contenteditable="true"]'
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value))
const consume=event=>{event.preventDefault();event.stopPropagation()}
const sample=event=>({pointerId:event.pointerId,pointerType:event.pointerType,button:event.button,buttons:event.buttons,clientX:event.clientX,clientY:event.clientY,pressure:event.pressure,timeStamp:event.timeStamp,target:event.target,nativeEvent:event.nativeEvent||event,type:event.type,preventDefault:()=>{},stopPropagation:()=>{}})

// Explicit gesture states: pending finger -> ink OR pan; pen never waits.
// Capture changes are not cancellations unless no element owns capture afterward.
export default function usePDFTouchInput({viewer,overlay,scrollWithFinger,canDrawTouch,onDrawStart,onDrawMove,onDrawEnd,resetAnnotation,beginTouchAnnotation,endTouchAnnotation,resetKey}){
  const [activity,setActivity]=useState('idle')
  const state=useRef({contacts:new Map(),controls:new Set(),pen:null,draw:null,pan:null,frame:0,timer:0,inertia:0,lastPenUp:-Infinity,blockedUntil:0,mounted:true})
  const latest=useRef(null)
  latest.current={scrollWithFinger,canDrawTouch,onDrawStart,onDrawMove,onDrawEnd,resetAnnotation,beginTouchAnnotation,endTouchAnnotation}
  const report=value=>{if(state.current.mounted)setActivity(previous=>previous===value?previous:value)}
  const suppressClick=()=>{state.current.blockedUntil=performance.now()+450}
  const contacts=()=>[...state.current.contacts.values()].filter(contact=>contact.role!=='rejected')
  const center=items=>({x:items.reduce((sum,c)=>sum+c.x,0)/items.length,y:items.reduce((sum,c)=>sum+c.y,0)/items.length})
  const cancelTimer=()=>{clearTimeout(state.current.timer);state.current.timer=0}
  const stopInertia=()=>{cancelAnimationFrame(state.current.inertia);state.current.inertia=0}
  const capture=id=>{try{viewer.current?.setPointerCapture(id)}catch{ /* Already lifted or canceled. */ }}
  const release=id=>{try{if(viewer.current?.hasPointerCapture(id))viewer.current.releasePointerCapture(id);if(overlay.current?.hasPointerCapture(id))overlay.current.releasePointerCapture(id)}catch{}}
  const applyPan=()=>{
    const current=state.current,pan=current.pan,element=viewer.current
    cancelAnimationFrame(current.frame);current.frame=0
    if(!pan||!element)return
    const dx=pan.dx,dy=pan.dy;pan.dx=0;pan.dy=0
    if(dx===0&&dy===0)return
    const x=element.scrollLeft,y=element.scrollTop
    element.scrollLeft=x+dx;element.scrollTop=y+dy
    const now=performance.now(),dt=Math.max(8,now-pan.appliedAt)
    pan.vx=.45*pan.vx+.55*clamp((element.scrollLeft-x)/dt,-2.5,2.5)
    pan.vy=.45*pan.vy+.55*clamp((element.scrollTop-y)/dt,-2.5,2.5)
    pan.appliedAt=now
  }
  const cancelInk=()=>{
    const current=state.current
    cancelTimer()
    if(current.draw!==null){current.draw=null;latest.current.resetAnnotation({rollbackTouch:true});if(current.pen===null)report('idle')}
  }
  const rebasePan=()=>{
    applyPan()
    const current=state.current,previous=current.pan,items=contacts()
    if(!items.length){current.pan=null;return}
    const point=center(items)
    items.forEach(contact=>{contact.role='pan';capture(contact.id)})
    current.pan={last:point,start:point,dx:0,dy:0,vx:previous?.vx||0,vy:previous?.vy||0,appliedAt:performance.now(),updatedAt:previous?.updatedAt||performance.now(),moved:previous?.moved||false}
  }
  const updatePan=()=>{
    const current=state.current,pan=current.pan,items=contacts()
    if(!pan||!items.length)return
    const point=center(items)
    if(!pan.moved){
      if(Math.hypot(point.x-pan.start.x,point.y-pan.start.y)<PAN_SLOP)return
      pan.moved=true;report('scrolling')
    }
    const dx=pan.last.x-point.x,dy=pan.last.y-point.y
    if(dx===0&&dy===0)return
    pan.dx+=dx;pan.dy+=dy;pan.last=point;pan.updatedAt=performance.now()
    if(!current.frame)current.frame=requestAnimationFrame(applyPan)
  }
  const momentum=pan=>{
    if(!pan?.moved||performance.now()-pan.updatedAt>90)return
    let vx=pan.vx,vy=pan.vy,last=performance.now()
    if(Math.hypot(vx,vy)<.12)return
    const tick=now=>{
      const element=viewer.current
      if(!element||state.current.contacts.size||state.current.pen!==null)return
      const dt=Math.min(32,now-last);last=now
      const x=element.scrollLeft,y=element.scrollTop
      element.scrollLeft=x+vx*dt;element.scrollTop=y+vy*dt
      if(Math.abs(element.scrollLeft-x)<.1)vx=0
      if(Math.abs(element.scrollTop-y)<.1)vy=0
      const friction=Math.exp(-dt/135);vx*=friction;vy*=friction
      if(Math.hypot(vx,vy)>.025)state.current.inertia=requestAnimationFrame(tick)
      else{state.current.inertia=0;report('idle')}
    }
    report('scrolling');state.current.inertia=requestAnimationFrame(tick)
  }
  const startInk=contact=>{
    if(!contact||contact.role!=='pending'||state.current.pen!==null)return
    cancelTimer();contact.role='ink';state.current.draw=contact.id
    latest.current.beginTouchAnnotation?.(contact.id)
    latest.current.onDrawStart({...contact.start,type:'pointerdown'})
    for(const event of contact.buffer)latest.current.onDrawMove(event)
    contact.buffer=[];report('drawing')
  }
  const isPalm=event=>{
    const w=event.width||1,h=event.height||1,major=Math.max(w,h),minor=Math.min(w,h)
    return {strong:w*h>=2400||(major>=80&&minor>=25),suspect:w*h>=1500||(major>=45&&major/minor>=3&&w*h>=700)}
  }
  const reset=(notify=true)=>{
    const current=state.current
    cancelTimer();cancelInk();stopInertia();cancelAnimationFrame(current.frame);current.frame=0;current.pan=null
    const ids=[...current.contacts.keys()];if(current.pen!==null)ids.push(current.pen)
    current.contacts.clear();current.controls.clear();current.pen=null
    ids.forEach(release)
    if(notify)latest.current.resetAnnotation()
    report('idle')
  }
  const ownPen=id=>{
    const current=state.current
    stopInertia();cancelInk();cancelAnimationFrame(current.frame);current.frame=0;current.pan=null
    current.contacts.forEach(contact=>{contact.role='rejected'})
    latest.current.resetAnnotation();current.pen=id;report('pen')
  }
  const finish=(event,canceled=false)=>{
    const current=state.current,id=event.pointerId
    if(current.controls.delete(id))return
    if(event.pointerType==='pen'){
      if(current.pen!==id)return
      current.pen=null;current.lastPenUp=performance.now();report('idle')
      if(canceled)latest.current.resetAnnotation()
      return
    }
    if(event.pointerType!=='touch')return
    const contact=current.contacts.get(id)
    if(!contact)return
    if(!canceled){contact.x=event.clientX;contact.y=event.clientY}
    const forwarded=contact.role==='interaction'
    if(!forwarded)consume(event)
    if(canceled){
      if(current.draw===id)cancelInk()
      suppressClick()
    }else if(contact.role==='pending'||contact.role==='ink'){
      if(contact.role==='pending')startInk(contact)
      latest.current.onDrawMove({...sample(event),type:'pointermove'})
      latest.current.onDrawEnd({...sample(event),type:'pointerup'})
      current.draw=null;latest.current.endTouchAnnotation?.(id);suppressClick()
    }else if(forwarded){
      current.draw=null
      // Descendant text/move handlers must finish before releasing their snapshot.
      queueMicrotask(()=>latest.current.endTouchAnnotation?.(id))
    }
    if(contact.role==='pan'&&!canceled)updatePan()
    applyPan()
    const previousPan=current.pan
    current.contacts.delete(id);release(id)
    if(contact.role==='pan'){
      suppressClick()
      if(contacts().length)rebasePan()
      else{current.pan=null;if(!canceled)momentum(previousPan)}
    }
    if(!current.contacts.size&&!current.inertia&&current.pen===null)report('idle')
  }
  const handlers={
    onClickCapture:event=>{if(event.detail!==0&&performance.now()<state.current.blockedUntil)consume(event)},
    onContextMenuCapture:event=>{if(state.current.contacts.size||state.current.pen!==null)consume(event)},
    onPointerDownCapture:event=>{
      const current=state.current,id=event.pointerId
      stopInertia()
      if(event.target.closest?.(CONTROL)){
        if(event.pointerType==='touch'&&(current.pen!==null||isPalm(event).strong)){
          current.contacts.set(id,{id,x:event.clientX,y:event.clientY,role:'rejected'});consume(event);return
        }
        current.controls.add(id);return
      }
      if(event.pointerType==='mouse'){
        if(current.pen!==null||contacts().length)consume(event)
        return
      }
      if(event.pointerType==='pen'){
        if(current.pen!==null&&current.pen!==id){consume(event);return}
        ownPen(id);return
      }
      if(event.pointerType!=='touch')return
      const geometry=isPalm(event)
      const rejected=geometry.strong||current.pen!==null||performance.now()-current.lastPenUp<160
      const contact={id,x:event.clientX,y:event.clientY,role:rejected?'rejected':'pending',start:sample(event),startedAt:performance.now(),buffer:[],palmCount:geometry.suspect?1:0}
      current.contacts.set(id,contact)
      if(rejected){consume(event);return}
      const eligible=contacts()
      if(latest.current.scrollWithFinger||eligible.length>1||current.pan||!latest.current.canDrawTouch(event)){
        // Text and object manipulation still use their existing interaction tools.
        if(!latest.current.scrollWithFinger&&eligible.length===1&&!current.pan&&overlay.current?.contains(event.target)&&!latest.current.canDrawTouch(event)){
          contact.role='interaction';current.draw=id;latest.current.beginTouchAnnotation?.(id);return
        }
        consume(event);cancelInk();rebasePan();return
      }
      consume(event);capture(id)
      current.timer=setTimeout(()=>{if(current.contacts.get(id)===contact&&contacts().length===1)startInk(contact)},FINGER_DECISION_MS)
    },
    onPointerMoveCapture:event=>{
      const current=state.current,id=event.pointerId
      if(current.controls.has(id))return
      if(event.pointerType==='pen'){
        if(current.pen!==null&&current.pen!==id)consume(event)
        else if(current.pen===null&&event.buttons!==0)ownPen(id)
        return
      }
      if(event.pointerType!=='touch')return
      const contact=current.contacts.get(id)
      if(!contact){if(current.pen!==null||current.draw!==null)consume(event);return}
      const geometry=isPalm(event)
      contact.palmCount=geometry.suspect?contact.palmCount+1:0
      if(contact.role!=='rejected'&&(geometry.strong||contact.palmCount>=3||current.pen!==null)){
        if(current.draw===id)cancelInk()
        const wasPan=contact.role==='pan';contact.role='rejected'
        if(wasPan)rebasePan()
      }
      contact.x=event.clientX;contact.y=event.clientY
      if(contact.role==='rejected'){consume(event);return}
      if(contact.role==='interaction')return
      consume(event)
      if(contact.role==='pan'){updatePan();return}
      if(contact.role==='pending'){
        contact.buffer.push({...sample(event),type:'pointermove'})
        if(performance.now()-contact.startedAt>=FINGER_DECISION_MS)startInk(contact)
      }else if(contact.role==='ink')latest.current.onDrawMove(sample(event))
    },
    onPointerUpCapture:event=>finish(event),
    onPointerCancelCapture:event=>finish(event,true),
    onLostPointerCaptureCapture:event=>{
      const id=event.pointerId,target=event.target
      // A move from implicit child capture to the overlay/viewer is expected.
      queueMicrotask(()=>{
        const contact=state.current.contacts.get(id)
        if(!contact&&state.current.pen!==id)return
        const captured=viewer.current?.hasPointerCapture(id)||overlay.current?.hasPointerCapture(id)||target?.hasPointerCapture?.(id)
        if(!captured)finish(event,true)
      })
    },
    onWheelCapture:()=>{stopInertia();if(!state.current.contacts.size&&state.current.pen===null)report('idle')}
  }
  useEffect(()=>{
    state.current.mounted=true
    const cancel=()=>reset()
    const hidden=()=>{if(document.hidden)cancel()}
    const outsideEnd=event=>{
      // Handles lift-off outside the viewer when capture was unavailable.
      queueMicrotask(()=>{state.current.controls.delete(event.pointerId);if(state.current.contacts.has(event.pointerId)||state.current.pen===event.pointerId)finish(event,true)})
    }
    window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',hidden)
    document.addEventListener('pointerup',outsideEnd,true);document.addEventListener('pointercancel',outsideEnd,true)
    return()=>{
      const current=state.current
      current.mounted=false;cancelTimer();stopInertia();cancelAnimationFrame(current.frame)
      const ids=[...current.contacts.keys()];if(current.pen!==null)ids.push(current.pen)
      current.contacts.clear();current.controls.clear();current.draw=null;current.pen=null;current.pan=null
      ids.forEach(release)
      window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden)
      document.removeEventListener('pointerup',outsideEnd,true);document.removeEventListener('pointercancel',outsideEnd,true)
    }
  },[])
  useEffect(()=>{reset()},[scrollWithFinger,resetKey])
  return {handlers,activity}
}
