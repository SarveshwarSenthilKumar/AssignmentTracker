import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { collaborationActivity } from '../lib/pdfCollaborationActivity'
import './PDFCollaborationPresence.css'

const labels = { read: 'Select text', pen: 'Pen', highlighter: 'Highlight', text: 'Text', select: 'Move', eraser: 'Eraser', ruler: 'Ruler', calculate: 'Calculator', function: 'Function', graph: 'Graph', 'number-line': 'Number line', snippet: 'Copy region', 'arrow-copy': 'Arrow copy', 'arrow-paste': 'Arrow paste' }
const rotationOf = element => ((Number(element.dataset.presenceRotation) || 0) % 360 + 360) % 360
const point = (x, y, rotation) => rotation === 90 ? { x: 1-y, y: x } : rotation === 180 ? { x: 1-x, y: 1-y } : rotation === 270 ? { x: y, y: 1-x } : { x, y }
function rotated(rect, rotation) {
  const delta = (rotation - rect.rotation + 360) % 360
  const a = point(rect.x, rect.y, delta), b = point(rect.x + rect.width, rect.y + rect.height, delta)
  return { x: Math.min(a.x,b.x), y: Math.min(a.y,b.y), width: Math.abs(b.x-a.x), height: Math.abs(b.y-a.y) }
}
function normalize(rect, surface, kind) {
  const bounds = surface.getBoundingClientRect()
  const left = Math.max(rect.left, bounds.left), top = Math.max(rect.top, bounds.top)
  const right = Math.min(rect.right, bounds.right), bottom = Math.min(rect.bottom, bounds.bottom)
  if (!bounds.width || !bounds.height || right < left || bottom < top) return null
  return { page: Number(surface.dataset.presencePage), rotation: rotationOf(surface), kind, x: (left-bounds.left)/bounds.width, y: (top-bounds.top)/bounds.height, width: (right-left)/bounds.width, height: (bottom-top)/bounds.height }
}
function textCaret(textarea) {
  const mirror = document.createElement('div'), style = getComputedStyle(textarea)
  for (const key of ['fontFamily','fontSize','fontWeight','fontStyle','lineHeight','letterSpacing','padding','border','boxSizing','wordSpacing','wordBreak','overflowWrap','tabSize']) mirror.style[key] = style[key]
  Object.assign(mirror.style, { position: 'fixed', left: '-100000px', top: '0', width: style.width, whiteSpace: 'pre-wrap', visibility: 'hidden' })
  mirror.append(document.createTextNode(textarea.value.slice(0,textarea.selectionStart)))
  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(textarea.selectionStart,textarea.selectionEnd) || '\u200b'
  mirror.append(marker); document.body.append(mirror)
  try {
    const origin = mirror.getBoundingClientRect(), actual = textarea.getBoundingClientRect()
    return [...marker.getClientRects()].slice(0,40).map(rect => ({ left: actual.left+rect.left-origin.left-textarea.scrollLeft, top: actual.top+rect.top-origin.top-textarea.scrollTop, right: actual.left+rect.right-origin.left-textarea.scrollLeft, bottom: actual.top+rect.bottom-origin.top-textarea.scrollTop }))
  } finally { mirror.remove() }
}

