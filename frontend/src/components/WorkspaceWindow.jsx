import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { X, Minus, Maximize2, Minimize2, Plus, GripVertical, ArrowUpRight, Layers } from 'lucide-react'
import { TOOLS } from '../lib/workspace'

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value))
export function fitWindow(win,bounds){
  const width=Math.min(bounds.width,Math.max(280,win.width)),height=Math.min(bounds.height,Math.max(220,win.height))
  return {width,height,x:clamp(win.x,0,bounds.width-width),y:clamp(win.y,0,bounds.height-height)}
}
export default function WorkspaceWindow({win,bounds,active,zIndex,snap,locked,mobile,onFocus,onChange,onClose,onAddPane,onClosePane,onDetach,onMovePane,onDropPane,renderPane}){
  const element=useRef(null),gesture=useRef(null),frame=useRef(null),[dragging,setDragging]=useState(false),[preview,setPreview]=useState(null)
  const rect=win.maximized?{x:0,y:0,width:bounds.width,height:Math.min(bounds.height,bounds.visibleHeight)}:fitWindow(win,bounds)
  const apply=value=>{if(!element.current)return;for(const [key,number]of Object.entries(value))element.current.style.setProperty(`--window-${key}`,`${number}px`)}
  const finish=(cancel=false)=>{
    const current=gesture.current;if(!current)return
    if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null}
    gesture.current=null;setDragging(false);setPreview(null)
    document.documentElement.style.userSelect=current.selection;document.documentElement.style.cursor=current.cursor
    try{if(current.target.hasPointerCapture(current.pointerId))current.target.releasePointerCapture(current.pointerId)}catch{}
    if(cancel)apply(current.start);else onChange({...current.next,...(current.snapRect||{}),maximized:false})
  }
  useLayoutEffect(()=>{if(!gesture.current)apply(rect)},[win.x,win.y,win.width,win.height,win.maximized,bounds.width,bounds.height,bounds.visibleHeight])
  useEffect(()=>{
    const cancel=event=>{if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopImmediatePropagation();finish(true)}}
    const blur=()=>finish()
    window.addEventListener('keydown',cancel,true);window.addEventListener('blur',blur)
    return()=>{finish(true);window.removeEventListener('keydown',cancel,true);window.removeEventListener('blur',blur)}
  },[])
  const begin=(event,direction)=>{
    if(locked||mobile||win.maximized||event.button!==0||event.isPrimary===false||event.target.closest('button,input,select,a,textarea')&&direction==='move')return
    event.preventDefault();event.stopPropagation();onFocus()
    gesture.current={start:{...rect},next:{...rect},x:event.clientX,y:event.clientY,direction,pointerId:event.pointerId,target:event.currentTarget,selection:document.documentElement.style.userSelect,cursor:document.documentElement.style.cursor}
    event.currentTarget.setPointerCapture(event.pointerId);document.documentElement.style.userSelect='none';document.documentElement.style.cursor=direction==='move'?'grabbing':`${direction}-resize`;setDragging(true)
  }
  const move=event=>{
    const current=gesture.current;if(!current||event.pointerId!==current.pointerId)return
    const {start,direction}=current,dx=event.clientX-current.x,dy=event.clientY-current.y,next={...start},grid=value=>snap?Math.round(value/16)*16:value
    if(direction==='move'){
      next.x=clamp(grid(start.x+dx),0,bounds.width-start.width);next.y=clamp(grid(start.y+dy),0,bounds.height-start.height)
      current.snapRect=null
      if(snap&&next.y<8)current.snapRect={x:0,y:0,width:bounds.width,height:Math.min(bounds.height,bounds.visibleHeight)}
      else if(snap&&next.x<8)current.snapRect={x:0,y:0,width:bounds.width/2,height:Math.min(bounds.height,bounds.visibleHeight)}
      else if(snap&&next.x+next.width>bounds.width-8)current.snapRect={x:bounds.width/2,y:0,width:bounds.width/2,height:Math.min(bounds.height,bounds.visibleHeight)}
      setPreview(previous=>JSON.stringify(previous)===JSON.stringify(current.snapRect)?previous:current.snapRect)
    }else{
      if(direction.includes('e'))next.width=clamp(grid(start.width+dx),Math.min(280,bounds.width),bounds.width-start.x)
      if(direction.includes('s'))next.height=clamp(grid(start.height+dy),220,bounds.height-start.y)
      if(direction.includes('w')){next.width=clamp(grid(start.width-dx),Math.min(280,bounds.width),start.x+start.width);next.x=start.x+start.width-next.width}
      if(direction.includes('n')){next.height=clamp(grid(start.height-dy),220,start.y+start.height);next.y=start.y+start.height-next.height}
    }
    current.next=next
    if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;if(gesture.current)apply(gesture.current.next)})
  }
  const handlers=direction=>({onPointerDown:event=>begin(event,direction),onPointerMove:move,onPointerUp:()=>finish(),onPointerCancel:()=>finish(true),onLostPointerCapture:()=>finish()})
  const keyboard=(event,resize=false)=>{
    if(locked||mobile||win.maximized||event.target!==event.currentTarget||!event.altKey||!event.key.startsWith('Arrow'))return
    event.preventDefault();event.stopPropagation();const step=event.shiftKey?40:16,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0
    onChange(fitWindow(resize?{...rect,width:rect.width+dx,height:rect.height+dy}:{...rect,x:rect.x+dx,y:rect.y+dy},bounds))
  }
  const activePane=win.panes.find(pane=>pane.id===win.activePaneId)||win.panes[0]
  return <>
    {preview&&<div className="workflow-snap-preview" style={{left:preview.x,top:preview.y,width:preview.width,height:preview.height,zIndex:zIndex+1}}/>}
    <section ref={element} className={`workflow-window${active?' is-active':''}${dragging?' is-dragging':''}${win.maximized?' is-maximized':''}`} style={{zIndex,display:win.minimized?'none':undefined}} onPointerDownCapture={onFocus} onFocusCapture={onFocus} aria-label={`${TOOLS[activePane.type].label} window`}>
      <header className="workflow-window-title" tabIndex={0} {...handlers('move')} onKeyDown={event=>keyboard(event)} onDoubleClick={event=>{if(!event.target.closest('button')&&!locked&&!mobile)onChange({maximized:!win.maximized})}} title="Drag to move · Double-click to maximize · Alt + arrows to move by keyboard"><div><GripVertical size={13}/><strong>{TOOLS[activePane.type].label}</strong><span>{win.panes.length} {win.panes.length===1?'tab':'tabs'}</span></div><div><button type="button" disabled={locked} onClick={()=>onChange({minimized:true})} aria-label="Minimize window"><Minus size={13}/></button><button type="button" disabled={locked||mobile} onClick={()=>onChange({maximized:!win.maximized})} aria-label={win.maximized?'Restore window':'Maximize window'}>{win.maximized?<Minimize2 size={13}/>:<Maximize2 size={13}/>}</button><button type="button" disabled={locked} onClick={onClose} aria-label="Close window"><X size={13}/></button></div></header>
      <div className="workflow-window-tabs" role="tablist" aria-label="Window tools" onDragOver={event=>{if(!locked&&event.dataTransfer.types.includes('application/x-workflow-pane'))event.preventDefault()}} onDrop={event=>{event.preventDefault();event.stopPropagation();if(!locked)onDropPane(event.dataTransfer.getData('application/x-workflow-pane'),event.target.closest('[data-workflow-pane-id]')?.dataset.workflowPaneId)}}>
        {win.panes.map(pane=><div className="workflow-pane-tab" key={pane.id} data-workflow-pane-id={pane.id}><button type="button" role="tab" tabIndex={pane.id===activePane.id?0:-1} onKeyDown={event=>{if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();event.stopPropagation();const index=win.panes.findIndex(item=>item.id===pane.id),next=event.key==='Home'?0:event.key==='End'?win.panes.length-1:(index+(event.key==='ArrowRight'?1:-1)+win.panes.length)%win.panes.length;onChange({activePaneId:win.panes[next].id});document.getElementById('workflow-tab-'+win.panes[next].id)?.focus()}} aria-selected={pane.id===activePane.id} aria-controls={`workflow-pane-${pane.id}`} id={`workflow-tab-${pane.id}`} draggable={!locked&&!mobile} onDragStart={event=>{event.dataTransfer.setData('application/x-workflow-pane',JSON.stringify({windowId:win.id,paneId:pane.id}));event.dataTransfer.effectAllowed='move'}} onClick={()=>onChange({activePaneId:pane.id})}>{TOOLS[pane.type].label}</button><button type="button" disabled={locked} onClick={()=>onMovePane(pane.id)} title="Move tool tab into another window" aria-label={`Move ${TOOLS[pane.type].label} tab to another window`}><Layers size={11}/></button><button type="button" disabled={locked} onClick={()=>onDetach(pane.id)} title="Detach into a new window" aria-label={`Detach ${TOOLS[pane.type].label} into a new window`}><ArrowUpRight size={11}/></button><button type="button" disabled={locked} onClick={()=>onClosePane(pane.id)} aria-label={`Close ${TOOLS[pane.type].label} tab`}><X size={11}/></button></div>)}<button type="button" disabled={locked||win.panes.length>=6} onClick={onAddPane} aria-label="Add tool tab to window"><Plus size={13}/></button>
      </div>
      <div className="workflow-window-content">{win.panes.map(pane=><div key={pane.id} hidden={pane.id!==activePane.id} id={`workflow-pane-${pane.id}`} role="tabpanel" aria-labelledby={`workflow-tab-${pane.id}`}>{renderPane(pane,active&&pane.id===activePane.id&&!win.minimized)}</div>)}</div>
      {!locked&&!mobile&&!win.maximized&&['n','e','s','w','ne','nw','se','sw'].map(direction=><button key={direction} className={`workflow-window-resize resize-${direction}`} type="button" aria-label={`Resize window ${direction}`} title="Drag to resize · Alt + arrows to resize by keyboard" {...handlers(direction)} onKeyDown={event=>keyboard(event,true)}/>)}
    </section>
  </>
}
