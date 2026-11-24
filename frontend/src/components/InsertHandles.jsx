import { Move, RotateCw } from 'lucide-react'

export default function InsertHandles({ item, onStart, onMove, onEnd, onRotate }) {
  const dragHandle=kind=>({
    onPointerDown:e=>{
      if(e.button!==0)return
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      onStart(e,item,kind)
    },
    onPointerMove:e=>{e.stopPropagation();onMove(e)},
    onPointerUp:e=>{
      e.stopPropagation()
      onEnd()
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)
    },
    onPointerCancel:e=>{e.stopPropagation();onEnd(true)},
    onLostPointerCapture:()=>onEnd()
  })
  const label=item.label||(item.stickyNote?'sticky note':item.tool==='text'?'text':'insert')
  return <>
    <button type="button" className="pdf-resize-handle pdf-move-handle" aria-label={'Move '+label}
      title="Drag to move. Use the arrow keys to nudge." {...dragHandle(null)}>
      <Move size={13} aria-hidden="true"/>
    </button>
    {['nw','ne','sw','se'].map(corner=><button key={corner} type="button" className={'pdf-resize-handle pdf-resize-'+corner} aria-label={'Resize '+label+' from '+corner+' corner'} {...dragHandle(corner)}/>)}
    {!item.sourceText&&<button type="button" className="pdf-resize-handle pdf-pivot-handle"
      aria-label={'Rotate '+label} title="Drag to rotate. Hold Shift to snap to 15°." {...dragHandle('pivot')}
      onClick={e=>{if(e.detail===0)onRotate(item,e.shiftKey?-15:15)}}>
      <RotateCw size={13} aria-hidden="true"/>
    </button>}
  </>
}
