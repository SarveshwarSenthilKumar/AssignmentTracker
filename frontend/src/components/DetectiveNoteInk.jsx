import {useLayoutEffect,useMemo,useRef} from 'react'
import {MAX_NOTE_STROKES,MAX_NOTE_STROKE_POINTS,NOTE_INK_GRID} from '../lib/detectiveWallLimits'

const strokePath=points=>{
  if(!points.length)return ''
  const path=`M${points.map(point=>point.join(' ')).join('L')}`
  return points.length===1?`${path}h.01`:path
}

export default function DetectiveNoteInk({strokes,active,onStroke}){
  const preview=useRef(null),gesture=useRef(null),frame=useRef(null)
  const paths=useMemo(()=>strokes.map(strokePath),[strokes])

  const cancel=()=>{
    if(frame.current!==null)cancelAnimationFrame(frame.current)
    frame.current=null
    gesture.current=null
    preview.current?.removeAttribute('d')
  }
  useLayoutEffect(()=>cancel,[active])

  const addPoints=(event,includeLast=false)=>{
    const matrix=event.currentTarget.getScreenCTM()?.inverse()
    if(!matrix)return
    const bounds=value=>Math.round(Math.max(0,Math.min(NOTE_INK_GRID,value)))
    const native=event.nativeEvent
    const samples=native.getCoalescedEvents?.()||[]
    const points=gesture.current.points
    for(const sample of samples.length&&!includeLast?samples:[native]){
      const {clientX,clientY}=sample
      const x=bounds(matrix.a*clientX+matrix.c*clientY+matrix.e)
      const y=bounds(matrix.b*clientX+matrix.d*clientY+matrix.f)
      const last=points.at(-1)
      if(last&&Math.hypot(x-last[0],y-last[1])<(includeLast?1:2))continue
      if(points.length===MAX_NOTE_STROKE_POINTS){
        // Keep the whole gesture by thinning older samples on very long strokes.
        const thinned=points.filter((_,index)=>index%2===0)
        points.splice(0,points.length,...thinned)
      }
      points.push([x,y])
    }
    if(!includeLast&&frame.current===null)frame.current=requestAnimationFrame(()=>{
      frame.current=null
      preview.current?.setAttribute('d',strokePath(gesture.current?.points||[]))
    })
  }

  return <svg className={`detective-note-ink${active?' is-writing':''}`}
    viewBox={`0 0 ${NOTE_INK_GRID} ${NOTE_INK_GRID}`} preserveAspectRatio="none"
    role="img" aria-label={active?'Sticky note handwriting area':'Handwritten ink'}
    onPointerDown={event=>{
      if(event.button!==0)return
      event.stopPropagation()
      event.preventDefault()
      if(!active||gesture.current||strokes.length>=MAX_NOTE_STROKES)return
      event.currentTarget.setPointerCapture(event.pointerId)
      gesture.current={id:event.pointerId,points:[]}
      addPoints(event)
    }}
    onPointerMove={event=>{
      if(gesture.current?.id!==event.pointerId)return
      event.stopPropagation()
      addPoints(event)
    }}
    onPointerUp={event=>{
      if(gesture.current?.id!==event.pointerId)return
      event.stopPropagation()
      addPoints(event,true)
      const {points}=gesture.current
      cancel()
      if(points.length)onStroke(points)
    }}
    onPointerCancel={event=>{if(gesture.current?.id===event.pointerId){event.stopPropagation();cancel()}}}
    onLostPointerCapture={event=>{if(gesture.current?.id===event.pointerId)cancel()}}>
    {paths.map((path,index)=><path key={index} d={path}/>)}
    <path ref={preview}/>
  </svg>
}
