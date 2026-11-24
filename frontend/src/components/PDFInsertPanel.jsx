import { useState, useEffect, useRef, useId } from 'react'
import { Plus, X, ChevronDown, Image as ImageIcon, FileText, Upload, Square, Circle, Minus, ArrowRight, Table, Stamp, Check, Files } from 'lucide-react'

export const INSERT_ACCEPT = 'image/*,application/pdf,text/plain,text/csv,.md,.svg,.webp,.bmp,.gif,.avif'
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function imageFromFile(file) {
  if (file.size > MAX_FILE_SIZE) throw new Error('Choose an image smaller than 10 MB.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const ratio = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio))
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, label: file.name || 'Pasted image' }
  } finally { URL.revokeObjectURL(url) }
}

const UNIT_CIRCLE_POINTS = [
  [0, '0', '1', '0'],
  [30, 'π/6', '√3/2', '1/2'],
  [45, 'π/4', '√2/2', '√2/2'],
  [60, 'π/3', '1/2', '√3/2'],
  [90, 'π/2', '0', '1'],
  [120, '2π/3', '−1/2', '√3/2'],
  [135, '3π/4', '−√2/2', '√2/2'],
  [150, '5π/6', '−√3/2', '1/2'],
  [180, 'π', '−1', '0'],
  [210, '7π/6', '−√3/2', '−1/2'],
  [225, '5π/4', '−√2/2', '−√2/2'],
  [240, '4π/3', '−1/2', '−√3/2'],
  [270, '3π/2', '0', '−1'],
  [300, '5π/3', '1/2', '−√3/2'],
  [315, '7π/4', '√2/2', '−√2/2'],
  [330, '11π/6', '√3/2', '−1/2']
]

function drawUnitCircle(ctx, size) {
  const center = size / 2, radius = 290
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(center - 420, center)
  ctx.lineTo(center + 420, center)
  ctx.moveTo(center, center - 420)
  ctx.lineTo(center, center + 420)
  ctx.stroke()

  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.arc(center, center, radius, 0, Math.PI * 2)
  ctx.stroke()

  for (const [degrees, radians, cosine, sine] of UNIT_CIRCLE_POINTS) {
    const angle = degrees * Math.PI / 180
    const x = Math.cos(angle), y = -Math.sin(angle)
    const pointX = center + radius * x, pointY = center + radius * y
    if (degrees % 90 !== 0) {
      ctx.save()
      ctx.globalAlpha = 0.32
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(center, center)
      ctx.lineTo(center + 175 * x, center + 175 * y)
      ctx.moveTo(center + 267 * x, center + 267 * y)
      ctx.lineTo(pointX, pointY)
      ctx.stroke()
      ctx.restore()
    }

    ctx.beginPath()
    ctx.arc(pointX, pointY, 6, 0, Math.PI * 2)
    ctx.fill()

    // Offset cardinal labels so the axes do not cross their text.
    const angleX = center + 220 * x + (degrees % 180 === 90 ? 53 : 0)
    const angleY = center + 220 * y + (degrees % 180 === 0 ? -34 : 0)
    ctx.font = '600 28px Arial'
    ctx.fillText(`${degrees}°`, angleX, angleY - 16)
    ctx.fillText(degrees === 0 ? '0 / 2π' : radians, angleX, angleY + 16)

    const coordinateX = center + 375 * x + (degrees % 180 === 90 ? 55 : 0)
    const coordinateY = center + 375 * y + (degrees % 180 === 0 ? 22 : 0)
    ctx.font = '28px Arial'
    ctx.fillText(`(${cosine}, ${sine})`, coordinateX, coordinateY)
  }

  ctx.font = '30px Arial'
  ctx.fillText('x', center + 440, center)
  ctx.fillText('y', center, center - 440)
  ctx.fillText('(cos θ, sin θ)', center, size - 36)
}