export default function PDFCollaborationPresence({ root, enabled, participants, publish, tool, selectedId, activeTextId, eraserSize, eraserShape, scale, box, page, pageBase, activity, editRevision }) {
  const latest = useRef(null), pointer = useRef(null)
  const lastInput = useRef(0)
  const lastEdit = useRef({revision:editRevision,at:0})
  if(lastEdit.current.revision!==editRevision)lastEdit.current={revision:editRevision,at:Date.now()}
  latest.current = { publish, tool, selectedId, activeTextId, eraserSize, eraserShape, scale, box, page, pageBase, activity }
  const [surfaces, setSurfaces] = useState([])
  const scheduleRef = useRef(null)
  useEffect(() => {
    if (!enabled || !root.current) return
    const editor = root.current
    let timer
    const collect = () => {
      timer = null
      const state = { ...latest.current, ...latest.current.activity?.() }, pages = [...editor.querySelectorAll('[data-presence-page]')]
      const rects = []
      let targetId = null, targetKind = null
      const selection = document.getSelection()
      if (selection?.rangeCount && !selection.isCollapsed && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
        for (let index=0;index<selection.rangeCount;index++) for (const rect of selection.getRangeAt(index).getClientRects()) {
          for (const surface of pages) { const value = normalize(rect,surface,'selection'); if (value) rects.push(value) }
          if (rects.length >= 60) break
        }
      }
      const textarea = document.activeElement
      if (textarea?.tagName === 'TEXTAREA' && textarea.closest('[data-pdf-annotation-id]') && editor.contains(textarea)) {
        const target = textarea.closest('[data-pdf-annotation-id]')
        targetId = target.dataset.pdfAnnotationId
        targetKind = target.dataset.pdfAnnotationKind || 'text'
        const surface = textarea.closest('[data-presence-page]')
        if (surface) for (const rect of textCaret(textarea)) { const value=normalize(rect,surface,textarea.selectionStart===textarea.selectionEnd?'caret':'selection'); if(value)rects.push(value) }
      }
      const id = state.tool==='text' ? state.activeTextId || state.selectedId : state.selectedId || state.activeTextId
      if (id) {
        const annotation = [...editor.querySelectorAll('[data-pdf-annotation-id]')].find(element => element.dataset.pdfAnnotationId === id)
        const surface = annotation?.closest('[data-presence-page]')
        if (annotation) { targetId = id; targetKind = annotation.dataset.pdfAnnotationKind || 'annotation' }
        if (surface) { const value=normalize(annotation.getBoundingClientRect(),surface,'object'); if(value)rects.push(value) }
      }
      if (state.box && state.pageBase?.w && state.pageBase?.h) {
        const x=Math.max(0,Math.min(1,state.box.x/state.pageBase.w)), y=Math.max(0,Math.min(1,state.box.y/state.pageBase.h))
        rects.push({ x,y,width:Math.max(0,Math.min(1-x,state.box.width/state.pageBase.w)),height:Math.max(0,Math.min(1-y,state.box.height/state.pageBase.h)),page:state.page,rotation:0,kind:'region' })
      }
      let cursor = null
      const location = pointer.current
      if (location?.surface.isConnected) {
        const bounds = location.surface.getBoundingClientRect()
        if (bounds.width && bounds.height) cursor = { page:Number(location.surface.dataset.presencePage), rotation:rotationOf(location.surface), x:Math.max(0,Math.min(1,(location.x-bounds.left)/bounds.width)), y:Math.max(0,Math.min(1,(location.y-bounds.top)/bounds.height)), width:state.tool==='eraser'?Math.min(2,state.eraserSize*state.scale/bounds.width):0, height:state.tool==='eraser'?Math.min(2,state.eraserSize*state.scale/bounds.height):0, down:location.down, round:state.eraserShape==='round' }
      }
      let action = 'viewing'
      if (state.transform) action = state.transform==='resize'?'resizing':'moving'
      else if (textarea?.tagName==='TEXTAREA' && targetId && editor.contains(textarea)) action = Date.now()-lastInput.current<1800?'typing':'editing-text'
      else if (cursor?.down) action = ({pen:'drawing',highlighter:'highlighting',eraser:'erasing',ruler:'measuring',select:'moving',read:'selecting',text:'editing-text','arrow-paste':'placing'}[state.tool]) || 'selecting-region'
      else if (rects.some(rect=>rect.kind==='selection')) action = 'selecting'
      else if (state.box) action = 'selecting-region'
      else if (Date.now()-lastEdit.current.at<1800) action = ({select:'moving',eraser:'erasing',text:'editing-text',pen:'drawing',highlighter:'highlighting',ruler:'measuring'}[state.tool]) || 'working'
      const focused=document.hasFocus()&&!document.hidden
      state.publish({ tool:state.tool, action:focused?action:'idle', targetId, targetKind, cursor:focused?cursor:null, rects:focused?rects.slice(0,80):[] })
    }
    const schedule = () => { if (!timer) timer = setTimeout(collect,40) }
    const input = () => { lastInput.current=Date.now();schedule() }
    scheduleRef.current = schedule
    const move = event => {
      const surface = editor.contains(event.target) ? event.target.closest?.('[data-presence-page]') : null
      pointer.current = surface ? { surface,x:event.clientX,y:event.clientY,down:event.buttons>0 } : null
      schedule()
    }
    const leave = () => { pointer.current = null; schedule() }
    const discover = () => {
      const next = [...editor.querySelectorAll('[data-presence-page]')]
      setSurfaces(previous => previous.length===next.length&&previous.every((surface,index)=>surface===next[index]) ? previous : next)
    }
    const observer = new MutationObserver(discover)
    observer.observe(editor,{subtree:true,childList:true}); discover()
    for (const event of ['pointermove','pointerdown','pointerup','pointercancel']) document.addEventListener(event,move,{capture:true,passive:true})
    for (const event of ['input','keyup','select','focusin','focusout']) editor.addEventListener(event,schedule,true)
    editor.addEventListener('input',input,true)
    editor.addEventListener('pointerleave',leave)
    editor.addEventListener('scroll',schedule,true)
    window.addEventListener('blur',leave)
    window.addEventListener('focus',schedule)
    document.addEventListener('visibilitychange',schedule)
    document.addEventListener('selectionchange',schedule)
    const heartbeat = setInterval(collect,2000)
    schedule()
    return () => {
      clearTimeout(timer);clearInterval(heartbeat);observer.disconnect();scheduleRef.current=null
      for (const event of ['pointermove','pointerdown','pointerup','pointercancel']) document.removeEventListener(event,move,true)
      for (const event of ['input','keyup','select','focusin','focusout']) editor.removeEventListener(event,schedule,true)
      editor.removeEventListener('input',input,true)
      editor.removeEventListener('pointerleave',leave);document.removeEventListener('selectionchange',schedule)
      editor.removeEventListener('scroll',schedule,true)
      window.removeEventListener('blur',leave);window.removeEventListener('focus',schedule);document.removeEventListener('visibilitychange',schedule)
    }
  },[enabled,root])
  useEffect(()=>{scheduleRef.current?.()},[tool,selectedId,activeTextId,eraserSize,eraserShape,scale,box,page,editRevision])
  if (!enabled) return null
  return surfaces.map((surface,index)=>createPortal(<div className="pdf-peer-overlay" aria-hidden="true">
    {participants.map(peer=>{
      const number=Number(surface.dataset.presencePage), rotation=rotationOf(surface)
      const cursor=peer.data.cursor?.page===number?peer.data.cursor:null
      const location=cursor?point(cursor.x,cursor.y,(rotation-cursor.rotation+360)%360):null
      const action=collaborationActivity(peer.data)
      const typing=['typing','editing-text'].includes(peer.data.action)
      const textFocus=typing&&(peer.data.rects.find(rect=>rect.kind==='caret') || peer.data.rects.find(rect=>rect.kind==='selection') || peer.data.rects.find(rect=>rect.kind==='object'))
      const focus=textFocus ? (textFocus.page===number?textFocus:null) : !location&&peer.data.rects.find(rect=>rect.page===number)
      const focusBounds=focus?rotated(focus,rotation):null
      const anchor=textFocus ? (focusBounds?{x:focusBounds.x,y:focusBounds.y+focusBounds.height}:null) : location || (focusBounds?{x:focusBounds.x,y:focusBounds.y}:null)
      return <div key={peer.peer} style={{'--peer-color':peer.color}}>
        {peer.data.rects.filter(rect=>rect.page===number).map((rect,i)=>{const bounds=rotated(rect,rotation);return <span key={i} className={`pdf-peer-rect is-${rect.kind}`} style={{left:`${bounds.x*100}%`,top:`${bounds.y*100}%`,width:`${bounds.width*100}%`,height:`${bounds.height*100}%`}}/>})}
        {anchor&&<>
          {location&&peer.data.tool==='eraser'&&(()=>{const size=rotated(cursor,rotation);return <span className="pdf-peer-eraser" style={{left:`${location.x*100}%`,top:`${location.y*100}%`,width:`${size.width*100}%`,height:`${size.height*100}%`,borderRadius:cursor.round?'50%':'2px'}}/>})()}
          <span className={`pdf-peer-cursor${cursor?.down?' is-down':''}${anchor.x>.65?' is-near-right':''}${anchor.y>.85?' is-near-bottom':''}`} style={{left:`${anchor.x*100}%`,top:`${anchor.y*100}%`}}><svg width="13" height="18" viewBox="0 0 13 18"><path d="M1 1v13l3.5-3 2.5 6 2-1-2.5-6H12Z" fill="currentColor" stroke="white" strokeWidth="1"/></svg><span><strong>{peer.name||'Collaborator'}</strong><small>{action.label || labels[peer.data.tool]} · Page {number}</small></span></span>
        </>}
      </div>
    })}
  </div>,surface,`presence-${index}`))
}
