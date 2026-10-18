import { useEffect, useRef } from 'react'

export default function useTaskPointerDrag({onStart,onHover,onDrop,onEnd,enabled}) {
  const latest=useRef(null),gesture=useRef(null),ignoreClickUntil=useRef(0)
  latest.current={onStart,onHover,onDrop,onEnd,enabled}
  useEffect(()=>{
    const targetAt=(x,y)=>{
      const element=document.elementFromPoint(x,y)
      const column=element?.closest('[data-task-status]')
      if(!column)return null
      const card=element.closest('[data-task-id]')
      const rect=card?.getBoundingClientRect()
      return {id:card?.dataset.taskId||null,status:column.dataset.taskStatus,position:rect&&y<rect.top+rect.height/2?'before':'after'}
    }
    const refresh=()=>{const current=gesture.current;if(current?.active)latest.current.onHover(targetAt(current.x,current.y))}
    const finish=(cancel=false)=>{
      const current=gesture.current;if(!current)return
      const destination=current.active&&!cancel?targetAt(current.x,current.y):null
      gesture.current=null
      if(current.element.hasPointerCapture?.(current.pointerId))current.element.releasePointerCapture(current.pointerId)
      if(current.active){
        document.documentElement.style.userSelect=current.selection
        document.documentElement.style.cursor=current.cursor
        ignoreClickUntil.current=performance.now()+350
        latest.current.onEnd()
        if(destination)latest.current.onDrop(current.task,destination)
      }
    }
    const move=event=>{
      const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return
      current.x=event.clientX;current.y=event.clientY
      if(!current.active&&Math.hypot(current.x-current.startX,current.y-current.startY)>=6){
        current.active=true
        current.selection=document.documentElement.style.userSelect
        current.cursor=document.documentElement.style.cursor
        document.documentElement.style.userSelect='none';document.documentElement.style.cursor='grabbing'
        latest.current.onStart(current.task)
      }
      if(current.active){if(event.cancelable)event.preventDefault();refresh()}
    }
    const up=event=>{if(gesture.current?.pointerId===event.pointerId){gesture.current.x=event.clientX;gesture.current.y=event.clientY;finish()}}
    const cancel=()=>finish(true)
    const key=event=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopImmediatePropagation();cancel()}}
    const click=event=>{if(performance.now()<ignoreClickUntil.current){event.preventDefault();event.stopImmediatePropagation()}}
    const hidden=()=>{if(document.hidden)cancel()}
    window.addEventListener('pointermove',move,{passive:false})
    window.addEventListener('pointerup',up)
    window.addEventListener('pointercancel',cancel)
    window.addEventListener('scroll',refresh,true)
    window.addEventListener('blur',cancel)
    window.addEventListener('keydown',key,true)
    window.addEventListener('click',click,true)
    document.addEventListener('visibilitychange',hidden)
    return()=>{
      cancel();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('scroll',refresh,true);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);window.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',hidden)
    }
  },[])
  return (event,task)=>{
    if(!latest.current.enabled||gesture.current||event.button!==0||event.isPrimary===false||event.pointerType==='touch'||event.target.closest('button,input,textarea,select,a,[contenteditable=true]'))return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current={task,element:event.currentTarget,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false}
  }
}
