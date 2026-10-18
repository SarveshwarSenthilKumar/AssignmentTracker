import useShortcuts from '../hooks/useShortcuts'
import useInlineConfirm from '../hooks/useInlineConfirm'
import InlineConfirmation from './InlineConfirmation'
import PDFCalculator from './PDFCalculator'
import { eraseAnnotations } from '../lib/pdfEraser'
import PDFEraserControls from './PDFEraserControls'
import PDFContinuousView from './PDFContinuousView'
import { selectionExpression, textInPdfBox } from '../lib/pdfCalculation'
import { calculate } from '../lib/calculator'
import { mathSelectionImage, selectionHasInk } from '../lib/mathSelectionImage'
import { readApiJson } from '../lib/apiResponse'
import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  Files, Moon, Sun, Calculator, X, Save, Download, Upload, Trash2, Pen, Highlighter, Eraser, ZoomIn, ZoomOut,
  PanelLeft, FileText, Maximize, RotateCw, Settings, Tag, Folder, Check, Loader2, Undo, Redo, Type, Move, Minus, Plus, AlertCircle
} from 'lucide-react'
import { PDFDocument, rgb, degrees, StandardFonts, LineCapStyle } from 'pdf-lib'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import './PDFEditor.css'
import InsertHandles from './InsertHandles'
import { moveInsert, resizeFromCorner } from '../lib/insertGeometry'
import InsertPanel, { imageFromFile, makeInsert } from './PDFInsertPanel'
import { cn } from '../lib/utils'

// Set up PDF.js worker for react-pdf v7
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/*
 * COORDINATE SYSTEM
 * All annotations are stored in "page units" (PDF points at 100% zoom, measured from the
 * top-left of the page as displayed). Zoom and rotation are applied only when rendering,
 * so annotations stay glued to the page at any zoom/rotation and burn into the PDF exactly.
 */
const TEXT_PAD_X = 4
const TEXT_PAD_Y = 2
const LINE_HEIGHT = 1.2
const BASELINE_RATIO = 0.9465 // distance from top of a line box to the baseline, in font sizes
const FONT_STACK = 'Helvetica, Arial, sans-serif'
const PDF_OPTIONS = { isEvalSupported: false }
const COLORS = ['#000000', '#9e6464', '#526c83', '#62816f', '#9a835e', '#777487', '#967d87']
const COLOR_NAMES = { '#000000': 'Black', '#9e6464': 'Muted red', '#526c83': 'Slate blue', '#62816f': 'Sage', '#9a835e': 'Ochre', '#777487': 'Violet gray', '#967d87': 'Rose gray' }
const TOOLS = ['pen', 'highlighter', 'text', 'select', 'eraser']

const uid = () => `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

const hexToRgb = (hex) => {
  if (!hex) return { r: 0, g: 0, b: 0 }
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  return m
    ? { r: parseInt(m[1], 16) / 255, g: parseInt(m[2], 16) / 255, b: parseInt(m[3], 16) / 255 }
    : { r: 0, g: 0, b: 0 }
}

// Pressure -> width multiplier. A mouse reports 0.5, which maps to exactly 1.0x.
const pressureFactor = (a, b) => 0.4 + 1.2 * (((a.pressure ?? 0.5) + (b.pressure ?? 0.5)) / 2)
const getPressure = (ev) => (ev.pointerType === 'pen' ? ev.pressure || 0.5 : 0.5)

const distToSegment = (p, a, b) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

const strokeHit = (stroke, pt, radius) => {
  const pts = stroke.points
  if (!pts?.length) return false
  const r = radius + (stroke.strokeWidth || 1) / 2
  if (pts.length === 1) return Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y) <= r
  for (let i = 1; i < pts.length; i++) {
    if (distToSegment(pt, pts[i - 1], pts[i]) <= r) return true
  }
  return false
}

const cleanForSave = (items) => items.filter(i => !(i.tool === 'text' && !i.text?.trim()))

/* ------------------------------------------------------------------ */
/* Burn annotations into the PDF (download)                            */
/* ------------------------------------------------------------------ */
async function burnAnnotations(pdfBytes, annotations, usePressure) {
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const supported = new Set(font.getCharacterSet())
  const pages = pdfDoc.getPages()

  for (const item of annotations) {
    const page = pages[(item.page || 1) - 1]
    if (!page) continue

    // Map displayed-page coordinates (top-left origin) to PDF user space,
    // accounting for the page's own /Rotate and crop box.
    const box = page.getCropBox()
    const W = box.width
    const H = box.height
    const angle = ((page.getRotation().angle % 360) + 360) % 360
    const toPdf = (vx, vy) => {
      let x
      let y
      if (angle === 90) { x = vy; y = vx }
      else if (angle === 180) { x = W - vx; y = vy }
      else if (angle === 270) { x = W - vy; y = H - vx }
      else { x = vx; y = H - vy }
      return { x: x + box.x, y: y + box.y }
    }

    const { r, g, b } = hexToRgb(item.color || '#000000')
    const color = rgb(r, g, b)

    if (item.tool === 'image') {
      const image = await pdfDoc.embedPng(item.dataUrl)
      const p = toPdf(item.x, item.y + item.height)
      page.drawImage(image, { x: p.x, y: p.y, width: item.width, height: item.height, rotate: degrees(angle) })
      continue
    }

    if (item.tool === 'text') {
      if (!item.text?.trim()) continue
      const size = item.fontSize || 16
      item.text.replace(/\t/g, '    ').split('\n').forEach((line, i) => {
        const safe = Array.from(line)
          .map(ch => (supported.has(ch.codePointAt(0)) ? ch : '?'))
          .join('')
        if (!safe.trim()) return
        const p = toPdf(
          item.x + TEXT_PAD_X,
          item.y + TEXT_PAD_Y + i * size * LINE_HEIGHT + size * BASELINE_RATIO
        )
        page.drawText(safe, { x: p.x, y: p.y, size, font, color, rotate: degrees(angle) })
      })
      continue
    }

    const pts = item.points
    if (!pts?.length) continue
    const width = item.strokeWidth || 2
    const highlighter = item.tool === 'highlighter'
    const opacity = highlighter ? 0.3 : 1
    const mapped = pts.map(p => ({ ...toPdf(p.x, p.y), pressure: p.pressure }))

    if (mapped.length === 1) {
      page.drawCircle({ x: mapped[0].x, y: mapped[0].y, size: width / 2, color, opacity })
    } else if (highlighter || !usePressure) {
      // One continuous path so the translucent highlighter doesn't darken at joints
      const d = mapped.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${(-p.y).toFixed(2)}`).join(' ')
      page.drawSvgPath(d, {
        x: 0,
        y: 0,
        borderColor: color,
        borderWidth: width,
        borderOpacity: opacity,
        borderLineCap: LineCapStyle.Round
      })
    } else {
      for (let i = 1; i < mapped.length; i++) {
        page.drawLine({
          start: { x: mapped[i - 1].x, y: mapped[i - 1].y },
          end: { x: mapped[i].x, y: mapped[i].y },
          thickness: width * pressureFactor(mapped[i - 1], mapped[i]),
          color,
          opacity,
          lineCap: LineCapStyle.Round
        })
      }
    }
  }

  return pdfDoc.save()
}

