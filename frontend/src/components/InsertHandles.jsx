import { Move } from 'lucide-react'

export default function InsertHandles({ item, onStart, onMove, onEnd }) {
  return <>
    <span className="pdf-insert-move-hint"><Move size={12} />Drag to move · corners to resize</span>
    {['nw', 'ne', 'sw', 'se'].map(corner => <button key={corner} type="button" className={`pdf-resize-handle pdf-resize-${corner}`} aria-label={`Resize ${item.label || (item.tool === 'text' ? 'text' : 'insert')} from ${corner} corner`}
      onPointerDown={e => { e.preventDefault(); e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); onStart(e, item, corner) }}
      onPointerMove={e => { e.stopPropagation(); onMove(e) }}
      onPointerUp={e => { e.stopPropagation(); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); onEnd() }}
      onPointerCancel={e => { e.stopPropagation(); onEnd(true) }}
      onLostPointerCapture={() => onEnd()} />)}
  </>
}
