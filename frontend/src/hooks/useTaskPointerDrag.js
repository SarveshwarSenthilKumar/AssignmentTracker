import { useEffect, useRef } from 'react'

// Animate drag visuals without re-rendering the task list on pointer movement.
export default function useTaskPointerDrag({onDrop,enabled}) {
  const latest=useRef(null),gesture=useRef(null),ignoreClickUntil=useRef(0),cancelRef=useRef(null)
  latest.current={onDrop,enabled}
  useEffect(()=>{if(!enabled)cancelRef.current?.()},[enabled])
  useEffect(()=>{
    let frame=null
    const targetAt=current=>{
      const element=document.elementFromPoint(current.x,current.y),column=element?.closest('[data-task-status]')
      if(!column)return null
      const card=element.closest('[data-task-id]')
      if(card===current.element)return null
      if(!card)return {column,id:null,status:column.dataset.taskStatus,position:'after',rect:column.getBoundingClientRect()}
      const rect=card.getBoundingClientRect(),middle=rect.top+rect.height/2,previous=current.destination
      const position=previous?.id===card.dataset.taskId&&Math.abs(current.y-middle)<7?previous.position:current.y<middle?'before':'after'
      return {column,id:card.dataset.taskId,status:column.dataset.taskStatus,position,rect}
    }
    const schedule=()=>{if(frame===null)frame=requestAnimationFrame(paint)}
    function paint(time){
      frame=null
      const current=gesture.current;if(!current?.active)return
      const elapsed=Math.min(32,current.time?time-current.time:16);current.time=time
      const height=window.innerHeight,width=window.innerWidth,edge=Math.min(110,height*.18)
      const top=Math.max(0,Math.min(height*.25,current.header?.getBoundingClientRect().bottom||0))
      let velocity=0
      if(performance.now()>current.manualUntil){
        if(current.y<top+edge)velocity=-Math.min(1,Math.max(0,(top+edge-current.y)/edge))*600
        else if(current.y>height-edge)velocity=Math.min(1,(current.y-height+edge)/edge)*600
      }
      current.velocity+=(velocity-current.velocity)*Math.min(1,elapsed/90)
      let scrolled=false
      if(Math.abs(current.velocity)>2){const before=window.scrollY;window.scrollBy({top:current.velocity*elapsed/1000,behavior:'instant'});scrolled=before!==window.scrollY}
      const destination=targetAt(current);current.destination=destination
      const x=Math.max(8,Math.min(width-current.previewWidth-8,current.x+18)),y=Math.max(8,Math.min(height-82,current.y+18))
      if(current.column!==destination?.column){current.column?.classList.remove('task-column-target');current.column=destination?.column||null;current.column?.classList.add('task-column-target')}
      current.preview.style.transform=`translate3d(${x}px,${y}px,0)`
      if(destination){
        const rect=destination.rect,lineY=destination.id?(destination.position==='before'?rect.top-4:rect.bottom+4):rect.bottom-8
        current.indicator.hidden=false;current.indicator.style.width=`${Math.max(0,rect.width)}px`;current.indicator.style.transform=`translate3d(${rect.left}px,${lineY}px,0)`
      }else current.indicator.hidden=true
      if(scrolled)schedule()
    }
    const finish=(cancel=false)=>{
      const current=gesture.current;if(!current)return
      const destination=current.active&&!cancel?targetAt(current):null
      gesture.current=null
      if(frame!==null){cancelAnimationFrame(frame);frame=null}
      if(current.element.hasPointerCapture?.(current.pointerId))current.element.releasePointerCapture(current.pointerId)
      if(current.active){
        document.documentElement.style.userSelect=current.selection;document.documentElement.style.cursor=current.cursor
        document.documentElement.classList.remove('task-drag-active');current.element.classList.remove('is-task-dragging');current.column?.classList.remove('task-column-target')
        current.preview.remove();current.indicator.remove();ignoreClickUntil.current=performance.now()+250
        if(destination)latest.current.onDrop(current.task,{id:destination.id,status:destination.status,position:destination.position})
      }
    }
    const activate=current=>{
      current.active=true;current.velocity=0;current.manualUntil=0;current.header=document.querySelector('.platform-header')
      current.selection=document.documentElement.style.userSelect;current.cursor=document.documentElement.style.cursor
      document.documentElement.style.userSelect='none';document.documentElement.style.cursor='grabbing'
      document.documentElement.classList.add('task-drag-active');current.element.classList.add('is-task-dragging')
      const preview=document.createElement('div');preview.className='task-drag-preview';preview.setAttribute('aria-hidden','true')
      const title=document.createElement('strong');title.textContent=current.task.text
      const hint=document.createElement('span');hint.textContent='Move task · Scroll to navigate · Esc to cancel';preview.append(title,hint)
      current.previewWidth=Math.max(150,Math.min(310,window.innerWidth-24));preview.style.width=`${current.previewWidth}px`
      const indicator=document.createElement('div');indicator.className='task-drag-indicator';indicator.setAttribute('aria-hidden','true');indicator.hidden=true
      document.body.append(preview,indicator);current.preview=preview;current.indicator=indicator
    }
    const move=event=>{
      const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return
      current.x=event.clientX;current.y=event.clientY
      if(!current.active&&Math.hypot(current.x-current.startX,current.y-current.startY)>=7)activate(current)
      if(current.active){if(event.cancelable)event.preventDefault();schedule()}
    }
    const up=event=>{if(gesture.current?.pointerId===event.pointerId){gesture.current.x=event.clientX;gesture.current.y=event.clientY;finish()}}
    const cancel=()=>finish(true)
    cancelRef.current=cancel
    const key=event=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopImmediatePropagation();cancel()}}
    const click=event=>{if(performance.now()<ignoreClickUntil.current){event.preventDefault();event.stopImmediatePropagation()}}
    const hidden=()=>{if(document.hidden)cancel()}
    const scroll=()=>{if(gesture.current?.active)schedule()}
    const wheel=event=>{if(gesture.current?.active&&!event.ctrlKey&&!event.metaKey){gesture.current.manualUntil=performance.now()+1000;gesture.current.velocity=0;schedule()}}
    window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel)
    window.addEventListener('scroll',scroll,true);window.addEventListener('resize',scroll);window.addEventListener('wheel',wheel,{passive:true,capture:true})
    window.addEventListener('blur',cancel);window.addEventListener('keydown',key,true);window.addEventListener('click',click,true);document.addEventListener('visibilitychange',hidden)
    return()=>{cancel();window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);window.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',scroll);window.removeEventListener('wheel',wheel,true);window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key,true);window.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',hidden)}
  },[])
  return (event,task)=>{
    if(!latest.current.enabled||gesture.current||event.button!==0||event.isPrimary===false||event.pointerType==='touch'||event.target.closest('button,input,textarea,select,a,[contenteditable=true]'))return
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current={task,element:event.currentTarget,pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,active:false}
  }
}