/* ------------------------------------------------------------------ */
/* A single text annotation (module-level so it never remounts)        */
/* ------------------------------------------------------------------ */
function TextAnnotation({
  item, scale, isActive, tool, textareaRef,
  onClick, onChange, onCommit, onDelete, onFontDelta, onColorChange,
  onDragStart, onDragMove, onDragEnd, onResizeStart, selected, onSelect, onSave, onDownload
}) {
  const interactive = tool === 'text' || tool === 'select'
  const fontSize = item.fontSize || 16
  const textColor = item.color || '#000000'
  const textStyle = {
    color: textColor,
    fontSize: fontSize * scale,
    lineHeight: LINE_HEIGHT,
    fontFamily: FONT_STACK,
    padding: `${TEXT_PAD_Y * scale}px ${TEXT_PAD_X * scale}px`,
    whiteSpace: 'pre',
    margin: 0,
    border: 0,
    boxSizing: 'border-box'
  }
  const toolbarBelow = item.y * scale < 40

  return (
    <div
      className="group"
      data-text-annotation
      style={{
        position: 'absolute',
        left: item.x * scale,
        top: item.y * scale,
        zIndex: isActive || selected ? 30 : 20,
        outline: tool === 'select' && selected ? '2px solid #8fa5b9' : undefined,
        touchAction: 'none',
        pointerEvents: interactive ? 'auto' : 'none'
      }}
      // Keep these events away from the drawing overlay underneath
      onPointerDown={(e) => {
        e.stopPropagation()
        if (tool === 'select') {
          e.preventDefault(); onSelect(item.id)
          e.currentTarget.setPointerCapture(e.pointerId)
          onDragStart(e, item)
        }
      }}
      onPointerMove={tool === 'select' ? onDragMove : undefined}
      onPointerUp={tool === 'select' ? e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); onDragEnd() } : undefined}
      onPointerCancel={tool === 'select' ? () => onDragEnd(true) : undefined}
      onLostPointerCapture={tool === 'select' ? () => onDragEnd() : undefined}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {tool === 'select' && selected && <InsertHandles item={item} onStart={onResizeStart} onMove={onDragMove} onEnd={onDragEnd} />}
      {tool === 'text' && (
        <div
          data-keep-text-active
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            'absolute left-0 flex items-center gap-1 bg-slate-900/95 border border-blue-500/50 rounded-lg px-1.5 py-1 shadow-xl select-none z-40 whitespace-nowrap transition-opacity',
            toolbarBelow ? 'top-full mt-1' : 'bottom-full mb-1',
            isActive ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
          )}
        >
          <div
            title="Drag to move"
            className="p-1 text-slate-300 hover:text-white cursor-move touch-none rounded hover:bg-white/10"
            onPointerDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              e.currentTarget.setPointerCapture(e.pointerId)
              onDragStart(e, item)
            }}
            onPointerMove={(e) => onDragMove(e)}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture?.(e.pointerId)
              onDragEnd()
            }}
            onPointerCancel={() => onDragEnd(true)}
          >
            <Move size={13} />
          </div>

          <div className="h-4 w-px bg-white/20" />

          {/* Quick Color Picker */}
          <div className="flex items-center gap-1">
            {['#000000', '#526c83', '#9e6464', '#62816f', '#9a835e', '#777487'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange?.(item.id, c)}
                className={cn(
                  'w-3.5 h-3.5 rounded-full border border-white/40 transition-transform',
                  textColor === c ? 'ring-2 ring-white  shadow' : ' opacity-75 hover:opacity-100'
                )}
                style={{ backgroundColor: c }}
                aria-label={`Text color ${COLOR_NAMES[c] || c}`} title={COLOR_NAMES[c] || c}
              />
            ))}
          </div>

          <div className="h-4 w-px bg-white/20" />

          <button
            type="button"
            onClick={() => onFontDelta(item.id, -2)}
            className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded"
            title="Smaller text"
          >
            <Minus size={13} />
          </button>
          <span className="text-[11px] text-slate-200 font-medium w-5 text-center tabular-nums">{Math.round(fontSize)}</span>
          <button
            type="button"
            onClick={() => onFontDelta(item.id, 2)}
            className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded"
            title="Larger text"
          >
            <Plus size={13} />
          </button>

          <div className="h-4 w-px bg-white/20" />

          <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="p-1 text-slate-300 hover:text-red-400 hover:bg-red-500/20 rounded"
            title="Delete text"
          >
            <Trash2 size={13} />
          </button>
          {isActive && (
            <button
              type="button"
              onClick={onCommit}
              className="p-1 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded"
              title="Done (Esc or Ctrl+Enter)"
            >
              <Check size={13} />
            </button>
          )}
        </div>
      )}

      {isActive ? (
        // Hidden mirror gives the box its size; the textarea sits on top of it.
        <div className="relative inline-block" style={{ minWidth: 48 * scale }}>
          <div aria-hidden style={{ ...textStyle, visibility: 'hidden' }}>
            {(item.text || '') + ' '}
          </div>
          <textarea
            ref={textareaRef}
            value={item.text}
            wrap="off"
            rows={1}
            spellCheck={false}
            placeholder="Type text…"
            onChange={(e) => onChange(item.id, e.target.value)}
            onBlur={(e) => {
              if (e.relatedTarget?.closest?.('[data-keep-text-active]')) return
              onCommit()
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); e.stopPropagation(); e.shiftKey ? onDownload() : onSave(); return }
              e.stopPropagation()
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault()
                onCommit()
              }
            }}
            style={{
              ...textStyle,
              color: textColor,
              caretColor: textColor,
              colorScheme: 'light',
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              resize: 'none',
              overflow: 'hidden',
              outline: 'none',
              background: 'rgba(255, 255, 255, 0.92)',
              boxShadow: '0 0 0 2px #8fa5b9',
              borderRadius: 3
            }}
          />
        </div>
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onClick(item)
          }}
          style={{
            ...textStyle,
            color: textColor,
            colorScheme: 'light',
            minWidth: 12
          }}
          className={cn(
            'rounded select-none transition-shadow',
            tool === 'select' && 'cursor-move',
            tool === 'text' && 'cursor-text hover:outline hover:outline-1 hover:outline-slate-400 hover:bg-blue-500/10',
            tool === 'eraser' && 'cursor-pointer hover:outline hover:outline-1 hover:outline-red-400 hover:bg-red-500/20 hover:line-through'
          )}
        >
          {item.text}
        </div>
      )}
    </div>
  )
}

// Render previews as they approach the sidebar viewport, keeping long PDFs responsive.
function PagePreview({ pageNumber }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { root: ref.current?.closest('aside'), rootMargin: '200px' })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return <div ref={ref} style={{ width: 136, minHeight: 176 }}>{visible && <Page pageNumber={pageNumber} width={136} renderTextLayer={false} renderAnnotationLayer={false} loading={<div className="h-44 bg-slate-200 " />} />}</div>
}