const EXACT_TANGENTS = [
  '0', '√3/3', '1', '√3', 'undefined', '−√3', '−1', '−√3/3',
  '0', '√3/3', '1', '√3', 'undefined', '−√3', '−1', '−√3/3'
]

function drawSpecialTriangle(ctx, x, width, topAngle, baseAngle, baseLength, hypotenuse) {
  const top = 670, base = 870, right = x + width
  ctx.beginPath()
  ctx.moveTo(x, base)
  ctx.lineTo(right, top)
  ctx.lineTo(right, base)
  ctx.closePath()
  ctx.stroke()
  ctx.strokeRect(right - 24, base - 24, 24, 24)

  ctx.fillText(baseAngle, x + 90, base - 31)
  ctx.fillText(topAngle, right - 31, top + 79)
  ctx.fillText(baseLength, x + width / 2, base + 28)
  ctx.fillText('1', right + 28, (top + base) / 2)
  ctx.fillText(hypotenuse, x + width / 2 - 24, (top + base) / 2 - 30)
}

function drawTrigReference(ctx) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 42px Arial'
  ctx.fillText('Exact trigonometric values', 600, 55)

  const rowHeight = 48
  const columnCenters = [47, 140, 251, 370, 491]
  const headers = ['Degrees', 'Radians', 'sin θ', 'cos θ', 'tan θ']
  for (const [table, start] of [0, 8].entries()) {
    const left = 44 + table * 572, top = 100
    ctx.font = '700 23px Arial'
    headers.forEach((header, col) => ctx.fillText(header, left + columnCenters[col], top + rowHeight / 2))
    ctx.font = '25px Arial'
    ctx.lineWidth = 1.5
    for (let row = 0; row < 8; row++) {
      const index = start + row
      const [degrees, radians, cosine, sine] = UNIT_CIRCLE_POINTS[index]
      const y = top + (row + 1) * rowHeight
      ctx.beginPath()
      ctx.moveTo(left, y)
      ctx.lineTo(left + 540, y)
      ctx.stroke()
      const values = [`${degrees}°`, radians, sine, cosine, EXACT_TANGENTS[index]]
      values.forEach((value, col) => ctx.fillText(value, left + columnCenters[col], y + rowHeight / 2))
    }
  }
  ctx.font = '24px Arial'
  ctx.fillText('360° (2π) has the same values as 0°.', 600, 551)
  ctx.font = '700 34px Arial'
  ctx.fillText('Special right triangles', 600, 612)
  ctx.font = '28px Arial'
  ctx.lineWidth = 4
  drawSpecialTriangle(ctx, 118, 200 * Math.sqrt(3), '60°', '30°', '√3', '2')
  drawSpecialTriangle(ctx, 775, 200, '45°', '45°', '1', '√2')
  ctx.font = '24px Arial'
  ctx.fillText('sin θ = opposite / hypotenuse     cos θ = adjacent / hypotenuse     tan θ = opposite / adjacent', 600, 959)
}

