import { forwardRef, memo, useImperativeHandle, useLayoutEffect, useRef } from 'react'

function surface(canvas,width,height,scale){
  // Bound backing-store memory at high zoom and on high-DPI screens.
  const ratio=Math.min(window.devicePixelRatio||1,2,4096/Math.max(1,width*scale),4096/Math.max(1,height*scale),Math.sqrt(6000000/Math.max(1,width*height*scale*scale)))
  const w=Math.max(1,Math.round(width*scale*ratio)),h=Math.max(1,Math.round(height*scale*ratio))
  const resized=canvas.width!==w||canvas.height!==h
  if(resized){canvas.width=w;canvas.height=h}
  const context=canvas.getContext('2d');context.setTransform(w/width,0,0,h/height,0,0)
  return {context,resized}
}
function clear(canvas,context){context.save();context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.restore()}
function paint(context,stroke,pressure,from=1){
  const points=stroke.points;if(!points?.length)return
  context.save();context.strokeStyle=stroke.color||'#000';context.fillStyle=stroke.color||'#000';context.lineCap='round';context.lineJoin='round';context.lineWidth=stroke.strokeWidth||2
  context.globalAlpha=stroke.tool==='highlighter'?0.3:1
  if(points.length===1){context.beginPath();context.arc(points[0].x,points[0].y,(stroke.strokeWidth||2)/2,0,Math.PI*2);context.fill()}
  else if(stroke.tool==='highlighter'||!pressure){context.beginPath();context.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)context.lineTo(points[i].x,points[i].y);context.stroke()}
  else for(let i=Math.max(1,from);i<points.length;i++){
    const a=points[i-1],b=points[i]
    context.lineWidth=(stroke.strokeWidth||2)*(.4+1.2*((a.pressure??.5)+(b.pressure??.5))/2)
    context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.stroke()
  }
  context.restore()
}
const canvasStyle={position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}

export default memo(function PDFInkLayer({items,width,height,scale=1,usePressure=true}){
  const canvas=useRef(null),previous=useRef({strokes:[],pressure:null,width:0,height:0})
  useLayoutEffect(()=>{
    if(!canvas.current||!width||!height)return
    const {context,resized}=surface(canvas.current,width,height,scale),strokes=items.filter(item=>item.points?.length),old=previous.current
    const appendOnly=!resized&&old.width===width&&old.height===height&&old.pressure===usePressure&&old.strokes.length<=strokes.length&&old.strokes.every((stroke,index)=>stroke===strokes[index])
    if(!appendOnly)clear(canvas.current,context)
    for(let index=appendOnly?old.strokes.length:0;index<strokes.length;index++)paint(context,strokes[index],usePressure)
    previous.current={strokes,pressure:usePressure,width,height}
  },[items,width,height,scale,usePressure])
  return <canvas ref={canvas} style={canvasStyle} aria-hidden="true"/>
})

export const PDFLiveInk=forwardRef(function PDFLiveInk({width,height,scale},ref){
  const canvas=useRef(null),state=useRef({points:null,count:0})
  useLayoutEffect(()=>{if(canvas.current&&width&&height){const {context}=surface(canvas.current,width,height,scale);clear(canvas.current,context);state.current={points:null,count:0}}},[width,height,scale])
  useImperativeHandle(ref,()=>({
    draw(stroke,pressure){
      if(!canvas.current||!width||!height)return
      const {context,resized}=surface(canvas.current,width,height,scale),old=state.current
      const append=!resized&&old.points===stroke.points&&old.count>1&&pressure&&stroke.tool!=='highlighter'
      if(!append)clear(canvas.current,context)
      paint(context,stroke,pressure,append?old.count:1)
      state.current={points:stroke.points,count:stroke.points.length}
    },
    clear(){if(canvas.current){const context=canvas.current.getContext('2d');clear(canvas.current,context)}state.current={points:null,count:0}},
  }),[width,height,scale])
  return <canvas ref={canvas} style={canvasStyle} aria-hidden="true"/>
})
