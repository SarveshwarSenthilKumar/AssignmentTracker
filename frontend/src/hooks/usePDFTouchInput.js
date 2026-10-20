import { useEffect, useRef } from 'react'

// One owner per gesture: pen, finger annotation, or a tracked touch pan.
export default function usePDFTouchInput({viewer,scrollWithFinger,resetAnnotation,beginTouchAnnotation,endTouchAnnotation,resetKey}){
  const state=useRef({touches:new Map(),pen:null,lastPenUp:-Infinity,lastBlocked:-Infinity,frame:0,pan:null,draw:null})
  const latest=useRef(null);latest.current={resetAnnotation,beginTouchAnnotation,endTouchAnnotation,scrollWithFinger}
  const block=event=>{event.preventDefault();event.stopPropagation()}
  // Large/elongated contacts are evidence of a palm. Missing contact geometry
  // (often 1x1) is not evidence of either a palm or a pen.
  const palm=event=>{
    const w=event.width||1,h=event.height||1,large=Math.max(w,h),small=Math.min(w,h)
    return large>=55||w*h>=1800||(large>=34&&large/small>=2.8&&w*h>=650)
  }
  const valid=()=>[...state.current.touches.values()].filter(contact=>!contact.rejected)
  const centroid=contacts=>({x:contacts.reduce((sum,c)=>sum+c.x,0)/contacts.length,y:contacts.reduce((sum,c)=>sum+c.y,0)/contacts.length})
  const flush=()=>{
    const current=state.current,pan=current.pan,element=viewer.current
    if(pan?.moved&&element){element.scrollLeft=pan.left+pan.startX-pan.x;element.scrollTop=pan.top+pan.startY-pan.y}
    cancelAnimationFrame(current.frame);current.frame=0
  }
  const stop=()=>{flush();state.current.pan=null}
  const cancelDraw=()=>{
    if(state.current.draw!==null){state.current.draw=null;latest.current.resetAnnotation({rollbackTouch:true})}
  }
  const rebasePan=()=>{
    stop()
    const contacts=valid(),element=viewer.current
    if(!contacts.length||!element)return
    const point=centroid(contacts)
    contacts.forEach(contact=>{contact.mode='pan'})
    state.current.pan={startX:point.x,startY:point.y,...point,left:element.scrollLeft,top:element.scrollTop,moved:false}
  }
  const reset=()=>{
    stop();cancelDraw();state.current.touches.clear();state.current.pen=null
    latest.current.resetAnnotation()
  }
  useEffect(()=>{
    const hidden=()=>{if(document.hidden)reset()}
    window.addEventListener('blur',reset);document.addEventListener('visibilitychange',hidden)
    return()=>{window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);cancelAnimationFrame(state.current.frame)}
  },[])
  useEffect(()=>{reset()},[scrollWithFinger,resetKey])
  const reject=(id)=>{
    const contact=state.current.touches.get(id)
    if(!contact)return
    contact.rejected=true
    if(state.current.draw===id)cancelDraw()
    if(contact.mode==='pan')rebasePan()
  }
  const handlers={
    onClickCapture:event=>{if(event.detail!==0&&performance.now()-state.current.lastBlocked<400)block(event)},
    onContextMenuCapture:event=>{if(state.current.touches.size||state.current.pen!==null)block(event)},
    // Hover intentionally does not suppress fingers or cancel their gestures.
    onPointerOverCapture:()=>{},
    onPointerDownCapture:event=>{
      const current=state.current
      if(event.pointerType==='pen'){
        if(current.pen!==null&&current.pen!==event.pointerId){block(event);return}
        stop();cancelDraw();current.touches.forEach(contact=>{contact.rejected=true})
        latest.current.resetAnnotation();current.pen=event.pointerId;return
      }
      if(event.pointerType!=='touch')return
      const rejected=palm(event)||current.pen!==null||performance.now()-current.lastPenUp<220
      const contact={id:event.pointerId,x:event.clientX,y:event.clientY,rejected,mode:'draw'}
      current.touches.set(event.pointerId,contact)
      if(rejected){block(event);return}
      const contacts=valid()
      if(latest.current.scrollWithFinger||contacts.length>1||current.pan){
        block(event);cancelDraw();rebasePan()
        viewer.current?.setPointerCapture?.(event.pointerId);return
      }
      latest.current.beginTouchAnnotation?.();current.draw=event.pointerId
    },
    onPointerMoveCapture:event=>{
      const current=state.current
      if(event.pointerType==='pen'){
        if(current.pen!==null&&current.pen!==event.pointerId)block(event)
        return
      }
      if(event.pointerType!=='touch')return
      const contact=current.touches.get(event.pointerId)
      if(!contact){block(event);return}
      if(!contact.rejected&&(palm(event)||current.pen!==null))reject(event.pointerId)
      if(contact.rejected){block(event);return}
      contact.x=event.clientX;contact.y=event.clientY
      if(contact.mode==='draw'){
        if(current.draw!==event.pointerId)block(event)
        return
      }
      block(event)
      const pan=current.pan
      if(!pan)return
      Object.assign(pan,centroid(valid()))
      if(!pan.moved&&Math.hypot(pan.x-pan.startX,pan.y-pan.startY)<4)return
      pan.moved=true
      if(!current.frame)current.frame=requestAnimationFrame(()=>{current.frame=0;flush()})
    }
  }
  const finish=(event,lost=false)=>{
    const current=state.current
    if(event.pointerType==='pen'){
      if(current.pen===event.pointerId){current.pen=null;current.lastPenUp=performance.now()}
      return
    }
    if(event.pointerType!=='touch')return
    const contact=current.touches.get(event.pointerId)
    if(!contact){block(event);return}
    const wasDraw=current.draw===event.pointerId&&!contact.rejected&&contact.mode==='draw'
    if(wasDraw){
      if(lost||event.type==='pointercancel')cancelDraw()
      else{current.draw=null;latest.current.endTouchAnnotation?.()}
    }
    if(contact.mode==='pan')flush()
    current.touches.delete(event.pointerId)
    if(contact.mode==='pan')rebasePan()
    if(!wasDraw||lost||event.type==='pointercancel'){
      current.lastBlocked=performance.now();block(event)
      if(viewer.current?.hasPointerCapture(event.pointerId))viewer.current.releasePointerCapture(event.pointerId)
    }
  }
  handlers.onPointerUpCapture=finish;handlers.onPointerCancelCapture=finish
  handlers.onLostPointerCaptureCapture=event=>{
    if(state.current.touches.has(event.pointerId))finish(event,true)
    else if(state.current.pen===event.pointerId&&event.target===viewer.current){
      state.current.pen=null;state.current.lastPenUp=performance.now();latest.current.resetAnnotation()
    }
  }
  return handlers
}
