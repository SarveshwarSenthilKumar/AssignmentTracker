import { useState } from 'react'

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

export function makeInsert(kind, color, options = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = kind === 'table' ? 720 : 480
  canvas.height = kind === 'table' ? 360 : 240
  const ctx = canvas.getContext('2d')
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 6
  if (kind === 'rectangle') ctx.strokeRect(8, 8, 464, 224)
  if (kind === 'ellipse') { ctx.beginPath(); ctx.ellipse(240, 120, 230, 110, 0, 0, Math.PI * 2); ctx.stroke() }
  if (kind === 'line' || kind === 'arrow') {
    ctx.beginPath(); ctx.moveTo(12, 120); ctx.lineTo(460, 120)
    if (kind === 'arrow') { ctx.moveTo(420, 80); ctx.lineTo(460, 120); ctx.lineTo(420, 160) }
    ctx.stroke()
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
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, label: kind === 'stamp' ? options.label : kind }
}

export default function InsertPanel({ onFiles, onInsert, color, busy }) {
  const [kind, setKind] = useState('rectangle')
  const [label, setLabel] = useState('APPROVED')
  const [cells, setCells] = useState('Heading 1\tHeading 2\nValue 1\tValue 2')
  return <details className="pdf-insert-panel">
    <summary className="cursor-pointer rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">Insert content</summary>
    <div className="pdf-insert-options">
      <label className="block text-sm">Image, PDF page, or text file
        <input aria-label="Insert files" type="file" accept={INSERT_ACCEPT} multiple disabled={busy} onChange={e => { onFiles(Array.from(e.target.files)); e.target.value = '' }} className="mt-2 block w-full text-xs" />
      </label>
      <p className="text-xs text-slate-400">Images: PNG, JPEG, SVG, WebP, GIF, BMP, AVIF and other browser-supported formats. GIFs use a still frame. PDFs insert their first page. Text: TXT, Markdown, CSV. You can also paste or drop images onto the page.</p>
      <label className="block text-sm">Shape or content
        <select value={kind} onChange={e => setKind(e.target.value)} className="mt-1 w-full rounded bg-slate-800 p-2">
          {['rectangle', 'ellipse', 'line', 'arrow', 'table', 'stamp'].map(k => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
        </select>
      </label>
      {kind === 'stamp' && <input aria-label="Stamp text" maxLength={40} value={label} onChange={e => setLabel(e.target.value)} className="w-full rounded bg-slate-800 p-2" />}
      {kind === 'table' && <label className="block text-xs">One row per line; separate columns with tabs (paste from a spreadsheet). Up to 12 rows and 8 columns.
        <textarea aria-label="Table cells" rows={4} value={cells} onChange={e => setCells(e.target.value)} className="mt-1 w-full rounded bg-slate-800 p-2" />
      </label>}
      <button disabled={busy || (kind === 'stamp' && !label.trim()) || (kind === 'table' && !cells.trim())} onClick={() => onInsert(kind, { label, cells })} className="w-full rounded bg-indigo-600 p-2 text-sm">{busy ? 'Inserting…' : 'Insert on current page'}</button>
    </div>
  </details>
}