export function makeInsert(kind, color, options = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = kind === 'trig-reference' ? 1200 : kind === 'unit-circle' ? 1000 : kind === 'table' ? 720 : 480
  canvas.height = kind === 'trig-reference' || kind === 'unit-circle' ? 1000 : kind === 'table' ? 360 : 240
  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 6
  const lineStyle = ['dotted', 'dashed'].includes(options.lineStyle) ? options.lineStyle : 'solid'
  if (['rectangle', 'ellipse', 'line', 'arrow'].includes(kind)) {
    ctx.lineCap = lineStyle === 'dotted' ? 'round' : 'butt'
    ctx.setLineDash(lineStyle === 'dotted' ? [0, 18] : lineStyle === 'dashed' ? [24, 14] : [])
  }
  if (kind === 'unit-circle') drawUnitCircle(ctx, canvas.width)
  if (kind === 'trig-reference') drawTrigReference(ctx)
  if (kind === 'rectangle') ctx.strokeRect(8, 8, 464, 224)
  if (kind === 'ellipse') { ctx.beginPath(); ctx.ellipse(240, 120, 230, 110, 0, 0, Math.PI * 2); ctx.stroke() }
  if (kind === 'line' || kind === 'arrow') {
    ctx.beginPath(); ctx.moveTo(12, 120); ctx.lineTo(460, 120)
    ctx.stroke()
    if (kind === 'arrow') {
      ctx.setLineDash([])
      ctx.beginPath(); ctx.moveTo(420, 80); ctx.lineTo(460, 120); ctx.lineTo(420, 160); ctx.stroke()
    }
  }
  if (kind === 'stamp') {
    ctx.strokeRect(8, 45, 464, 150)
    ctx.font = 'bold 52px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(options.label || 'APPROVED', 240, 120, 440)
  }
  if (kind === 'table') {
    const rows = options.cells.split('\n').map(row => row.split('\t'))
    if (rows.length > 12) throw new Error('Tables support up to 12 rows.')
    const cols = Math.max(1, ...rows.map(row => row.length))
    if (cols > 8) throw new Error('Tables support up to 8 columns.')
    canvas.height = Math.max(120, rows.length * 60)
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.font = '20px Arial'; ctx.textBaseline = 'middle'
    const w = canvas.width / cols
    rows.forEach((row, r) => {
      for (let c = 0; c < cols; c++) {
        ctx.strokeRect(c * w + 1, r * 60 + 1, w - 2, 58)
        ctx.fillText(row[c] || '', c * w + 8, r * 60 + 30, w - 16)
      }
    })
  }
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, insertKind: kind, label: kind === 'stamp' ? options.label : SHAPES.find(shape => shape.kind === kind)?.label ?? kind }
}

const SHAPES = [
  { kind: 'rectangle', label: 'Rectangle', Icon: Square },
  { kind: 'ellipse', label: 'Ellipse', Icon: Circle },
  { kind: 'line', label: 'Line', Icon: Minus },
  { kind: 'arrow', label: 'Arrow', Icon: ArrowRight },
  { kind: 'unit-circle', label: 'Unit circle', Icon: Circle },
  { kind: 'trig-reference', label: 'Trig reference', Icon: Table }
]
const FILE_TYPES = [
  { label: 'Images', Icon: ImageIcon, accept: 'image/*,.svg,.webp,.bmp,.gif,.avif', formats: 'PNG, JPG, SVG, WebP, GIF, BMP, AVIF', hint: 'Insert a picture. Animated images use a still frame.' },
  { label: 'PDF page', Icon: FileText, accept: 'application/pdf,.pdf', formats: 'PDF', hint: 'Insert the first page as an image.' },
  { label: 'Text file', Icon: FileText, accept: 'text/plain,text/csv,.txt,.md,.csv', formats: 'TXT, Markdown, CSV', hint: 'Insert the file contents as editable text.' }
]

