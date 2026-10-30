import { useRef, useState } from 'react'

export default function PDFDottedLineHandles({ items, width, height, scale, onStart, onChange, onCancel }) {
  const [selected, setSelected] = useState(null), drag = useRef(null)
  const groups = new Map()
  for (const item of items) {
    if (item.straightLine && item.points?.length >= 2) {
      groups.set(`straight:${item.id}`, [item])
      continue
    }
    if (!item.dottedGroup || !item.points?.length) continue
    if (!groups.has(item.dottedGroup)) groups.set(item.dottedGroup, [])
    groups.get(item.dottedGroup).push(item)
  }
  const endpoints = strokes => [strokes[0].points[0], strokes[strokes.length - 1].points[strokes[strokes.length - 1].points.length - 1]]
  const point = event => {
    const svg = event.currentTarget.ownerSVGElement
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY
    return p.matrixTransform(svg.getScreenCTM().inverse())
  }
  const start = (event, group, mode) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    event.preventDefault(); event.stopPropagation()
    setSelected(group)
    drag.current = { pointer: event.pointerId, group, mode, origin: point(event), items: groups.get(group) }
    onStart(); event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = event => {
    const active = drag.current
    if (!active || active.pointer !== event.pointerId) return
    event.stopPropagation()
    const p = point(event), dots = active.items, [a, b] = endpoints(dots)
    let from = a, to = b
    if (active.mode === 'start') from = p
    else if (active.mode === 'end') to = p
    if (active.mode !== 'move' && Math.hypot(to.x - from.x, to.y - from.y) < 8 / scale) return
    if (dots.length === 1 && dots[0].straightLine) {
      const item = dots[0], lengthSquared = (b.x-a.x)**2 + (b.y-a.y)**2
      onChange([{...item, points:item.points.map(original=>{
        if(active.mode==='move')return {...original,x:original.x+p.x-active.origin.x,y:original.y+p.y-active.origin.y}
        const fraction=lengthSquared?Math.max(0,Math.min(1,((original.x-a.x)*(b.x-a.x)+(original.y-a.y)*(b.y-a.y))/lengthSquared)):0
        return {...original,x:from.x+(to.x-from.x)*fraction,y:from.y+(to.y-from.y)*fraction}
      })}])
      return
    }
    onChange(dots.map((item, index) => ({ ...item, points: [{ ...item.points[0],
      x: active.mode === 'move' ? item.points[0].x + p.x - active.origin.x : from.x + (to.x - from.x) * index / (dots.length - 1),
      y: active.mode === 'move' ? item.points[0].y + p.y - active.origin.y : from.y + (to.y - from.y) * index / (dots.length - 1),
    }] })))
  }
  const end = event => {
    if (drag.current?.pointer !== event.pointerId) return
    event.stopPropagation()
    if (event.type === 'pointercancel') onCancel(drag.current.items)
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const handlers = (group, mode) => ({ onPointerDown: event => start(event, group, mode), onPointerMove: move, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end })
  return <svg viewBox={`0 0 ${width} ${height}`} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:24, overflow:'visible' }}>
    {[...groups].filter(([, dots]) => dots.length > 1 || dots[0].straightLine).map(([group, dots]) => {
      const [a, b] = endpoints(dots)
      return <g key={group}>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={24 / scale} style={{pointerEvents:'stroke',cursor:'move',touchAction:'none'}} {...handlers(group,'move')}><title>Drag line to move; select to show endpoint handles</title></line>
        {selected === group && <>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8fa5b9" strokeWidth={1 / scale} strokeDasharray={`${3 / scale} ${4 / scale}`}/>
          {[['start',a],['end',b]].map(([mode,p]) => <circle key={mode} cx={p.x} cy={p.y} r={9 / scale} fill="#18232f" stroke="#b4c7d8" strokeWidth={2 / scale} style={{pointerEvents:'all',cursor:'crosshair',touchAction:'none'}} {...handlers(group,mode)}><title>Drag endpoint to change length and angle</title></circle>)}
        </>}
      </g>
    })}
  </svg>
}
