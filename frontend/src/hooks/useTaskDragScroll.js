import { useEffect } from 'react'

export default function useTaskDragScroll(active) {
  useEffect(()=>{
    if(!active)return
    let frame=null, pointerY=null, previousTime=null, lastOver=0
    const stop=()=>{
      if(frame!==null)cancelAnimationFrame(frame)
      frame=null;pointerY=null;previousTime=null
    }
    const tick=time=>{
      frame=null
      if(pointerY===null||performance.now()-lastOver>800){stop();return}
      const height=window.innerHeight,edge=Math.min(140,height*.22)
      const header=document.querySelector('.platform-header')
      const top=header?Math.max(0,Math.min(height*.3,header.getBoundingClientRect().bottom)):0
      let speed=0
      if(pointerY<top+edge)speed=-Math.min(1,Math.max(0,(top+edge-pointerY)/edge))
      else if(pointerY>height-edge)speed=Math.min(1,(pointerY-(height-edge))/edge)
      const elapsed=previousTime===null?16:Math.min(40,time-previousTime)
      previousTime=time
      if(speed)window.scrollBy({top:speed*900*elapsed/1000,behavior:'instant'})
      frame=requestAnimationFrame(tick)
    }
    const move=event=>{
      pointerY=event.clientY;lastOver=performance.now()
      if(frame===null)frame=requestAnimationFrame(tick)
    }
    const leave=event=>{if(!event.relatedTarget)stop()}
    const hidden=()=>{if(document.hidden)stop()}
    // Capture before task cards stop propagation for their insertion indicators.
    document.addEventListener('dragover',move,true)
    document.addEventListener('drop',stop,true)
    document.addEventListener('dragend',stop,true)
    document.addEventListener('dragleave',leave,true)
    document.addEventListener('visibilitychange',hidden)
    window.addEventListener('blur',stop)
    return()=>{
      stop()
      document.removeEventListener('dragover',move,true)
      document.removeEventListener('drop',stop,true)
      document.removeEventListener('dragend',stop,true)
      document.removeEventListener('dragleave',leave,true)
      document.removeEventListener('visibilitychange',hidden)
      window.removeEventListener('blur',stop)
    }
  },[active])
}
