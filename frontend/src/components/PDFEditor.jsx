import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  X, Save, Download, Upload, Trash2, Pen, Highlighter, Eraser, ZoomIn, ZoomOut,
  RotateCw, Settings, Tag, Folder, Check, Loader2, Undo, Redo, Type, Move, Minus, Plus
} from 'lucide-react'
import { PDFDocument, rgb, degrees, StandardFonts, LineCapStyle } from 'pdf-lib'
import { cn } from '../lib/utils'

// Set up PDF.js worker for react-pdf v7
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

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
const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000']
const TOOLS = ['pen', 'highlighter', 'text', 'eraser']

const uid = () => `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

const hexToRgb = (hex) => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
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

    const { r, g, b } = hexToRgb(item.color)
    const color = rgb(r, g, b)

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
  onClick, onChange, onCommit, onDelete, onFontDelta,
  onDragStart, onDragMove, onDragEnd
}) {
  const interactive = tool === 'text' || tool === 'eraser'
  const fontSize = item.fontSize || 16
  const textStyle = {
    color: item.color,
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
        zIndex: isActive ? 30 : 20,
        pointerEvents: interactive ? 'auto' : 'none'
      }}
      // Keep these events away from the drawing overlay underneath
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {tool === 'text' && (
        <div
          data-keep-text-active
          onMouseDown={(e) => e.preventDefault()}
          className={cn(
            'absolute left-0 flex items-center gap-0.5 bg-slate-900/95 border border-blue-500/50 rounded px-1 py-0.5 shadow-lg select-none z-40 whitespace-nowrap transition-opacity',
            toolbarBelow ? 'top-full' : 'bottom-full',
            isActive ? 'opacity-100' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
          )}
        >
          <div
            title="Drag to move"
            className="p-1 text-slate-300 hover:text-white cursor-move touch-none"
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
            onPointerCancel={onDragEnd}
          >
            <Move size={12} />
          </div>
          <button
            onClick={() => onFontDelta(item.id, -2)}
            className="p-0.5 text-slate-300 hover:text-white hover:bg-white/10 rounded"
            title="Smaller text"
          >
            <Minus size={12} />
          </button>
          <span className="text-[10px] text-slate-300 w-5 text-center tabular-nums">{fontSize}</span>
          <button
            onClick={() => onFontDelta(item.id, 2)}
            className="p-0.5 text-slate-300 hover:text-white hover:bg-white/10 rounded"
            title="Larger text"
          >
            <Plus size={12} />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-0.5 text-slate-300 hover:text-red-400 hover:bg-red-500/20 rounded"
            title="Delete text"
          >
            <Trash2 size={12} />
          </button>
          {isActive && (
            <button
              onClick={onCommit}
              className="p-0.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded"
              title="Done (Esc)"
            >
              <Check size={12} />
            </button>
          )}
        </div>
      )}

      {isActive ? (
        // Hidden mirror gives the box its size; the textarea sits on top of it.
        <div className="relative inline-block" style={{ minWidth: 40 * scale }}>
          <div aria-hidden style={{ ...textStyle, visibility: 'hidden' }}>
            {(item.text || '') + ' '}
          </div>
          <textarea
            ref={textareaRef}
            value={item.text}
            wrap="off"
            rows={1}
            spellCheck={false}
            placeholder="Type…"
            onChange={(e) => onChange(item.id, e.target.value)}
            onBlur={(e) => {
              if (e.relatedTarget?.closest?.('[data-keep-text-active]')) return
              onCommit()
            }}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault()
                onCommit()
              }
            }}
            style={{
              ...textStyle,
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              resize: 'none',
              overflow: 'hidden',
              outline: 'none',
              background: 'rgba(255,255,255,0.55)',
              boxShadow: '0 0 0 1.5px #3b82f6',
              borderRadius: 2
            }}
          />
        </div>
      ) : (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onClick(item)
          }}
          style={{ ...textStyle, minWidth: 12 }}
          className={cn(
            'rounded select-none',
            tool === 'text' && 'cursor-text hover:shadow-[0_0_0_1px_rgba(59,130,246,0.8)] hover:bg-blue-500/10',
            tool === 'eraser' && 'cursor-pointer hover:shadow-[0_0_0_1px_rgba(239,68,68,0.8)] hover:bg-red-500/20 hover:line-through'
          )}
        >
          {item.text}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main editor                                                         */
/* ------------------------------------------------------------------ */
export default function PDFEditor({ pdfId, onClose, token }) {
  const [pdfData, setPdfData] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [pageBase, setPageBase] = useState(null) // { page, w, h } in page units
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [currentTool, setCurrentTool] = useState('text')
  const [currentColor, setCurrentColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [fontSize, setFontSize] = useState(16)
  const [activeTextId, setActiveTextId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
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
  const saveAnnotations = useCallback(async () => {
    setSaveStatus('saving')
    dirtyRef.current = false
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ annotations: cleanForSave(pathsRef.current) })
      })
      if (!response.ok) throw new Error('Failed to save annotations')
      setSaveStatus(dirtyRef.current ? 'dirty' : 'saved')
      return true
    } catch (err) {
      console.error('Error saving annotations:', err)
      dirtyRef.current = true
      setSaveStatus('error')
      return false
    }
  }, [pdfId, token])

  // Autosave 1s after the last change (including deletions)
  useEffect(() => {
    if (!dirtyRef.current) return
    const timer = setTimeout(() => { saveAnnotations() }, 1000)
    return () => clearTimeout(timer)
  }, [drawingPaths, saveAnnotations])

  const handleClose = async () => {
    commitText()
    if (dirtyRef.current) await saveAnnotations()
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
      const response = await fetch(`/api/pdfs/${pdfId}`, {
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
            console.error('Error converting base64 to file:', err)
            setPdfError('Failed to process PDF data')
          }
        }

        const loaded = (data.annotations || []).map(a => (a.id ? a : { ...a, id: uid() }))
        updatePaths(loaded, { silent: true })
        dirtyRef.current = false
        setSaveStatus('saved')
        setEditName(data.name || '')
        setEditTags(data.tags?.join(', ') || '')
        setEditFolder(data.pdfFolder || '')
        setPdfError(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setPdfError(errorData.message || 'Failed to fetch PDF')
      }
    } catch (err) {
      console.error('Error fetching PDF:', err)
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
      if (response.ok) setPdfFolders(await response.json())
    } catch (err) {
      console.error('Error fetching PDF folders:', err)
    }
  }

  const handleSaveMetadata = async () => {
    setSavingMetadata(true)
    try {
      const response = await fetch(`/api/pdfs/${pdfId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: editName,
          tags: editTags.split(',').map(t => t.trim()).filter(t => t),
          pdfFolder: editFolder
        })
      })
      if (response.ok) {
        const data = await response.json()
        setPdfData(prev => ({ ...prev, ...data, pdfData: prev?.pdfData }))
        setShowSettings(false)
      }
    } catch (err) {
      console.error('Error saving metadata:', err)
    } finally {
      setSavingMetadata(false)
    }
  }

  /* ---------- react-pdf callbacks ---------- */
  const onDocumentLoadSuccess = ({ numPages }) => setNumPages(numPages)

  const onDocumentLoadError = (error) => {
    console.error('PDF load error:', error)
    setPdfError(`Failed to load PDF: ${error.message || 'Unknown error'}`)
  }

  const onPageLoadSuccess = (page) => {
    // Viewport at scale 1 honours the page's own /Rotate, matching what is displayed
    const vp = page.getViewport({ scale: 1 })
    setPageBase({ page: page.pageNumber, w: vp.width, h: vp.height })
  }

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

  const handleFontSizeChange = (size) => {
    setFontSize(size)
    const id = activeTextIdRef.current
    if (id) updatePaths(prev => prev.map(i => (i.id === id ? { ...i, fontSize: size } : i)))
  }

  const handleFontDelta = (id, delta) => {
    updatePaths(prev => prev.map(i =>
      i.id === id ? { ...i, fontSize: Math.max(8, Math.min(96, (i.fontSize || 16) + delta)) } : i
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

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z / Ctrl+Y when not typing
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
      if (!(e.ctrlKey || e.metaKey)) return
      const key = e.key.toLowerCase()
      if (key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
      else if (key === 'y') { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

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
    setCurrentColor(item.color)
    setFontSize(item.fontSize || 16)
    activate(item.id)
  }

  const handleTextDragStart = (e, item) => {
    const pt = toLocal(e)
    dragRef.current = { id: item.id, dx: pt.x - item.x, dy: pt.y - item.y, moved: false, snapshot: pathsRef.current }
  }

  const handleTextDragMove = (e) => {
    const drag = dragRef.current
    if (!drag || !pageBase) return
    const pt = toLocal(e)
    const x = Math.max(0, Math.min(pageBase.w - 10, pt.x - drag.dx))
    const y = Math.max(0, Math.min(pageBase.h - 10, pt.y - drag.dy))
    if (!drag.moved) {
      drag.moved = true
      if (activeTextIdRef.current !== drag.id) pushHistoryRaw(drag.snapshot)
    }
    updatePaths(prev => prev.map(i => (i.id === drag.id ? { ...i, x, y } : i)))
  }

  const handleTextDragEnd = () => {
    dragRef.current = null
  }

  /* ---------- eraser ---------- */
  const eraseAt = (pt) => {
    const radius = 10 / scale
    const hits = (i) => i.page === pageNumber && i.points && strokeHit(i, pt, radius)
    if (!pathsRef.current.some(hits)) return
    if (!erasedRef.current) {
      pushHistory()
      erasedRef.current = true
    }
    updatePaths(prev => prev.filter(i => !hits(i)))
  }

  /* ---------- overlay pointer handlers ---------- */
  const handlePointerDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (!overlayRef.current) return

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
        color: currentColor,
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
      erasedRef.current = false
      eraseAt(pt)
      return
    }

    isDrawingRef.current = true
    currentPathRef.current = [{ x: pt.x, y: pt.y, pressure: getPressure(e.nativeEvent) }]
    setCurrentPath(currentPathRef.current.slice())
  }

  const handlePointerMove = (e) => {
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
    overlayRef.current?.releasePointerCapture?.(e.pointerId)
    if (isErasingRef.current) {
      isErasingRef.current = false
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
  const handleClearCanvas = () => {
    if (!pathsRef.current.length) return
    if (!confirm('Remove all annotations from this document?')) return
    commitText()
    pushHistory()
    updatePaths([])
    currentPathRef.current = []
    setCurrentPath([])
  }

  const goToPage = (n) => {
    commitText()
    setPageNumber(Math.max(1, Math.min(numPages || 1, n)))
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
    try {
      commitText()
      const response = await fetch(`/api/pdfs/${pdfId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!response.ok) throw new Error('Failed to fetch PDF')
      const pdfBytes = await response.arrayBuffer()

      let outBytes = pdfBytes
      const annotations = cleanForSave(pathsRef.current)
      if (annotations.length > 0) {
        try {
          outBytes = await burnAnnotations(pdfBytes, annotations, usePressure)
        } catch (err) {
          console.error('Error burning annotations into PDF:', err)
          alert('Could not add annotations to the PDF, downloading the original instead.')
        }
      }

      const blob = new Blob([outBytes], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfData?.originalName || pdfData?.name || 'document.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error downloading PDF:', err)
      alert('Failed to download PDF: ' + err.message)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this PDF?')) return
    try {
      const response = await fetch(`/api/pdfs/${pdfId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) onClose()
    } catch (err) {
      console.error('Error deleting PDF:', err)
      alert('Failed to delete PDF')
    }
  }

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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8">
          <div className="animate-spin text-primary-500 mx-auto">
            <Upload size={40} />
          </div>
          <p className="text-white mt-4 text-center">Loading PDF...</p>
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
  const pageItems = drawingPaths.filter(i => i.page === pageNumber)

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col z-50">
      {/* Header */}
      <div className="bg-slate-900 border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">{pdfData?.name || 'PDF Editor'}</h2>
          <span className="text-slate-400 text-sm">Page {pageNumber} of {numPages}</span>
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Loader2 className="animate-spin" size={14} />
              <span>Saving...</span>
            </div>
          )}
          {saveStatus === 'saved' && <span className="text-slate-500 text-sm">All changes saved</span>}
          {saveStatus === 'dirty' && <span className="text-slate-400 text-sm">Unsaved changes</span>}
          {saveStatus === 'error' && <span className="text-red-400 text-sm">Couldn’t save – will retry on next change</span>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={undo}
            disabled={historyCount.undo === 0}
            className="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
            title="Undo (Ctrl+Z)"
          >
            <Undo size={20} />
          </button>
          <button
            onClick={redo}
            disabled={historyCount.redo === 0}
            className="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all disabled:opacity-30 disabled:hover:bg-transparent"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo size={20} />
          </button>
          <button
            onClick={handleClearCanvas}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Clear All Annotations"
          >
            <Eraser size={20} />
          </button>
          <button
            onClick={() => setUsePressure(!usePressure)}
            className={cn(
              'p-2 rounded-lg transition-all',
              usePressure ? 'text-green-400 bg-green-500/10' : 'text-slate-400 hover:bg-white/10'
            )}
            title="Toggle Pen Pressure Sensitivity"
          >
            <Pen size={20} />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-all"
            title="PDF Settings"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={handleSave}
            className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-all"
            title="Save Annotations"
          >
            <Save size={20} />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
            title="Download PDF with annotations"
          >
            <Download size={20} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Delete PDF"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-all"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Toolbar. Mousedown is prevented (except on sliders) so clicking here never steals focus from an open text box. */}
      <div
        data-keep-text-active
        className="bg-slate-800 border-b border-white/10 px-4 py-3 flex items-center gap-4"
        onMouseDown={(e) => {
          if (e.target.tagName !== 'INPUT') e.preventDefault()
        }}
      >
        <div className="flex items-center gap-2 bg-slate-700 rounded-lg p-1">
          {TOOLS.map((tool) => (
            <button
              key={tool}
              onClick={() => setCurrentTool(tool)}
              className={cn(
                'p-2 rounded transition-all',
                currentTool === tool ? 'bg-primary-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-600'
              )}
              title={tool.charAt(0).toUpperCase() + tool.slice(1)}
            >
              {tool === 'pen' && <Pen size={18} />}
              {tool === 'highlighter' && <Highlighter size={18} />}
              {tool === 'text' && <Type size={18} />}
              {tool === 'eraser' && <Eraser size={18} />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={cn(
                'w-6 h-6 rounded-full transition-all',
                currentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : 'hover:scale-110'
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>

        {currentTool === 'text' ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Font size:</span>
            <input
              type="range"
              min="8"
              max="72"
              value={fontSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
              className="w-24"
            />
            <span className="text-white text-sm w-10">{fontSize}pt</span>
          </div>
        ) : currentTool !== 'eraser' ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Size:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
              className="w-24"
            />
            <span className="text-white text-sm">{strokeWidth}px</span>
          </div>
        ) : (
          <span className="text-slate-400 text-sm">Drag over a stroke or click a text box to erase it</span>
        )}

        <div className="flex items-center gap-2 ml-auto">
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
          <button
            onClick={handleRotate}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Rotate view"
          >
            <RotateCw size={18} />
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-slate-950">
        <div className="flex min-h-full w-fit min-w-full items-start justify-center p-8">
          {pdfError ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">❌</div>
              <p className="text-red-400 text-lg">{pdfError}</p>
              <p className="text-slate-400 text-sm mt-2">Please check the console for more details</p>
            </div>
          ) : pdfFile ? (
            <div
              className="relative shrink-0"
              style={ready ? { width: renderW, height: renderH } : undefined}
            >
              <Document
                file={pdfFile}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={<div className="text-white">Loading PDF...</div>}
                error={<div className="text-red-400">Failed to load PDF document</div>}
                className="shadow-2xl"
              >
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onLoadSuccess={onPageLoadSuccess}
                  loading={<div className="text-white">Loading page...</div>}
                  error={<div className="text-red-400">Failed to load page</div>}
                  className="border border-white/10"
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
                >
                  <svg
                    viewBox={`0 0 ${pageBase.w} ${pageBase.h}`}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                  >
                    {pageItems.filter(i => i.points).map((s) => renderStroke(s, s.id))}
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
                      onDragStart={handleTextDragStart}
                      onDragMove={handleTextDragMove}
                      onDragEnd={handleTextDragEnd}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-slate-400">No PDF data available</div>
          )}
        </div>
      </div>

      {/* Page Navigation */}
      <div className="bg-slate-900 border-t border-white/10 px-4 py-3 flex items-center justify-center gap-4">
        <button
          onClick={() => goToPage(pageNumber - 1)}
          disabled={pageNumber <= 1}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all"
        >
          Previous
        </button>
        <span className="text-white">{pageNumber} / {numPages}</span>
        <button
          onClick={() => goToPage(pageNumber + 1)}
          disabled={pageNumber >= (numPages || 1)}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all"
        >
          Next
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">PDF Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">PDF Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Folder</label>
                <div className="relative">
                  <select
                    value={editFolder}
                    onChange={(e) => setEditFolder(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="">Uncategorized</option>
                    {pdfFolders.map((folder) => (
                      <option key={folder._id} value={folder._id}>{folder.name}</option>
                    ))}
                  </select>
                  <Folder size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 text-sm mb-2">Tags (comma-separated)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editTags}
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

              <div className="flex gap-3 pt-2">
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