export default function InsertPanel({ onFiles, onInsert, onPages, pageNumber, color, busy, onOpen, closeSignal }) {
  const [open, setOpen] = useState(false)
  const [section, setSection] = useState('files')
  const [pageMode, setPageMode] = useState('files')
  const [placement, setPlacement] = useState('after')
  const [pageFiles, setPageFiles] = useState([])
  const [pageRange, setPageRange] = useState('')
  const [pageError, setPageError] = useState('')
  const [kind, setKind] = useState('rectangle')
  const [lineStyle, setLineStyle] = useState('solid')
  const [label, setLabel] = useState('APPROVED')
  const [rows, setRows] = useState(3)
  const [cols, setCols] = useState(2)
  const [values, setValues] = useState({})
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const fileRef = useRef(null)
  const id = useId()
  const close = () => { setOpen(false); triggerRef.current?.focus() }
  useEffect(()=>{if(closeSignal)setOpen(false)},[closeSignal])

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus({ preventScroll: true })
    const keyboard = e => { if (e.key === 'Escape' && panelRef.current?.contains(e.target)) { e.preventDefault(); setOpen(false); triggerRef.current?.focus() } }
    document.addEventListener('keydown', keyboard)
    return () => document.removeEventListener('keydown', keyboard)
  }, [open])

  const cells = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => values[`${r}:${c}`] || '').join('\t')).join('\n')
  const chooseFiles = accept => { fileRef.current.accept = accept; fileRef.current.click() }
  const submit = async () => {
    if (section === 'pages') {
      setPageError('')
      if (pageMode === 'files' && (!pageFiles.length || pageFiles.length > 10)) { setPageError('Choose between 1 and 10 PDF files.'); return }
      const success = await onPages({ mode: pageMode, placement, range: pageRange, files: pageMode === 'files' ? pageFiles : [] })
      if (success) { setPageFiles([]); close() }
      else setPageError('Pages could not be added. See the editor error message for details.')
      return
    }
    const type = section === 'shapes' ? kind : section === 'table' ? 'table' : 'stamp'
    if (onInsert(type, { label: label.trim(), cells, lineStyle }) !== false) close()
  }
  const pasteCells = (e, startRow, startCol) => {
    const text = e.clipboardData.getData('text/plain')
    if (!/[\t\n]/.test(text)) return
    e.preventDefault()
    const pasted = text.replace(/\r/g, '').replace(/\n$/, '').split('\n').map(row => row.split('\t'))
    const nextRows = Math.min(12, Math.max(rows, startRow + pasted.length))
    const nextCols = Math.min(8, Math.max(cols, startCol + Math.max(...pasted.map(row => row.length))))
    setRows(nextRows); setCols(nextCols)
    setValues(prev => {
      const next = { ...prev }
      pasted.forEach((row, r) => row.forEach((value, c) => { if (startRow + r < 12 && startCol + c < 8) next[`${startRow + r}:${startCol + c}`] = value }))
      return next
    })
  }

  return <div className="pdf-insert-panel">
    <button ref={triggerRef} type="button" className="insert-trigger" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => { if(!open)onOpen?.();setOpen(value => !value) }}><Plus size={17} />Insert<ChevronDown size={15} /></button>
    <input ref={fileRef} type="file" hidden multiple accept={INSERT_ACCEPT} onChange={e => { const files = Array.from(e.target.files); e.target.value = ''; if (files.length) { onFiles(files); close() } }} />
    {open && <div ref={panelRef} id={id} role="region" aria-labelledby={`${id}-title`} tabIndex={-1} className="pdf-insert-popover">
      <div className="insert-heading"><div><h3 id={`${id}-title`}>Insert content</h3><p>{onPages ? 'Add to the current PDF page' : 'Add to the image canvas'}</p></div><button type="button" onClick={close} className="insert-close" aria-label="Close insert menu"><X size={18} /></button></div>
      <nav className="insert-sections" aria-label="Insert categories">
        {[['files', 'Files', Upload], ['pages', 'Pages', Files], ['shapes', 'Shapes', Square], ['table', 'Table', Table], ['stamp', 'Stamp', Stamp]].filter(([key]) => key !== 'pages' || onPages).map(([key, name, Icon]) => <button type="button" key={key} aria-pressed={section === key} onClick={() => setSection(key)}><Icon size={17} />{name}</button>)}
      </nav>
      <div className="insert-body">
        {busy && <p role="status" className="insert-notice">Content insertion is unavailable while the page loads or a file operation finishes.</p>}
        {section === 'files' && <>
          <div className="insert-file-list">{FILE_TYPES.map(({ label: name, Icon, accept, formats, hint }) => <button key={name} type="button" className="insert-file-card" disabled={busy} onClick={() => chooseFiles(accept)}><span className="insert-file-icon"><Icon size={22} /></span><span><strong>{name}</strong><span className="insert-formats">{formats}</span><span className="insert-description">{hint}</span></span><Plus size={17} /></button>)}</div>
          <p className="insert-help">Up to 10 MB per file. You can select multiple files, or paste and drop images onto the page.</p>
        </>}
        {section === 'pages' && <>
          <label className="insert-label" htmlFor={`${id}-operation`}>Page operation</label>
          <select id={`${id}-operation`} className="insert-text-input" value={pageMode} onChange={e => { setPageMode(e.target.value); setPageError('') }}><option value="files">Merge / import PDF pages</option><option value="blank">Add a blank page</option><option value="duplicate">Duplicate current page</option></select>
          {pageMode === 'files' && <>
            <label className="insert-label insert-spaced" htmlFor={`${id}-pdfs`}>Choose PDFs in merge order</label>
            <input id={`${id}-pdfs`} className="insert-page-files" type="file" accept="application/pdf,.pdf" multiple disabled={busy} onChange={e => { setPageFiles(Array.from(e.target.files)); setPageError('') }} />
            {pageFiles.length > 0 && <ol className="insert-merge-list">{pageFiles.map((file, index) => <li key={`${file.name}-${index}`}><span>{index + 1}. {file.name}</span><button type="button" disabled={busy || index === 0} aria-label={`Move ${file.name} earlier`} onClick={() => setPageFiles(prev => { const next = [...prev]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next })}>↑</button><button type="button" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => setPageFiles(prev => prev.filter((_, i) => i !== index))}><X size={14} /></button></li>)}</ol>}
            <label className="insert-label insert-spaced" htmlFor={`${id}-range`}>Pages to import (optional)</label><input id={`${id}-range`} className="insert-text-input" value={pageRange} placeholder="All pages, or e.g. 1, 3-5" onChange={e => setPageRange(e.target.value)} />
            <p className="insert-help">Leave empty to merge every page. A range applies to each PDF. Up to 10 files totaling 10 MB.</p>
          </>}
          <label className="insert-label insert-spaced" htmlFor={`${id}-placement`}>Insert location</label><select id={`${id}-placement`} className="insert-text-input" value={placement} onChange={e => setPlacement(e.target.value)}><option value="after">After current page ({pageNumber})</option><option value="before">Before current page ({pageNumber})</option><option value="end">End of document</option><option value="start">Beginning of document</option></select>
          <p className="insert-help">{pageMode === 'duplicate' ? 'Copies the current page and its editor annotations.' : pageMode === 'blank' ? 'Uses the current page’s displayed dimensions.' : 'Imports full PDF pages with their original dimensions and rotation.'} Page changes save immediately and reset annotation undo history.</p>
          {pageError && <p role="alert" className="insert-notice insert-spaced">{pageError}</p>}
        </>}
        {section === 'shapes'  && <>
          <p className="insert-label">Choose a shape</p>
          <div className="insert-shape-grid">{SHAPES.map(({ kind: type, label: name, Icon }) => <button key={type} type="button" aria-pressed={kind === type} onClick={() => setKind(type)}><Icon size={32} strokeWidth={1.5} /><span>{name}</span>{kind === type && <Check className="insert-selected-check" size={15} />}</button>)}</div>
          {kind === 'unit-circle' ? <p className="insert-help">Includes common angles in degrees and radians and their exact cosine and sine coordinates.</p> : kind === 'trig-reference' ? <p className="insert-help">Exact sine, cosine, and tangent values and labeled 30°–60°–90° and 45°–45°–90° triangles.</p> : <>
            <label className="insert-label insert-spaced" htmlFor={`${id}-line-style`}>Line style</label>
            <select id={`${id}-line-style`} className="insert-text-input" value={lineStyle} onChange={event => setLineStyle(event.target.value)}><option value="solid">Solid</option><option value="dotted">Dotted</option><option value="dashed">Dashed</option></select>
            <svg viewBox="0 0 300 60" role="img" aria-label={`${lineStyle} ${kind} preview`} style={{width:'100%',height:60,color}}>
              {kind === 'rectangle' ? <rect x="12" y="10" width="276" height="40" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap={lineStyle === 'dotted' ? 'round' : 'butt'} strokeDasharray={lineStyle === 'dotted' ? '0 6' : lineStyle === 'dashed' ? '8 5' : undefined}/> : kind === 'ellipse' ? <ellipse cx="150" cy="30" rx="138" ry="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap={lineStyle === 'dotted' ? 'round' : 'butt'} strokeDasharray={lineStyle === 'dotted' ? '0 6' : lineStyle === 'dashed' ? '8 5' : undefined}/> : <><line x1="12" y1="30" x2="288" y2="30" stroke="currentColor" strokeWidth="2" strokeLinecap={lineStyle === 'dotted' ? 'round' : 'butt'} strokeDasharray={lineStyle === 'dotted' ? '0 6' : lineStyle === 'dashed' ? '8 5' : undefined}/>{kind === 'arrow' && <path d="M275 17 L288 30 L275 43" fill="none" stroke="currentColor" strokeWidth="2"/>}</>}
            </svg>
          </>}
          <p className="insert-help">Use the Move tool to drag the shape. Drag a corner handle to resize it.</p>
        </>}
        {section === 'table' && <>
          <div className="insert-table-size"><label htmlFor={`${id}-rows`}>Rows<input id={`${id}-rows`} type="number" min={1} max={12} value={rows} onChange={e => setRows(Math.max(1, Math.min(12, Number(e.target.value) || 1)))} /></label><span>×</span><label htmlFor={`${id}-cols`}>Columns<input id={`${id}-cols`} type="number" min={1} max={8} value={cols} onChange={e => setCols(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} /></label></div>
          <p className="insert-help">Type in the cells or paste a spreadsheet selection into the first cell. Maximum 12 rows × 8 columns.</p>
          <div className="insert-table-scroll"><table className="insert-table-editor"><tbody>{Array.from({ length: rows }, (_, r) => <tr key={r}>{Array.from({ length: cols }, (_, c) => <td key={c}><input aria-label={`Row ${r + 1}, column ${c + 1}`} placeholder={r === 0 ? `Heading ${c + 1}` : 'Value'} value={values[`${r}:${c}`] || ''} onPaste={e => pasteCells(e, r, c)} onChange={e => setValues(prev => ({ ...prev, [`${r}:${c}`]: e.target.value }))} /></td>)}</tr>)}</tbody></table></div>
          <p className="insert-help">The table inserts as an image. Finish editing the cells here before inserting.</p>
        </>}
        {section === 'stamp' && <>
          <label className="insert-label" htmlFor={`${id}-stamp`}>Stamp text</label>
          <input id={`${id}-stamp`} className="insert-text-input" maxLength={40} value={label} placeholder="Enter stamp text" onChange={e => setLabel(e.target.value)} />
          <div className="insert-presets">{['APPROVED', 'DRAFT', 'REVIEWED', 'CONFIDENTIAL'].map(value => <button key={value} type="button" aria-pressed={label === value} onClick={() => setLabel(value)}>{value}</button>)}</div>
          <div className="insert-stamp-preview" aria-label="Stamp preview"><span style={{ color, borderColor: color }}>{label || 'YOUR TEXT'}</span></div>
        </>}
      </div>
      {section !== 'files' && <div className="insert-footer">{section !== 'pages' && <span className="insert-color"><i style={{ backgroundColor: color }} />Toolbar color</span>}<button type="button" className="insert-submit" disabled={busy || (section === 'stamp' && !label.trim()) || (section === 'pages' && pageMode === 'files' && !pageFiles.length)} onClick={submit}><Plus size={16} />{section === 'pages' ? (pageMode === 'files' ? 'Merge pages' : pageMode === 'blank' ? 'Add blank page' : 'Duplicate page') : `Insert ${section === 'shapes' ? SHAPES.find(shape => shape.kind === kind).label.toLowerCase() : section}`}</button></div>}
    </div>}
  </div>
}
