import { useEffect, useRef } from 'react'

// Own touch panning so rejected contacts cannot trigger native browser scrolling.
export default function usePDFTouchInput({viewer,scrollWithFinger,resetAnnotation,resetKey}){
  const state=useRef({touches:new Map(),pen:null,lastPen:-Infinity,lastBlocked:-Infinity,frame:0,gesture:null})
  const latest=useRef(null);latest.current={resetAnnotation,scrollWithFinger}
  const stop=()=>{
    const current=state.current
    cancelAnimationFrame(current.frame);current.frame=0;current.gesture=null
  }
  const reset=()=>{
    stop();state.current.touches.clear();state.current.pen=null
    latest.current.resetAnnotation()
  }
  useEffect(()=>{
    window.addEventListener('blur',reset)
    const hidden=()=>{if(document.hidden)reset()}
    document.addEventListener('visibilitychange',hidden)
    return()=>{window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',hidden);stop()}
  },[])
  useEffect(()=>{reset()},[scrollWithFinger,resetKey])
  const block=event=>{event.preventDefault();event.stopPropagation()}
  const palm=event=>Math.max(event.width||0,event.height||0)>=38||
    ((event.width||0)*(event.height||0)>=700)
  const penNearby=()=>state.current.pen!==null||performance.now()-state.current.lastPen<800
  const handlers={
    onClickCapture:event=>{
      if(event.detail!==0&&performance.now()-state.current.lastBlocked<400)block(event)
    },
    onContextMenuCapture:event=>{
      if(state.current.touches.size||state.current.pen!==null)block(event)
    },
    onPointerOverCapture:event=>{
      if(event.pointerType==='pen'){state.current.lastPen=performance.now();stop()}
    },
    onPointerDownCapture:event=>{
      const current=state.current
      if(event.pointerType==='pen'){
        stop();latest.current.resetAnnotation();current.pen=event.pointerId;current.lastPen=performance.now();return
      }
      if(event.pointerType!=='touch')return
      const rejected=palm(event)||penNearby()
      current.touches.set(event.pointerId,{rejected})
      if(rejected){block(event);return}
      if(!latest.current.scrollWithFinger){
        if(current.touches.size>1){current.touches.get(event.pointerId).rejected=true;block(event)}
        return
      }
      block(event)
      if(current.touches.size!==1){stop();return}
      latest.current.resetAnnotation()
      const element=viewer.current
      if(!element)return
      current.gesture={id:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,left:element.scrollLeft,top:element.scrollTop,moved:false}
      element.setPointerCapture?.(event.pointerId)
    },
    onPointerMoveCapture:event=>{
      const current=state.current
      if(event.pointerType==='pen'){current.lastPen=performance.now();return}
      if(event.pointerType!=='touch')return
      const contact=current.touches.get(event.pointerId)
      if(!contact||palm(event)||penNearby()||contact.rejected){
        if(contact)contact.rejected=true
        stop();block(event);return
      }
      if(!latest.current.scrollWithFinger)return
      block(event)
      const gesture=current.gesture
      if(!gesture||gesture.id!==event.pointerId)return
      gesture.x=event.clientX;gesture.y=event.clientY
      if(!gesture.moved&&Math.hypot(gesture.x-gesture.startX,gesture.y-gesture.startY)<5)return
      gesture.moved=true
      if(current.frame)return
      current.frame=requestAnimationFrame(()=>{
        current.frame=0
        if(current.gesture!==gesture||!viewer.current)return
        viewer.current.scrollLeft=gesture.left+gesture.startX-gesture.x
        viewer.current.scrollTop=gesture.top+gesture.startY-gesture.y
      })
    },
  }
  const finish=event=>{
    const current=state.current
    if(event.pointerType==='pen'){
      current.pen=null;current.lastPen=performance.now();return
    }
    if(event.pointerType!=='touch')return
    const contact=current.touches.get(event.pointerId)
    current.touches.delete(event.pointerId)
    if(latest.current.scrollWithFinger||!contact||contact.rejected||penNearby()){
      current.lastBlocked=performance.now()
      const gesture=current.gesture
      if(gesture?.id===event.pointerId){
        if(gesture.moved&&event.type!=='pointercancel'&&viewer.current){
          viewer.current.scrollLeft=gesture.left+gesture.startX-event.clientX
          viewer.current.scrollTop=gesture.top+gesture.startY-event.clientY
        }
        stop()
      }
      if(viewer.current?.hasPointerCapture(event.pointerId))viewer.current.releasePointerCapture(event.pointerId)
      block(event)
    }
  }
  handlers.onPointerUpCapture=finish;handlers.onPointerCancelCapture=finish
  handlers.onLostPointerCaptureCapture=event=>{
    if(state.current.gesture?.id===event.pointerId)stop()
  }
  return handlers
}
