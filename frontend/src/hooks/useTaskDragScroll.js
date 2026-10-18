import { useEffect } from 'react'

export default function useTaskDragScroll(active) {
  useEffect(()=>{
    if(!active)return
    let frame=null, pointerY=null, previousTime=null, manualUntil=0
    const stop=()=>{
      if(frame!==null)cancelAnimationFrame(frame)
      frame=null;pointerY=null;previousTime=null
    }
    const tick=time=>{
      frame=null
      if(pointerY===null){stop();return}
      const height=window.innerHeight,edge=Math.min(140,height*.22)
      const header=document.querySelector('.platform-header')
      const top=header?Math.max(0,Math.min(height*.3,header.getBoundingClientRect().bottom)):0
      let speed=0
      if(pointerY<top+edge)speed=-Math.min(1,Math.max(0,(top+edge-pointerY)/edge))
      else if(pointerY>height-edge)speed=Math.min(1,(pointerY-(height-edge))/edge)
      const elapsed=previousTime===null?16:Math.min(40,time-previousTime)
      previousTime=time
      if(speed&&performance.now()>=manualUntil)window.scrollBy({top:speed*900*elapsed/1000,behavior:'instant'})
      frame=requestAnimationFrame(tick)
    }
    const move=event=>{
      pointerY=event.clientY
      if(frame===null)frame=requestAnimationFrame(tick)
    }
    const hidden=()=>{if(document.hidden)stop()}
    const wheel=event=>{
      // Preserve browser zoom gestures and let wheel/trackpad input override
      // edge scrolling, even if the dragged card is held at the opposite edge.
      if(event.ctrlKey||event.metaKey)return
      manualUntil=performance.now()+1000
      previousTime=null
      // Pointer dragging keeps native wheel/trackpad scrolling available.
      // Do not preventDefault or apply a second scroll delta here.
    }
    document.addEventListener('pointermove',move,true)
    document.addEventListener('pointerup',stop,true)
    document.addEventListener('pointercancel',stop,true)
    document.addEventListener('visibilitychange',hidden)
    window.addEventListener('wheel',wheel,{capture:true,passive:true})
    window.addEventListener('blur',stop)
    return()=>{
      stop()
      document.removeEventListener('pointermove',move,true)
      document.removeEventListener('pointerup',stop,true)
      document.removeEventListener('pointercancel',stop,true)
      document.removeEventListener('visibilitychange',hidden)
      window.removeEventListener('wheel',wheel,true)
      window.removeEventListener('blur',stop)
    }
  },[active])
}