/* ------------------------------------------------------------------ */
/* Main editor                                                         */
/* ------------------------------------------------------------------ */
export default function PDFEditor({ pdfId, onClose, token, initialDocument = null, exportImage = false }) {
  const confirmation = useInlineConfirm()
  const [pdfData, setPdfData] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageBase, setPageBase] = useState(null) // { page, w, h } in page units
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [currentTool, setCurrentTool] = useState('text')
  const [currentColor, setCurrentColor] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [eraserOptions,setEraserOptions]=useState(()=>{
    let saved={};try{saved=JSON.parse(localStorage.getItem('pdf-eraser-options')||'{}')||{}}catch{}
    return {mode:['stroke','precision','objects'].includes(saved.mode)?saved.mode:'stroke',size:Number.isFinite(saved.size)?Math.max(2,Math.min(160,saved.size)):20,shape:saved.shape==='square'?'square':'round',target:['pen','highlighter'].includes(saved.target)?saved.target:'all'}
  })
  const {mode:eraserMode,size:eraserSize,shape:eraserShape,target:eraserTarget}=eraserOptions
  const setEraserMode=mode=>setEraserOptions(previous=>({...previous,mode})),setEraserSize=size=>setEraserOptions(previous=>({...previous,size})),setEraserShape=shape=>setEraserOptions(previous=>({...previous,shape})),setEraserTarget=target=>setEraserOptions(previous=>({...previous,target}))
  useEffect(()=>{try{localStorage.setItem('pdf-eraser-options',JSON.stringify(eraserOptions))}catch{}},[eraserOptions])
  const eraserCursorRef=useRef(null),eraserLast=useRef(null)
  const [fontSize, setFontSize] = useState(16)
  const [activeTextId, setActiveTextId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [continuousView,setContinuousView]=useState(()=>{try{return localStorage.getItem('pdf-editor-continuous')==='true'}catch{return false}})
  useEffect(()=>{try{localStorage.setItem('pdf-editor-continuous',String(continuousView))}catch{}},[continuousView])
  const [darkPages,setDarkPages]=useState(()=>{try{return localStorage.getItem('pdf-editor-dark-pages')!=='false'}catch{return true}})
  useEffect(()=>{try{localStorage.setItem('pdf-editor-dark-pages',String(darkPages))}catch{}},[darkPages])
  const [snippet,setSnippet]=useState(null),[copyingSnippet,setCopyingSnippet]=useState(false)
  const snippetCopyRef=useRef(false)
  const editorRootRef=useRef(null),ownsFullscreenRef=useRef(false)
  const [focusMode,setFocusMode]=useState(false)
  const [fingerScroll,setFingerScroll]=useState(true)
  const exitFocusMode=()=>{
    setFocusMode(false)
    if(document.fullscreenElement===editorRootRef.current)document.exitFullscreen?.().catch(()=>{})
  }
  const enterFocusMode=()=>{
    handleTextDragEnd();commitText();setShowSettings(false)
    if(!['pen','highlighter','text','eraser','select'].includes(currentTool))setCurrentTool('pen')
    setFocusMode(true)
    const root=editorRootRef.current
    if(root?.requestFullscreen&&!document.fullscreenElement){
      root.requestFullscreen().then(()=>{ownsFullscreenRef.current=true}).catch(()=>{})
    }
  }
  useEffect(()=>{
    const changed=()=>{
      if(document.fullscreenElement===editorRootRef.current)ownsFullscreenRef.current=true
      else if(ownsFullscreenRef.current){ownsFullscreenRef.current=false;setFocusMode(false)}
    }
    const escape=event=>{if(event.key==='Escape')setFocusMode(false)}
    document.addEventListener('fullscreenchange',changed)
    document.addEventListener('keydown',escape)
    return()=>{
      document.removeEventListener('fullscreenchange',changed)
      document.removeEventListener('keydown',escape)
      if(ownsFullscreenRef.current&&document.fullscreenElement)document.exitFullscreen?.().catch(()=>{})
    }
  },[])
  const [showCalculator,setShowCalculator]=useState(false)
  const [calculationBox,setCalculationBox]=useState(null),[calculationSelection,setCalculationSelection]=useState(null)
  const [calculationMode,setCalculationMode]=useState('auto')
  const recognitionController=useRef(null)
  const calculationDrag=useRef(null),calculationPage=useRef(null),calculationGeneration=useRef(0)
  useEffect(()=>{calculationGeneration.current++;calculationDrag.current=null;setCalculationBox(null);return()=>{calculationGeneration.current++;recognitionController.current?.abort()}},[pageNumber,pdfId,currentTool,calculationMode])
  const settingsFocusRef = useRef(null)
  useEffect(() => {
    if (!showSettings) return
    settingsFocusRef.current = document.activeElement
    document.getElementById('pdf-document-name')?.focus({ preventScroll: true })
    return () => settingsFocusRef.current?.focus?.({ preventScroll: true })
  }, [showSettings])
  const [editTags, setEditTags] = useState('')
  const [editFolder, setEditFolder] = useState('')
  const [editName, setEditName] = useState('')
  const [pdfFolders, setPdfFolders] = useState([])
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [pdfError, setPdfError] = useState(null)
  const [drawingPaths, setDrawingPaths] = useState([])
  const [currentPath, setCurrentPath] = useState([])
  const [usePressure, setUsePressure] = useState(true)
  const [saveStatus, setSaveStatus] = useState('saved') // saved | dirty | saving | error
  const pageDragRef=useRef(null)
  const [pageDropTarget,setPageDropTarget]=useState(null)
  const [showPages, setShowPages] = useState(() => !exportImage && window.innerWidth >= 768)
  const [deletingPage, setDeletingPage] = useState(false)
  const deletingPageRef = useRef(false)
  const [downloading, setDownloading] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [inserting, setInserting] = useState(false)
  const [selectedInsertId, setSelectedInsertId] = useState(null)
  const insertingRef = useRef(false)
  const viewerRef = useRef(null)
  const initialFitRef = useRef(false)
  const saveQueueRef = useRef(Promise.resolve(true))
  const revisionRef = useRef(0)
  const [historyCount, setHistoryCount] = useState({ undo: 0, redo: 0 })

  const overlayRef = useRef(null)
  const textareaRef = useRef(null)

  // Source of truth for annotations (synchronously readable inside event handlers)
  const pathsRef = useRef([])
  const activeTextIdRef = useRef(null)
  const editSnapshotRef = useRef(null)
  const undoStack = useRef([])
  const redoStack = useRef([])
  const dirtyRef = useRef(false)
  const isDrawingRef = useRef(false)
  const isErasingRef = useRef(false)
  const erasedRef = useRef(false)
  const currentPathRef = useRef([])
  const dragRef = useRef(null)

  /* ---------- annotation state helpers ---------- */
  const updatePaths = useCallback((updater, { silent = false } = {}) => {
    const next = typeof updater === 'function' ? updater(pathsRef.current) : updater
    pathsRef.current = next
    setDrawingPaths(next)
    if (!silent) {
      dirtyRef.current = true
      revisionRef.current += 1
      setSaveStatus(s => (s === 'saving' ? s : 'dirty'))
    }
  }, [])

  const bumpHistory = useCallback(() => {
    setHistoryCount({ undo: undoStack.current.length, redo: redoStack.current.length })
  }, [])

  const pushHistoryRaw = useCallback((snapshot) => {
    undoStack.current.push(snapshot)
    if (undoStack.current.length > 100) undoStack.current.shift()
    redoStack.current = []
    bumpHistory()
  }, [bumpHistory])

  const pushHistory = useCallback(() => pushHistoryRaw(pathsRef.current), [pushHistoryRaw])

  const activate = useCallback((id) => {
    activeTextIdRef.current = id
    setActiveTextId(id)
  }, [])

  // Finish editing the active text box: drop it if empty, record undo history if it changed
  const commitText = useCallback(() => {
    const id = activeTextIdRef.current
    if (!id) return
    const before = editSnapshotRef.current
    const current = pathsRef.current
    const item = current.find(i => i.id === id)
    const empty = !item || !item.text?.trim()
    const next = empty ? current.filter(i => i.id !== id) : current
    if (empty && item) updatePaths(next)
    if (before && JSON.stringify(before) !== JSON.stringify(next)) pushHistoryRaw(before)
    editSnapshotRef.current = null
    activate(null)
  }, [activate, pushHistoryRaw, updatePaths])

  const undo = useCallback(() => {
    commitText()
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(pathsRef.current)
    updatePaths(prev)
    bumpHistory()
  }, [bumpHistory, commitText, updatePaths])

  const redo = useCallback(() => {
    commitText()
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(pathsRef.current)
    updatePaths(next)
    bumpHistory()
  }, [bumpHistory, commitText, updatePaths])

  /* ---------- saving ---------- */
  const saveAnnotations = useCallback(() => {
    if (deletingPageRef.current) return Promise.resolve(false)
    const snapshot = cleanForSave(pathsRef.current)
    const revision = revisionRef.current
    setSaveStatus('saving')
    const operation = saveQueueRef.current.then(async () => {
      try {
        const response = await fetch(`/api/pdfs/${pdfId}/annotations`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ annotations: snapshot })
        })
        if (!response.ok) throw new Error('Failed to save annotations')
        dirtyRef.current = revisionRef.current !== revision
        setSaveStatus(dirtyRef.current ? 'dirty' : 'saved')
        return true
      } catch (err) {

        dirtyRef.current = true
        setSaveStatus('error')
        return false
      }
    })
    saveQueueRef.current = operation
    return operation
  }, [pdfId, token])

  // Autosave 1s after the last change (including deletions)
  useEffect(() => {
    if (!dirtyRef.current) return
    const timer = setTimeout(() => { saveAnnotations() }, 1000)
    return () => clearTimeout(timer)
  }, [drawingPaths, saveAnnotations])

  const handleClose = async () => {
    commitText()
    if (dirtyRef.current || saveStatus === 'saving') {
      const saved = await saveAnnotations()
      if (!saved) { setActionError('Your changes could not be saved. Retry Save before closing.'); return }
    }
    onClose()
  }

  /* ---------- loading ---------- */
  useEffect(() => {
    if (pdfId) {
      fetchPDF()
      fetchPDFFolders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfId])

  const fetchPDF = async () => {
    try {
      const response = initialDocument ? { ok: true, json: async () => initialDocument } : await fetch(`/api/pdfs/${pdfId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setPdfData(data)

        if (data.pdfData) {
          try {
            const byteCharacters = atob(data.pdfData)
            const bytes = new Uint8Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) bytes[i] = byteCharacters.charCodeAt(i)
            const blob = new Blob([bytes], { type: 'application/pdf' })
            setPdfFile(new File([blob], data.name || 'document.pdf', { type: 'application/pdf' }))
          } catch (err) {

            setPdfError('Failed to process PDF data')
          }
        }

        const loaded = (data.annotations || []).map(a => {
          const item = a.id ? a : { ...a, id: uid() }
          if (item.tool === 'text' && (!item.color || item.color === '#ffffff' || item.color === '#fff' || item.color === 'white')) {
            item.color = '#000000'
          }
          return item
        })
        updatePaths(loaded, { silent: true })
        dirtyRef.current = false
        setSaveStatus('saved')
        setEditName(data.name || '')
        setEditTags(data.tags?.join(', ') || '')
        setEditFolder(data.pdfFolder || '')
        if (!data.pdfData) setPdfError('This document has no PDF data. Please upload it again.')
      } else {
        const errorData = await response.json().catch(() => ({}))
        setPdfError(errorData.message || 'Failed to fetch PDF')
      }
    } catch (err) {

      setPdfError(err.message || 'Failed to fetch PDF')
    } finally {
      setLoading(false)
    }
  }

  const fetchPDFFolders = async () => {
    try {
      const response = await fetch('/api/pdf-folders', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Could not load document folders. Please retry.')
      setPdfFolders(await response.json())
    } catch (err) {
      setActionError(err.message || 'Could not load document folders.')
    }
  }

  const handleSaveMetadata = async () => {
    setSavingMetadata(true)
    setActionError(null)
    try {
      const response = await fetch(`/api/pdfs/${pdfId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim() || pdfData?.name || 'document.pdf',
          tags: editTags.split(',').map(t => t.trim()).filter(t => t),
          pdfFolder: editFolder || null
        })
      })
      if (response.ok) {
        const data = await response.json()
        setPdfData(prev => ({ ...prev, ...data, pdfData: prev?.pdfData }))
        setShowSettings(false)
      } else { throw new Error('Could not save document settings. Please try again.') }
    } catch (err) {
      setActionError(err.message)

    } finally {
      setSavingMetadata(false)
    }
  }

  /* ---------- react-pdf callbacks ---------- */
  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages)

  const onDocumentLoadError = (error) => {

    setPdfError(`Failed to load PDF: ${error.message || 'Unknown error'}`)
  }

  const onPageLoadSuccess = (page) => {
    calculationPage.current=page
    // Viewport at scale 1 honours the page's own /Rotate, matching what is displayed
    const vp = page.getViewport({ scale: 1 })
    setPageBase({ page: page.pageNumber, w: vp.width, h: vp.height, rotation: page.rotate || 0 })
  }

  useEffect(() => {
    if (!pageBase || !viewerRef.current || initialFitRef.current) return
    initialFitRef.current = true
    const width = viewerRef.current.clientWidth - 64
    setScale(Math.max(0.25, Math.min(1, width / pageBase.w)))
  }, [pageBase])

  /* ---------- coordinates ---------- */
  // Pointer position -> page units, correct at any zoom and rotation
  const toLocal = (ev) => {
    const el = overlayRef.current
    const r = el.getBoundingClientRect()
    const dx = ev.clientX - (r.left + r.width / 2)
    const dy = ev.clientY - (r.top + r.height / 2)
    const t = (rotation * Math.PI) / 180
    const cos = Math.round(Math.cos(t))
    const sin = Math.round(Math.sin(t))
    const lx = dx * cos + dy * sin
    const ly = -dx * sin + dy * cos
    return { x: (lx + el.offsetWidth / 2) / scale, y: (ly + el.offsetHeight / 2) / scale }
  }

  /* ---------- tool settings ---------- */
  const handleColorChange = (color) => {
    setCurrentColor(color)
    const id = activeTextIdRef.current
    if (id) updatePaths(prev => prev.map(i => (i.id === id ? { ...i, color } : i)))
  }

  const handleAnnotationColorChange = (id, color) => {
    setCurrentColor(color)
    updatePaths(prev => prev.map(i => (i.id === id ? { ...i, color } : i)))
  }

  const handleFontSizeChange = (size) => {
    setFontSize(size)
    const id = activeTextIdRef.current
    if (id) updatePaths(prev => prev.map(i => (i.id === id ? { ...i, fontSize: size } : i)))
  }

  const handleFontDelta = (id, delta) => {
    updatePaths(prev => prev.map(i =>
      i.id === id ? { ...i, fontSize: Math.max(6, Math.min(144, (i.fontSize || 16) + delta)) } : i
    ))
    const item = pathsRef.current.find(i => i.id === id)
    if (item) setFontSize(item.fontSize)
  }

  // Leaving the text tool finishes any open text box
  useEffect(() => {
    if (currentTool !== 'text') commitText()
  }, [currentTool, commitText])

  // Focus the textarea whenever a box becomes active (deferred so the click's default focus handling can't steal it)
  useEffect(() => {
    if (!activeTextId) return
    const t = setTimeout(() => {
      const ta = textareaRef.current
      if (ta) {
        ta.focus()
        const n = ta.value.length
        ta.setSelectionRange(n, n)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [activeTextId])

  /* ---------- text interactions ---------- */
  const handleTextChange = (id, text) => {
    updatePaths(prev => prev.map(i => (i.id === id ? { ...i, text } : i)))
  }

  const handleDeleteText = (id) => {
    if (activeTextIdRef.current === id) {
      const before = editSnapshotRef.current
      if (before && before.some(i => i.id === id)) pushHistoryRaw(before)
      editSnapshotRef.current = null
      activate(null)
    } else {
      pushHistory()
    }
    updatePaths(prev => prev.filter(i => i.id !== id))
  }

  const handleTextClick = (item) => {
    if (currentTool === 'eraser') {
      handleDeleteText(item.id)
      return
    }
    if (currentTool !== 'text' || activeTextIdRef.current === item.id) return
    commitText()
    editSnapshotRef.current = pathsRef.current
    setCurrentColor(item.color || '#000000')
    setFontSize(item.fontSize || 16)
    activate(item.id)
  }

  const insertSize = (item) => {
    if (item.tool !== 'text') return { width: item.width, height: item.height }
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    const size = item.fontSize || 16
    context.font = `${size}px ${FONT_STACK}`
    const lines = (item.text || '').split('\n')
    return { width: Math.max(12, ...lines.map(line => context.measureText(line).width)) + TEXT_PAD_X * 2, height: lines.length * size * LINE_HEIGHT + TEXT_PAD_Y * 2 }
  }

  const beginTransform = (e, item, corner = null) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!pageBase || pageBase.page !== pageNumber || dragRef.current) return
    e.stopPropagation()
    const point = toLocal(e)
    dragRef.current = { id: item.id, pointerId: e.pointerId, origin: point, item: { ...item }, size: insertSize(item), corner, snapshot: pathsRef.current, moved: false }
  }
  const handleTextDragStart = (e, item) => beginTransform(e, item)
  const handleResizeStart = (e, item, corner) => beginTransform(e, item, corner)

  const handleTextDragMove = (e) => {
    const drag = dragRef.current
    if (!drag || e.pointerId !== drag.pointerId || !pageBase) return
    e.stopPropagation()
    const pt = toLocal(e)
    if (!drag.moved && Math.hypot(pt.x - drag.origin.x, pt.y - drag.origin.y) * scale < 3) return
    let changes
    if (drag.corner) {
      const text = drag.item.tool === 'text'
      const size = drag.item.fontSize || 16
      const result = resizeFromCorner(drag.item, drag.size, pt, drag.corner, pageBase, text ? { min: 8 / size, max: 96 / size } : {})
      changes = text ? { x: result.x, y: result.y, fontSize: size * result.ratio } : { x: result.x, y: result.y, width: result.width, height: result.height }
    } else {
      changes = moveInsert(drag.item, drag.size, pt, { x: drag.origin.x - drag.item.x, y: drag.origin.y - drag.item.y }, pageBase)
    }
    drag.moved = true
    updatePaths(prev => prev.map(item => item.id === drag.id ? { ...item, ...changes } : item))
  }

  const handleTextDragEnd = (cancelled = false) => {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    if (!drag.moved) return
    if (cancelled) { updatePaths(drag.snapshot); return }
    if (activeTextIdRef.current !== drag.id) pushHistoryRaw(drag.snapshot)
  }

  const addImageInsert = (asset, targetPage = pageNumber, base = pageBase) => {
    if (!base) throw new Error('Wait for the page to load before inserting content.')
    commitText()
    const ratio = Math.min(1, base.w * 0.65 / asset.width, base.h * 0.65 / asset.height)
    const width = asset.width * ratio
    const height = asset.height * ratio
    const item = { ...asset, id: uid(), tool: 'image', page: targetPage, width, height, x: (base.w - width) / 2, y: (base.h - height) / 2 }
    pushHistory()
    updatePaths(prev => [...prev, item])
    setSelectedInsertId(item.id)
    setCurrentTool('select')
  }

  const pasteSnippet = () => {
    if (!snippet || pageBase?.page !== pageNumber || inserting || deletingPage) return
    try {
      addImageInsert(snippet)
      setActionError(null)
    } catch (error) {
      setActionError(error.message)
    }
  }

  const insertFiles = async (files) => {
    if (insertingRef.current || deletingPageRef.current) return
    if (!pageBase || pageBase.page !== pageNumber) { setActionError('Wait for the page to load before inserting content.'); return }
    const targetPage = pageNumber
    const base = pageBase
    insertingRef.current = true
    setInserting(true)
    setActionError(null)
    const errors = []
    try {
      for (const file of files) {
        try {
          if (file.size > 10 * 1024 * 1024) throw new Error('Files must be smaller than 10 MB.')
          if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
            const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false })
            try {
              const pdf = await task.promise
              const page = await pdf.getPage(1)
              const natural = page.getViewport({ scale: 1 })
              const viewport = page.getViewport({ scale: Math.min(2, 1800 / Math.max(natural.width, natural.height)) })
              const canvas = document.createElement('canvas')
              canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
              await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
              addImageInsert({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, label: `${file.name} (page 1)` }, targetPage, base)
            } finally { await task.destroy() }
          } else if (/\.(txt|md|csv)$/i.test(file.name) || file.type.startsWith('text/') && file.type !== 'image/svg+xml') {
            const text = await file.text()
            if (text.length > 20000) throw new Error('Text inserts are limited to 20,000 characters.')
            if (!text.trim()) throw new Error('This text file is empty.')
            commitText(); pushHistory()
            updatePaths(prev => [...prev, { id: uid(), tool: 'text', page: targetPage, x: 24, y: 24, fontSize, color: currentColor, text }])
            setCurrentTool('text')
          } else {
            addImageInsert(await imageFromFile(file), targetPage, base)
          }
        } catch (error) { errors.push(`${file.name || 'Image'}: ${error.message || 'This format could not be read by your browser.'}`) }
      }
      if (errors.length) setActionError(errors.join(' '))
    } finally { insertingRef.current = false; setInserting(false) }
  }

  const insertGenerated = (kind, options) => {
    try { addImageInsert(makeInsert(kind, currentColor, options)); setActionError(null) }
    catch (error) { setActionError(error.message); return false }
  }

  const resizeInsert = (id, factor) => {
    if (!pageBase || pageBase.page !== pageNumber) return
    const item = pathsRef.current.find(item => item.id === id)
    if (!item || item.tool !== 'image') return
    const size = insertSize(item)
    const next = resizeFromCorner(item, size, { x: item.x + size.width * factor, y: item.y + size.height * factor }, 'se', pageBase)
    if (Math.abs(next.width - item.width) < 0.01) return
    commitText(); pushHistory()
    updatePaths(prev => prev.map(value => value.id === id ? { ...value, x: next.x, y: next.y, width: next.width, height: next.height } : value))
  }

  /* ---------- eraser ---------- */
  const eraseAt = (pt) => {
    const next=eraseAnnotations(pathsRef.current,eraserLast.current||pt,pt,{size:eraserSize,shape:eraserShape,mode:eraserMode,target:eraserTarget,page:pageNumber,measure:insertSize,id:uid})
    eraserLast.current=pt
    if(next===pathsRef.current)return
    if (!erasedRef.current) {
      pushHistory()
      erasedRef.current = true
    }
    updatePaths(next)
  }

  /* ---------- overlay pointer handlers ---------- */
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!overlayRef.current) return
    if(currentTool==='calculate'||currentTool==='snippet'){
      viewerRef.current?.focus({preventScroll:true})
      e.preventDefault();const point=toLocal(e)
      calculationDrag.current={point,pointerId:e.pointerId,page:pageNumber,tool:currentTool}
      setCalculationBox({x:point.x,y:point.y,width:0,height:0})
      overlayRef.current.setPointerCapture(e.pointerId);return
    }
    viewerRef.current?.focus({ preventScroll: true })

    if (currentTool === 'select') { setSelectedInsertId(null); return }
    if (currentTool === 'text') {
      e.preventDefault()
      commitText()
      const pt = toLocal(e)
      const item = {
        id: uid(),
        tool: 'text',
        x: Math.max(0, pt.x - TEXT_PAD_X),
        y: Math.max(0, pt.y - TEXT_PAD_Y - fontSize * 0.6),
        text: '',
        color: currentColor || '#000000',
        fontSize,
        page: pageNumber
      }
      editSnapshotRef.current = pathsRef.current
      updatePaths(prev => [...prev, item])
      activate(item.id)
      return
    }

    const pt = toLocal(e)
    overlayRef.current.setPointerCapture?.(e.pointerId)

    if (currentTool === 'eraser') {
      isErasingRef.current = true
      eraserLast.current=null
      erasedRef.current = false
      eraseAt(pt)
      return
    }

    isDrawingRef.current = true
    currentPathRef.current = [{ x: pt.x, y: pt.y, pressure: getPressure(e.nativeEvent) }]
    setCurrentPath(currentPathRef.current.slice())
  }

  const handlePointerMove = (e) => {
    if(currentTool==='eraser'&&eraserCursorRef.current){const point=toLocal(e);eraserCursorRef.current.setAttribute('x',point.x-eraserSize/2);eraserCursorRef.current.setAttribute('y',point.y-eraserSize/2);eraserCursorRef.current.style.display='block'}
    if(calculationDrag.current){
      const start=calculationDrag.current;if(start.pointerId!==e.pointerId)return
      const point=toLocal(e);setCalculationBox({x:Math.min(start.point.x,point.x),y:Math.min(start.point.y,point.y),width:Math.abs(point.x-start.point.x),height:Math.abs(point.y-start.point.y)});return
    }
    if (isErasingRef.current) {
      eraseAt(toLocal(e))
      return
    }
    if (!isDrawingRef.current) return
    const events = e.nativeEvent.getCoalescedEvents?.() || []
    const list = events.length ? events : [e.nativeEvent]
    const path = currentPathRef.current
    for (const ev of list) {
      const pt = toLocal(ev)
      const last = path[path.length - 1]
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 0.3 / scale) continue
      path.push({ x: pt.x, y: pt.y, pressure: getPressure(ev) })
    }
    setCurrentPath(path.slice())
  }

  const handlePointerUp = (e) => {
    if(calculationDrag.current){
      const start=calculationDrag.current;calculationDrag.current=null
      if(overlayRef.current?.hasPointerCapture(e.pointerId))overlayRef.current.releasePointerCapture(e.pointerId)
      if(e.type==='pointercancel'){setCalculationBox(null);return}
      const point=toLocal(e),box={x:Math.min(start.point.x,point.x),y:Math.min(start.point.y,point.y),width:Math.abs(point.x-start.point.x),height:Math.abs(point.y-start.point.y)}
      setCalculationBox(box)
      if(box.width<3||box.height<3)return
      const page=calculationPage.current,generation=++calculationGeneration.current
      if(start.tool==='snippet'){
        if(snippetCopyRef.current)return
        snippetCopyRef.current=true;setCopyingSnippet(true);setActionError(null)
        const annotations=pathsRef.current.filter(item=>(item.page||1)===start.page)
        ;(async()=>{
          try{
            if(!page||page.pageNumber!==start.page)throw new Error('Wait for this page to load before copying a region.')
            const viewport=page.getViewport({scale:1})
            const clipped={x:Math.max(0,box.x),y:Math.max(0,box.y),width:Math.min(viewport.width,box.x+box.width)-Math.max(0,box.x),height:Math.min(viewport.height,box.y+box.height)-Math.max(0,box.y)}
            if(clipped.width<3||clipped.height<3)throw new Error('Select a region inside the page.')
            const dataUrl=await mathSelectionImage(page,clipped,annotations,0)
            setSnippet({dataUrl,width:clipped.width,height:clipped.height,label:`Snippet from page ${start.page}`})
          }catch(error){setActionError(error.message||'Could not copy this region.')}
          finally{snippetCopyRef.current=false;setCopyingSnippet(false)}
        })()
        return
      }
      recognitionController.current?.abort()
      const controller=new AbortController();recognitionController.current=controller
      const annotations=pathsRef.current.filter(item=>(item.page||1)===start.page)
      ;(async()=>{
        try{
          if(!page||page.pageNumber!==start.page)throw new Error('Wait for this PDF page to load, then select again.')
          let expression,source='text',transcription=''
          const needsVision=calculationMode==='vision'||selectionHasInk(annotations,box)
          try{
            if(needsVision)throw new Error('Handwriting or image selected. Choose Auto or Handwriting / AI to recognize it.')
            const text=await textInPdfBox(page,box,pdfjs.Util.transform,annotations)
            expression=selectionExpression(text);calculate(expression)
          }catch(error){
            if(calculationMode==='text')throw error
            if(generation!==calculationGeneration.current)return
            setCalculationSelection({pending:true,id:generation});setShowCalculator(true)
            const image=await mathSelectionImage(page,box,annotations)
            if(generation!==calculationGeneration.current||controller.signal.aborted)return
            const timeout=setTimeout(()=>controller.abort(),55000)
            try{
              const response=await fetch('/api/calculator/recognize',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({image}),signal:controller.signal})
              const data=await readApiJson(response)
              if(!response.ok)throw new Error(data.message||'Could not recognize the selected handwriting.')
              expression=selectionExpression(data.expression);source='ai';transcription=data.transcription
            }finally{clearTimeout(timeout)}
          }
          if(generation!==calculationGeneration.current)return
          setCalculationSelection({expression,source,transcription,id:generation});setShowCalculator(true)
        }catch(error){if(generation===calculationGeneration.current){setCalculationSelection({error:error.message,id:generation});setShowCalculator(true)}}
      })();return
    }
    overlayRef.current?.releasePointerCapture?.(e.pointerId)
    if (isErasingRef.current) {
      isErasingRef.current = false
      eraserLast.current=null
      return
    }
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    const points = currentPathRef.current
    currentPathRef.current = []
    setCurrentPath([])
    if (!points.length) return
    pushHistory()
    updatePaths(prev => [
      ...prev,
      {
        id: uid(),
        points,
        color: currentColor,
        strokeWidth: currentTool === 'highlighter' ? strokeWidth * 3 : strokeWidth,
        tool: currentTool,
        page: pageNumber
      }
    ])
  }

  /* ---------- toolbar actions ---------- */
  const handleClearCanvas = async () => {
    if (!pathsRef.current.length) return
    if (!await confirmation.ask('Remove all annotations from this document? You can undo this change.', 'Clear annotations')) return
    commitText()
    pushHistory()
    updatePaths([])
    currentPathRef.current = []
    setCurrentPath([])
  }

  const goToPage = (n) => {
    handleTextDragEnd()
    commitText()
    if (!Number.isFinite(n)) return
    const target=Math.max(1, Math.min(numPages || 1, Math.trunc(n)))
    setPageNumber(target)
    if(continuousView&&!exportImage)requestAnimationFrame(()=>viewerRef.current?.querySelector(`[data-continuous-page="${target}"]`)?.scrollIntoView({block:'start'}))
    else viewerRef.current?.scrollTo({ top: 0, left: 0 })
    if (window.innerWidth < 768) setShowPages(false)
  }

  const activateContinuousPage=n=>{
    if(n===pageNumber||deletingPageRef.current||insertingRef.current||isDrawingRef.current||isErasingRef.current||calculationDrag.current)return
    handleTextDragEnd();commitText();setSelectedInsertId(null);setPageNumber(n)
  }

  const handleFitWidth = () => {
    if (!pageBase || !viewerRef.current) return
    const width = rotation % 180 ? pageBase.h : pageBase.w
    setScale(Math.max(0.25, Math.min(4, (viewerRef.current.clientWidth - 64) / width)))
  }

  const handleDeletePage = async (targetPage = pageNumber) => {
    if (!numPages || numPages <= 1 || deletingPageRef.current || insertingRef.current) return
    handleTextDragEnd(); commitText()
    if (!await confirmation.ask(`Delete page ${targetPage} and its annotations? This cannot be undone.`, 'Delete page')) return
    deletingPageRef.current = true
    setDeletingPage(true)
    setActionError(null)
    try {
      // Finish older saves before changing page numbers; autosave is paused meanwhile.
      await saveQueueRef.current
      const response = await fetch(`/api/pdfs/${pdfId}/pages/${targetPage}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ annotations: cleanForSave(pathsRef.current) })
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'Could not delete this page.')
      const bytes = Uint8Array.from(atob(result.pdfData), c => c.charCodeAt(0))
      setPdfFile(new File([bytes], pdfData?.name || 'document.pdf', { type: 'application/pdf' }))
      setPdfData(prev => ({ ...prev, pdfData: result.pdfData }))
      setPageBase(null)
      setNumPages(result.numPages)
      setPageNumber(Math.min(pageNumber > targetPage ? pageNumber - 1 : pageNumber, result.numPages))
      setSelectedInsertId(null)
      updatePaths(result.annotations, { silent: true })
      dirtyRef.current = false
      setSaveStatus('saved')
      undoStack.current = []
      redoStack.current = []
      bumpHistory()
      setCurrentPath([])
      currentPathRef.current = []
      isDrawingRef.current = false
      viewerRef.current?.scrollTo({ top: 0, left: 0 })
    } catch (error) {
      setActionError(error.message || 'Could not delete this page. Please try again.')
    } finally {
      deletingPageRef.current = false
      setDeletingPage(false)
    }
  }

  const handleAddPages = async ({ mode, placement, range = '', files = [], sourcePage = pageNumber, targetIndex }) => {
    if (!numPages || deletingPageRef.current || insertingRef.current) return false
    handleTextDragEnd(); commitText()
    deletingPageRef.current = true; setDeletingPage(true); setActionError(null)
    try {
      await saveQueueRef.current
      if (files.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) throw new Error('Choose PDFs totaling no more than 10 MB.')
      const sources = []
      for (const file of files) sources.push(await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = () => reject(new Error(`Could not read ${file.name}.`)); reader.readAsDataURL(file)
      }))
      const position = mode === 'reorder' ? targetIndex : placement === 'start' ? 0 : placement === 'end' ? numPages : placement === 'before' ? pageNumber - 1 : pageNumber
      const response = await fetch(`/api/pdfs/${pdfId}/pages`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode, position, range, currentPage: sourcePage, sources, annotations: cleanForSave(pathsRef.current) }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'Could not add pages. The combined files and edits may be too large.')
      const bytes = Uint8Array.from(atob(result.pdfData), c => c.charCodeAt(0))
      setPdfFile(new File([bytes], pdfData?.name || 'document.pdf', { type: 'application/pdf' }))
      setPdfData(prev => ({ ...prev, pdfData: result.pdfData }))
      setPageBase(null); setNumPages(result.numPages); setPageNumber(result.firstInsertedPage)
      updatePaths(result.annotations, { silent: true }); dirtyRef.current = false; setSaveStatus('saved')
      undoStack.current = []; redoStack.current = []; bumpHistory()
      setSelectedInsertId(null); setCurrentPath([]); currentPathRef.current = []; isDrawingRef.current = false
      viewerRef.current?.scrollTo({ top: 0, left: 0 })
      return true
    } catch (error) { setActionError(error.message); return false }
    finally { deletingPageRef.current = false; setDeletingPage(false) }
  }

  const handlePageDrop = (event, targetPage) => {
    event.preventDefault();event.stopPropagation()
    const sourcePage=pageDragRef.current
    pageDragRef.current=null;setPageDropTarget(null)
    if(!sourcePage||sourcePage===targetPage)return
    handleAddPages({mode:'reorder',sourcePage,targetIndex:targetPage-1})
  }

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4.0))
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => {
    commitText()
    setRotation(prev => (prev + 90) % 360)
  }

  const handleSave = async () => {
    commitText()
    await saveAnnotations()
  }

  const handleDownload = async () => {
    if (downloading) return
    setDownloading(true)
    setActionError(null)
    try {
      commitText()
      let pdfBytes
      if (initialDocument) pdfBytes = Uint8Array.from(atob(initialDocument.pdfData), c => c.charCodeAt(0))
      else {
        const response = await fetch(`/api/pdfs/${pdfId}/download`, { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) throw new Error('Failed to fetch PDF')
        pdfBytes = await response.arrayBuffer()
      }

      let outBytes = pdfBytes
      const annotations = cleanForSave(pathsRef.current)
      if (annotations.length > 0) {
        try {
          outBytes = await burnAnnotations(pdfBytes, annotations, usePressure)
        } catch (err) {

          throw new Error('Could not export your annotations. Your edits remain in the editor; please try again.')
        }
      }

      let blob = new Blob([outBytes], { type: 'application/pdf' })
      if (exportImage) {
        const task = pdfjs.getDocument({ data: new Uint8Array(outBytes), isEvalSupported: false })
        try {
          const document = await task.promise, page = await document.getPage(1)
          const viewport = page.getViewport({ scale: 1 })
          const canvas = window.document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height)
          await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: 'rgba(0,0,0,0)' }).promise
          blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
          if (!blob) throw new Error('Could not export the image.')
        } finally { await task.destroy() }
      }
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = exportImage ? `${(pdfData?.originalName || 'image').replace(/\.[^.]+$/, '')}-edited.png` : pdfData?.originalName || pdfData?.name || 'document.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {

      setActionError(err.message || 'Failed to download PDF')
    } finally {
      setDownloading(false)
    }
  }

  const handleDelete = async () => {
    if (!await confirmation.ask('Move this document to Trash? You can restore it from the library.', 'Move to Trash')) return
    try {
      const response = await fetch(`/api/pdfs/${pdfId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Could not move this document to Trash.')
      onClose()
    } catch (err) {

      setActionError(err.message || 'Could not move this document to Trash.')
    }
  }

  const resizeSelected = factor => {
    const item=pathsRef.current.find(item=>item.id===selectedInsertId)
    if(!item || currentTool !== 'select')return
    if(item.tool==='image')resizeInsert(item.id,factor)
    else if(item.tool==='text'){pushHistory();handleFontDelta(item.id,factor>1?2:-2)}
  }
  const nudgeSelected = (dx,dy) => {
    const item=pathsRef.current.find(item=>item.id===selectedInsertId)
    if(!item||!pageBase||currentTool!=='select')return
    const changes=moveInsert(item,insertSize(item),{x:item.x+dx,y:item.y+dy},{x:0,y:0},pageBase)
    if(changes.x===item.x&&changes.y===item.y)return
    pushHistory();updatePaths(prev=>prev.map(value=>value.id===item.id?{...value,...changes}:value))
  }
  useShortcuts('Visual editor', {
    'pdf-save': handleSave, 'pdf-download': handleDownload, undo, redo, 'redo-y': redo,
    'move-tool': () => {commitText();setCurrentTool('select')}, 'text-tool': () => setCurrentTool('text'),
    'pen-tool': () => {commitText();setCurrentTool('pen')}, 'highlight-tool': () => {commitText();setCurrentTool('highlighter')},
    'eraser-tool': () => {commitText();setCurrentTool('eraser')},
    insert: () => overlayRef.current?.closest('.pdf-editor')?.querySelector('.insert-trigger')?.click(),
    'previous-page': () => goToPage(pageNumber-1), 'next-page': () => goToPage(pageNumber+1),
    'zoom-in': handleZoomIn, 'zoom-out': handleZoomOut, fit: handleFitWidth, rotate: handleRotate,
    'delete-insert': () => { if(selectedInsertId && currentTool==='select'){handleDeleteText(selectedInsertId);setSelectedInsertId(null)} },
    'grow-insert': () => resizeSelected(1.1), 'shrink-insert': () => resizeSelected(.9),
    'nudge-left': () => nudgeSelected(-2,0), 'nudge-right': () => nudgeSelected(2,0), 'nudge-up': () => nudgeSelected(0,-2), 'nudge-down': () => nudgeSelected(0,2),
    'pdf-close': () => { if (showSettings) setShowSettings(false); else handleClose() },
  }, !loading && !deletingPage && !confirmation.pending)

  /* ---------- rendering helpers ---------- */
  const renderStroke = (s, key) => {
    const pts = s.points
    const highlighter = s.tool === 'highlighter'
    const opacity = highlighter ? 0.3 : 1
    if (pts.length === 1) {
      return <circle key={key} cx={pts[0].x} cy={pts[0].y} r={s.strokeWidth / 2} fill={s.color} opacity={opacity} />
    }
    if (highlighter || !usePressure) {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
      return (
        <path
          key={key}
          d={d}
          fill="none"
          stroke={s.color}
          strokeWidth={s.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={opacity}
        />
      )
    }
    return (
      <g key={key}>
        {pts.slice(1).map((p, i) => (
          <line
            key={i}
            x1={pts[i].x}
            y1={pts[i].y}
            x2={p.x}
            y2={p.y}
            stroke={s.color}
            strokeWidth={s.strokeWidth * pressureFactor(pts[i], p)}
            strokeLinecap="round"
          />
        ))}
      </g>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8">
          <div className="animate-spin text-primary-500 mx-auto">
            <Upload size={40} />
          </div>
          <p className="text-white mt-4 text-center">Loading document…</p>
        </div>
      </div>
    )
  }

  const ready = !!pageBase && pageBase.page === pageNumber
  const quarterTurn = rotation % 180 !== 0
  const renderW = ready ? (quarterTurn ? pageBase.h : pageBase.w) * scale : 0
  const renderH = ready ? (quarterTurn ? pageBase.w : pageBase.h) * scale : 0
  const cursor =
    currentTool === 'text' ? 'text' : currentTool === 'eraser' ? 'cell' : 'crosshair'
  const pageItems = drawingPaths.filter(i => (i.page || 1) === pageNumber)

  const activePageView = (
            <div
              className="relative shrink-0 pdf-page-surface"
              style={ready ? { width: renderW, height: renderH } : undefined}
            >
              <Document
                options={PDF_OPTIONS}
                file={pdfFile}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<div className="text-white">Loading document…</div>}
                error={<div className="text-red-400">Could not render this document</div>}
                className="shadow-2xl"
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={((pageBase?.page === pageNumber ? pageBase.rotation : 0) + rotation) % 360}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadSuccess={onPageLoadSuccess}
                  loading={<div className="text-white">Loading page...</div>}
                  error={<div className="text-red-400">Failed to load page</div>}
                  className="bg-white"
                />
              </Document>

              {/* Annotation overlay: laid out in unrotated page space, then rotated to match the page */}
              {ready && (
                <div
                  ref={overlayRef}
                  style={{
                    position: 'absolute',
                    left: (renderW - pageBase.w * scale) / 2,
                    top: (renderH - pageBase.h * scale) / 2,
                    width: pageBase.w * scale,
                    height: pageBase.h * scale,
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    cursor,
                    zIndex: 10,
                    touchAction: 'none',
                    userSelect: 'none'
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onPointerLeave={()=>{if(eraserCursorRef.current)eraserCursorRef.current.style.display='none'}}
                >
                  <svg
                    viewBox={`0 0 ${pageBase.w} ${pageBase.h}`}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  >
                    {pageItems.filter(i => i.points).map((s) => renderStroke(s, s.id))}
                    {currentTool==='eraser'&&<rect ref={eraserCursorRef} width={eraserSize} height={eraserSize} rx={eraserShape==='round'?eraserSize/2:0} fill="#8fa5b918" stroke="#526c83" strokeWidth={1.3/scale} style={{display:'none'}}/>}
                    {(currentTool==='calculate'||currentTool==='snippet')&&calculationBox&&<rect x={calculationBox.x} y={calculationBox.y} width={calculationBox.width} height={calculationBox.height} fill="#8fa5b933" stroke="#8fa5b9" strokeWidth={1.5/scale} strokeDasharray={`${4/scale} ${3/scale}`}/>}
                    {currentPath.length > 0 &&
                      renderStroke(
                        {
                          points: currentPath,
                          color: currentColor,
                          tool: currentTool,
                          strokeWidth: currentTool === 'highlighter' ? strokeWidth * 3 : strokeWidth
                        },
                        'current'
                      )}
                  </svg>

                  {pageItems.filter(i => i.tool === 'image').map(item => (
                    <div key={item.id} style={{ position: 'absolute', left: item.x * scale, top: item.y * scale, width: item.width * scale, height: item.height * scale, pointerEvents: currentTool === 'select' ? 'auto' : 'none', outline: currentTool === 'select' && selectedInsertId === item.id ? '2px solid #8fa5b9' : undefined, touchAction: 'none', cursor: currentTool === 'select' ? 'move' : 'pointer', zIndex: selectedInsertId === item.id ? 25 : 15 }}
                      onPointerDown={e => {
                        e.stopPropagation(); e.preventDefault()
                        if (currentTool === 'eraser') { handleDeleteText(item.id); return }
                        if (e.pointerType === 'mouse' && e.button !== 0) return
                        setSelectedInsertId(item.id)
                        e.currentTarget.setPointerCapture(e.pointerId)
                        handleTextDragStart(e, item)
                      }}
                      onPointerMove={handleTextDragMove}
                      onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); handleTextDragEnd() }}
                      onPointerCancel={() => handleTextDragEnd(true)}
                      onLostPointerCapture={() => handleTextDragEnd()}>
                      <img src={item.dataUrl} alt={item.label || 'Inserted image'} draggable={false} style={{ width: '100%', height: '100%', display: 'block' }} />
                      {currentTool === 'select' && selectedInsertId === item.id && <InsertHandles item={item} onStart={handleResizeStart} onMove={handleTextDragMove} onEnd={handleTextDragEnd} />}
                      {currentTool === 'select' && selectedInsertId === item.id && <div className="pdf-insert-controls" onPointerDown={e => e.stopPropagation()}>
                        <span className="text-xs">Drag to move</span>
                        <button aria-label="Shrink insert" title="Shrink insert" onClick={() => resizeInsert(item.id, 0.8)}><Minus size={16} /></button>
                        <button aria-label="Enlarge insert" title="Enlarge insert" onClick={() => resizeInsert(item.id, 1.25)}><Plus size={16} /></button>
                        <button aria-label="Delete insert" title="Delete insert" onClick={() => handleDeleteText(item.id)}><Trash2 size={16} /></button>
                      </div>}
                    </div>
                  ))}

                  {pageItems.filter(i => i.tool === 'text').map((item) => (
                    <TextAnnotation
                      key={item.id}
                      item={item}
                      scale={scale}
                      isActive={activeTextId === item.id}
                      tool={currentTool}
                      textareaRef={textareaRef}
                      onClick={handleTextClick}
                      onChange={handleTextChange}
                      onCommit={commitText}
                      onDelete={handleDeleteText}
                      onFontDelta={handleFontDelta}
                      onColorChange={handleAnnotationColorChange}
                      onDragStart={handleTextDragStart}
                      onDragMove={handleTextDragMove}
                      onDragEnd={handleTextDragEnd}
                      onResizeStart={handleResizeStart}
                      selected={selectedInsertId === item.id}
                      onSelect={setSelectedInsertId}
                      onSave={handleSave}
                      onDownload={handleDownload}
                    />
                  ))}
                </div>
              )}
            </div>
  )

  return (
    <div ref={editorRootRef} className={cn("pdf-editor fixed inset-0 bg-slate-950 flex flex-col z-50",focusMode&&"pdf-focus-mode",focusMode&&fingerScroll&&"pdf-finger-scroll")} role="region" aria-label="Visual document editor" aria-busy={deletingPage} onPointerDownCapture={e => { if (deletingPage) { e.preventDefault(); e.stopPropagation() } }} onKeyDownCapture={e => { if (deletingPage) { e.preventDefault(); e.stopPropagation() } }}>
      {deletingPage && <div className="inline-operation-status" role="status"><Loader2 className="animate-spin" size={17} />Updating pages…</div>}
      <InlineConfirmation {...confirmation} />
      {focusMode&&<div className="pdf-focus-toolbar" role="toolbar" aria-label="Fullscreen annotation tools" data-keep-text-active>
        {TOOLS.map(tool=><button key={tool} type="button" className={cn('pdf-tool-button',currentTool===tool&&'is-active')} aria-pressed={currentTool===tool} title={tool==='select'?'Move and resize':tool} aria-label={tool==='select'?'Move and resize':tool} onClick={()=>{commitText();setCurrentTool(tool)}}>{tool==='pen'?<Pen size={18}/>:tool==='highlighter'?<Highlighter size={18}/>:tool==='text'?<Type size={18}/>:tool==='eraser'?<Eraser size={18}/>:<Move size={18}/>}</button>)}
        <input type="color" aria-label="Annotation color" title="Annotation color" value={currentColor} onChange={event=>handleColorChange(event.target.value)}/>
        <input type="range" aria-label="Annotation size" title="Annotation size" min={currentTool==='text'?6:currentTool==='eraser'?2:1} max={currentTool==='text'?144:currentTool==='eraser'?160:40} step="1" value={currentTool==='text'?fontSize:currentTool==='eraser'?eraserSize:strokeWidth} onChange={event=>{const size=Number(event.target.value);if(currentTool==='text')handleFontSizeChange(size);else if(currentTool==='eraser')setEraserSize(size);else setStrokeWidth(size)}}/>
        <button type="button" className="pdf-control" onClick={undo} disabled={!historyCount.undo} title="Undo"><Undo size={17}/></button>
        <button type="button" className="pdf-control" onClick={redo} disabled={!historyCount.redo} title="Redo"><Redo size={17}/></button>
        {!exportImage&&<><button type="button" className="pdf-control" disabled={pageNumber<=1} aria-label="Previous page" onClick={()=>goToPage(pageNumber-1)}>‹</button><span className="pdf-focus-page-count">{pageNumber}/{numPages||'…'}</span><button type="button" className="pdf-control" disabled={pageNumber>=numPages} aria-label="Next page" onClick={()=>goToPage(pageNumber+1)}>›</button></>}
        <button type="button" className="pdf-control" title="Fit page width" aria-label="Fit page width" onClick={handleFitWidth}><Maximize size={17}/></button>
        <button type="button" className="pdf-control" title="Save" aria-label="Save" onClick={handleSave} disabled={saveStatus==='saving'}><Save size={17}/></button>
        <button type="button" className={cn('pdf-control',fingerScroll&&'is-active')} aria-pressed={fingerScroll} onClick={()=>{handleTextDragEnd();commitText();setFingerScroll(value=>!value)}} title="Scroll with fingers; pen and mouse still annotate"><Move size={17}/><span>{fingerScroll?'Finger scroll':'Finger draw'}</span></button>
        <button type="button" className="pdf-control" onClick={exitFocusMode} title="Exit fullscreen (Esc)"><X size={17}/><span>Exit</span></button>
      </div>}
      <header className="pdf-editor-header">
        <div className="pdf-editor-identity"><FileText size={22}/><div><h2 title={pdfData?.name}>{pdfData?.name || 'Document editor'}</h2><div className="pdf-editor-metadata"><span>{exportImage ? 'Image annotations' : `PDF · ${numPages || '…'} pages`}</span><span className={`pdf-save-status is-${saveStatus}`} role="status">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'All changes saved' : saveStatus === 'error' ? 'Save failed — retry Save' : 'Unsaved changes'}</span></div></div></div>
        <div className="pdf-editor-actions">
          <button type="button" className="pdf-control" onClick={enterFocusMode} title="Fullscreen with compact annotation tools"><Maximize size={16}/><span>Fullscreen</span></button>
          <button type="button" className="pdf-control" aria-expanded={showCalculator} onClick={()=>{commitText();setShowCalculator(value=>!value)}}><Calculator size={16}/><span>Calculator</span></button>
          <div className="pdf-history-actions"><button className="pdf-control" onClick={undo} disabled={historyCount.undo === 0} title="Undo (Ctrl+Z)" aria-label="Undo"><Undo size={17}/></button><button className="pdf-control" onClick={redo} disabled={historyCount.redo === 0} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Redo size={17}/></button></div>
          <button className="pdf-control" onClick={() => setShowSettings(v => !v)} aria-expanded={showSettings}><Settings size={16}/><span>Settings</span></button>
          <button type="button" className={cn('pdf-control',currentTool==='snippet'&&'is-active')} aria-pressed={currentTool==='snippet'} disabled={copyingSnippet} onClick={()=>{commitText();setCurrentTool('snippet')}} title="Drag a rectangle to copy PDF content and annotations">{copyingSnippet?'Copying…':'Copy region'}</button>
        <button type="button" className="pdf-control" disabled={!snippet||!pageBase||pageBase.page!==pageNumber||inserting||deletingPage} onClick={pasteSnippet} title="Paste the copied region onto the current page">Paste snippet</button>
        {currentTool==='snippet'&&<span className="text-slate-300 text-sm">Drag a region to copy. {snippet?'Snippet ready — open any page and paste.':'Then open a destination page and paste.'}</span>}
        {!exportImage&&<button type="button" className="pdf-control" aria-pressed={continuousView} disabled={deletingPage||inserting} title="Toggle continuous scrolling through all PDF pages" onClick={()=>{handleTextDragEnd();commitText();setContinuousView(value=>!value)}}><Files size={16}/><span>{continuousView?'Continuous view':'Single page'}</span></button>}
          <button type="button" className="pdf-control" aria-pressed={darkPages} title="Invert page colors for comfortable reading; exported files keep their original colors" onClick={()=>setDarkPages(value=>!value)}>{darkPages?<Sun size={16}/>:<Moon size={16}/>}<span>{darkPages?'Light pages':'Dark pages'}</span></button>
          <button className="pdf-control pdf-control-primary" onClick={handleSave} disabled={saveStatus === 'saving'}><Save size={16}/><span>Save</span></button>
          <button className="pdf-control" onClick={handleDownload} disabled={downloading} title={exportImage ? 'Download edited image as PNG' : 'Download PDF with annotations'}>{downloading ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>}<span>{downloading ? 'Exporting…' : 'Download'}</span></button>
          <button className="pdf-control" onClick={handleClose} title="Close editor" aria-label="Close editor"><X size={18}/></button>
        </div>
      </header>

      {/* Toolbar. Mousedown is prevented (except on sliders) so clicking here never steals focus from an open text box. */}
      <div
        data-keep-text-active
        className="pdf-editor-toolbar bg-slate-800 border-b border-white/10 px-4 py-3 flex items-center gap-4"
        onMouseDown={(e) => {
          if (activeTextId && e.target.closest('button') && !e.target.closest('.pdf-insert-popover')) e.preventDefault()
        }}
      >
        <InsertPanel onPages={exportImage ? undefined : handleAddPages} pageNumber={pageNumber} onFiles={insertFiles} onInsert={insertGenerated} color={currentColor} busy={inserting || !pageBase || pageBase.page !== pageNumber || deletingPage} />
        <div className="pdf-editor-tool-options">
        {!exportImage&&<button type="button" className="pdf-control" disabled={loading||!numPages||!pageBase||pageBase.page!==pageNumber||deletingPage||inserting} title={`Insert a blank page after page ${pageNumber}`} onClick={()=>handleAddPages({mode:'blank',placement:'after'})}><Plus size={16}/>Blank page after</button>}
        {!exportImage&&<button type="button" className="pdf-control pdf-control-danger" onClick={()=>handleDeletePage()} disabled={!numPages||numPages<=1||deletingPage||inserting} title={numPages===1?'Keep at least one page in the PDF':`Delete page ${pageNumber} and its annotations`}><Trash2 size={16}/>Delete page {pageNumber}</button>}
        <button type="button" className={cn('pdf-control',currentTool==='calculate'&&'is-active')} aria-pressed={currentTool==='calculate'} title="Drag a box over one readable math expression" onClick={()=>{commitText();setCurrentTool('calculate')}}><Calculator size={16}/>Calculate selection</button>
        {currentTool==='calculate'&&<label className="pdf-math-mode">Recognition <select aria-label="Math recognition mode" value={calculationMode} onChange={event=>setCalculationMode(event.target.value)}><option value="auto">Auto · AI fallback</option><option value="vision">Handwriting / AI</option><option value="text">Text only · local</option></select></label>}
        {!exportImage && <button onClick={() => setShowPages(v => !v)} aria-label="Toggle pages" aria-expanded={showPages} className={cn('p-2 rounded-lg', showPages ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400')} title="Pages"><PanelLeft size={20} /></button>}
        <div className="pdf-tool-group" role="group" aria-label="Annotation tools">
          {TOOLS.map((tool) => (
            <button
              key={tool}
              aria-label={tool === 'select' ? 'Move and resize' : tool === 'text' ? 'Text' : tool.charAt(0).toUpperCase() + tool.slice(1)}
              aria-pressed={currentTool === tool}
              onClick={() => {
                commitText()
                setCurrentTool(tool)
              }}
              className={cn(
                'pdf-tool-button',
                currentTool === tool ? 'is-active' : ''
              )}
              title={tool === 'text' ? 'Insert Text' : tool.charAt(0).toUpperCase() + tool.slice(1)}
            >
              {tool === 'pen' && <Pen size={18} />}
              {tool === 'highlighter' && <Highlighter size={18} />}
              {tool === 'text' && <Type size={18} />}
              {tool === 'select' && <Move size={18} />}
              {tool === 'eraser' && <Eraser size={18} />}<span>{tool === 'select' ? 'Move' : tool === 'text' ? 'Text' : tool.charAt(0).toUpperCase() + tool.slice(1)}</span>
            </button>
          ))}
        </div>

        <div className="pdf-color-group" role="group" aria-label="Annotation color">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={cn(
                'w-6 h-6 rounded-full transition-all border border-white/25',
                currentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 ' : ''
              )}
              style={{ backgroundColor: color }}
              aria-label={`Annotation color ${COLOR_NAMES[color] || color}`} aria-pressed={currentColor === color} title={COLOR_NAMES[color] || color}
            />
          ))}
        </div>

        {currentTool === 'text' ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Font size:</span>
            <input
              type="range"
              aria-label="Text font size"
              min="6"
              max="144"
              value={fontSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
              className="w-24"
            />
            <input type="number" className="pdf-exact-size" aria-label="Exact font size" min="6" max="144" value={fontSize} onChange={event=>{if(event.target.value)handleFontSizeChange(Math.max(6,Math.min(144,Number(event.target.value))))}}/><span className="text-slate-400 text-xs">pt</span>
          </div>
        ) : currentTool === 'calculate' ? (
          <span className="text-slate-300 text-sm">Drag around one complete expression. {calculationMode==='text'?'Local text recognition only.':'AI sends only the selected image to Gemini; review its transcription.'}</span>
        ) : currentTool === 'select' ? (
          <span className="text-slate-300 text-sm">Drag content to move · drag corners to resize</span>
        ) : currentTool !== 'eraser' && currentTool !== 'snippet' ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Size:</span>
            <input
              type="range"
              aria-label="Stroke width"
              min="1"
              max="40"
              step="0.5"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-24"
            />
            <input type="number" className="pdf-exact-size" aria-label="Exact stroke width" min="1" max="40" step="0.5" value={strokeWidth} onChange={event=>{if(event.target.value)setStrokeWidth(Math.max(1,Math.min(40,Number(event.target.value))))}}/><span className="text-slate-400 text-xs">pt</span>
          </div>
        ) : (
          <PDFEraserControls mode={eraserMode} onMode={setEraserMode} size={eraserSize} onSize={setEraserSize} shape={eraserShape} onShape={setEraserShape} target={eraserTarget} onTarget={setEraserTarget}/>
        )}

        {['pen','highlighter'].includes(currentTool) && <button className="pdf-control pdf-pressure" onClick={() => setUsePressure(!usePressure)} aria-pressed={usePressure} title="Use pen pressure to vary stroke width"><Pen size={15}/>Pressure {usePressure ? 'on' : 'off'}</button>}
        <div className="pdf-zoom-group" role="group" aria-label="Page view">
          <button
            onClick={handleZoomOut}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-white text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button onClick={handleFitWidth} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg" title="Fit to width" aria-label="Fit to width"><Maximize size={18} /></button>
          <button
            onClick={handleRotate}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Rotate view"
          >
            <RotateCw size={18} />
          </button>
        </div>
        </div>
      </div>

      {actionError && <div role="alert" className="flex items-center justify-between gap-3 bg-red-950 px-5 py-2 text-sm text-red-200">{actionError}<button onClick={() => setActionError(null)} aria-label="Dismiss error"><X size={16} /></button></div>}
      <div className={cn('flex flex-1 min-h-0 relative',darkPages&&'pdf-dark-pages')}>
        <PDFCalculator open={showCalculator&&!focusMode} onClose={()=>setShowCalculator(false)} selection={calculationSelection}/>
        {!focusMode && showPages && pdfFile && !pdfError && (
          <aside className="pdf-pages w-48 sm:w-56 shrink-0 overflow-y-auto border-r border-white/10 bg-slate-900/90" aria-label="Document pages">
            <div className="sticky top-0 z-10 bg-slate-900 px-4 py-4 border-b border-white/5 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-widest text-slate-300">Pages</span><span className="text-xs text-slate-500">{numPages || '…'} total</span></div>
            <p className="px-4 py-2 text-xs text-slate-400">Drag pages to reorder · Alt+↑/↓</p>
            <Document options={PDF_OPTIONS} file={pdfFile} loading={<p className="p-4 text-xs text-slate-400">Loading previews…</p>}>
              {Array.from({ length: numPages || 0 }, (_, index) => {
                const n = index + 1
                const count = drawingPaths.filter(item => (item.page || 1) === n).length
                return <div key={n} className="pdf-page-entry"><button type="button" disabled={deletingPage||inserting} draggable={!deletingPage&&!inserting&&numPages>1}
                  onDragStart={event=>{pageDragRef.current=n;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(n))}}
                  onDragOver={event=>{if(!pageDragRef.current||deletingPage||inserting)return;event.preventDefault();event.dataTransfer.dropEffect='move';setPageDropTarget(n)}}
                  onDrop={event=>handlePageDrop(event,n)}
                  onDragEnd={()=>{pageDragRef.current=null;setPageDropTarget(null)}}
                  onKeyDown={event=>{if(event.altKey&&(event.key==='ArrowUp'||event.key==='ArrowDown')){event.preventDefault();const target=n+(event.key==='ArrowUp'?-1:1);if(target>=1&&target<=numPages)handleAddPages({mode:'reorder',sourcePage:n,targetIndex:target-1})}}}
                  title="Drag to move this page here; Alt+Up/Down also reorders"
                  style={{outline:pageDropTarget===n?'2px solid #8fa5b9':undefined,outlineOffset:-2,cursor:deletingPage||inserting?'wait':'grab'}}
                  onClick={() => goToPage(n)} aria-label={`Go to page ${n}${count ? `, ${count} annotations` : ''}`} aria-current={pageNumber === n ? 'page' : undefined} className={cn('pdf-page-tile', pageNumber === n && 'is-selected')}>
                  <div className="pdf-page-preview"><PagePreview pageNumber={n} />{count > 0 && <span className="pdf-page-badge">{count} {count === 1 ? 'edit' : 'edits'}</span>}</div>
                  <span className="flex items-center justify-between mt-3 text-xs"><span>Page {n}</span>{pageNumber === n && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}</span>
                </button>
                <button type="button" className="pdf-control pdf-control-danger" style={{margin:'0 12px 12px',fontSize:12}} draggable={false} disabled={numPages<=1||deletingPage||inserting} aria-label={`Delete page ${n}`} title={numPages<=1?'Keep at least one page in the PDF':`Delete page ${n} and its annotations`} onClick={()=>handleDeletePage(n)}><Trash2 size={14}/>Delete page {n}</button>
                </div>
              })}
            </Document>
          </aside>
        )}
      {/* PDF Viewer */}
      <div tabIndex={0}
        onPointerDownCapture={event=>{if(focusMode&&fingerScroll&&event.pointerType==='touch'){event.stopPropagation();handleTextDragEnd();commitText()}}}
        onPointerMoveCapture={event=>{if(focusMode&&fingerScroll&&event.pointerType==='touch')event.stopPropagation()}}
        onPointerUpCapture={event=>{if(focusMode&&fingerScroll&&event.pointerType==='touch')event.stopPropagation()}}
        onPointerCancelCapture={event=>{if(focusMode&&fingerScroll&&event.pointerType==='touch')event.stopPropagation()}}
        aria-label="PDF canvas; paste or drop images here" onDragOver={e => { e.preventDefault() }} onDrop={e => { e.preventDefault(); insertFiles(Array.from(e.dataTransfer.files)) }} onPaste={e => { if (e.target.closest('textarea, input')) return; const files = Array.from(e.clipboardData.files); if (files.length) { e.preventDefault(); insertFiles(files) } else if(snippet){e.preventDefault();if(pageBase?.page===pageNumber&&!inserting&&!deletingPage){try{addImageInsert(snippet)}catch(error){setActionError(error.message)}}} }} ref={viewerRef} className="pdf-editor-canvas flex-1 min-w-0 overflow-auto bg-slate-950">
        <div className="flex min-h-full w-fit min-w-full items-start justify-center p-8">
          {pdfError ? (
            <div className="text-center py-12">
              <AlertCircle size={32} className="mx-auto mb-4 text-slate-400"/>
              <p className="text-red-400 text-lg">{pdfError}</p>
              <button onClick={() => { setPdfError(null); setLoading(true); fetchPDF() }} className="mt-4 px-4 py-2 rounded-lg bg-indigo-600 text-white">Retry loading</button>
            </div>
          ) : pdfFile ? (
            continuousView&&!exportImage ? <PDFContinuousView key={pdfId+':'+numPages} file={pdfFile} count={numPages} currentPage={pageNumber} activePage={activePageView} scale={scale} rotation={rotation} fallback={pageBase} annotations={drawingPaths} renderStroke={renderStroke} onActivate={activateContinuousPage} viewer={viewerRef} options={PDF_OPTIONS}/> : activePageView
          ) : (
            <div className="text-slate-400">No document data available</div>
          )}
        </div>
      </div>

      </div>
      {/* Page Navigation */}
      {!exportImage && <div className="pdf-editor-footer">
        <button
          onClick={() => goToPage(pageNumber - 1)}
          disabled={pageNumber <= 1}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all"
        >
          Previous
        </button>
        <label className="flex items-center gap-2 text-sm text-slate-400">Page <input aria-label="Page number" key={pageNumber} type="number" min={1} max={numPages || 1} defaultValue={pageNumber} onBlur={e => { goToPage(Number(e.target.value)); e.target.value = String(Math.max(1, Math.min(numPages || 1, Number(e.target.value) || 1))) }} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} className="w-14 rounded-lg bg-slate-800 border border-white/10 px-2 py-1.5 text-center text-white" /> of {numPages || '…'}</label>
        <button
          onClick={() => goToPage(pageNumber + 1)}
          disabled={pageNumber >= (numPages || 1)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all"
        >
          Next
        </button>
      {!exportImage && <button onClick={() => handleDeletePage()} disabled={!numPages || numPages <= 1 || deletingPage || inserting} className="pdf-control pdf-control-danger pdf-delete-page" title={numPages === 1 ? 'Keep at least one page in the PDF' : 'Delete the current page'}><Trash2 size={16} />Delete page</button>}
      </div>}



      {/* Settings Modal */}
      {showSettings && (
        <div className="pdf-settings-panel app-inline-panel" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setShowSettings(false) } }}>
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">Document settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                aria-label="Close document settings"
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="pdf-settings-fields">
              {actionError && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{actionError}</p>}
              <div>
                <label htmlFor="pdf-document-name" className="block text-slate-400 text-sm mb-2">Document name</label>
                <input
                  type="text"
                  id="pdf-document-name" value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="pdf-document-folder" className="block text-slate-400 text-sm mb-2">Folder</label>
                <div className="relative">
                  <select
                    id="pdf-document-folder" value={editFolder}
                    onChange={(e) => setEditFolder(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="">Unfiled</option>
                    {pdfFolders.map((folder) => (
                      <option key={folder._id} value={folder._id}>{folder.name}</option>
                    ))}
                  </select>
                  <Folder size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label htmlFor="pdf-document-tags" className="block text-slate-400 text-sm mb-2">Tags (comma-separated)</label>
                <div className="relative">
                  <input
                    type="text"
                    id="pdf-document-tags" value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="homework, important, chapter1"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
                  />
                  <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                {pdfData?.tags && pdfData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pdfData.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="pdf-settings-actions"><button className="pdf-control" onClick={handleClearCanvas}><Eraser size={15}/>Clear annotations</button><button className="pdf-control pdf-control-danger" onClick={handleDelete}><Trash2 size={15}/>Move document to Trash</button></div>
              <div className="flex gap-3 pt-2 pdf-settings-save">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMetadata}
                  disabled={savingMetadata}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {savingMetadata ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
