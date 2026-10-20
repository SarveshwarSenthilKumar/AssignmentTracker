import useShortcuts from '../hooks/useShortcuts'
import useInlineConfirm from '../hooks/useInlineConfirm'
import InlineConfirmation from './InlineConfirmation'
import { useEffect, useState, useRef } from 'react'
import { X, Save, Download, Plus, FileText, Loader2, Upload } from 'lucide-react'
import { PDFDocument } from 'pdf-lib'
import PDFEditor from './PDFEditor'
import { imageFromFile } from './PDFInsertPanel'
import { fileKind, extensionOf, fileBytes, blobBase64, downloadBlob, parseDelimited, serializeDelimited } from '../lib/documentFormats'
import './DocumentEditor.css'

const cellText = value => value == null ? '' : typeof value === 'object' ? value.formula ? `=${value.formula}` : value.richText ? value.richText.map(run => run.text).join('') : String(value.text ?? value.result ?? value.error ?? '') : String(value)
const typedValue = value => value.startsWith('=') ? { formula: value.slice(1) } : /^(?:0|-?[1-9]\d*)(?:\.\d+)?$/.test(value) ? Number(value) : value

export default function DocumentEditor({ pdfId, token, onClose, onCleanCopy }) {
  const confirmation = useInlineConfirm()
  const [data, setData] = useState(null), [kind, setKind] = useState(null), [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [error, setError] = useState(''), [text, setText] = useState(''), [dirty, setDirty] = useState(false), [saving, setSaving] = useState(false)
  const [table, setTable] = useState([]), [sheets, setSheets] = useState([]), [sheetId, setSheetId] = useState(null)
  const [changes, setChanges] = useState({}), [gridSize, setGridSize] = useState({ rows: 20, cols: 5 })
  const [mediaUrl, setMediaUrl] = useState(''), [imageDocument, setImageDocument] = useState(null)
  const workbook = useRef(null), bytesRef = useRef(null), revision = useRef(0)
  const mime = data?.mimeType || 'application/octet-stream'
  const filename = data?.originalName || 'document.txt'
  const isNotes=data?.tags?.includes('notes')&&mime==='text/plain'
  const separator = extensionOf(filename) === 'tsv' ? '\t' : ','

  useEffect(() => {
    let cancelled = false, url
    const load = async () => {
      try {
        const response = await fetch(`/api/pdfs/${pdfId}`, { headers: { Authorization: `Bearer ${token}` } })
        const document = await response.json()
        if (!response.ok) throw new Error(document.message || 'Could not load the document.')
        if (cancelled) return
        setData(document)
        const type = fileKind(document.originalName, document.mimeType)
        setKind(type)
        const bytes = fileBytes(document.pdfData); bytesRef.current = bytes
        if (type === 'text' || type === 'table') {
          const content = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
          if (type === 'table') {
            const rows = parseDelimited(content, extensionOf(document.originalName) === 'tsv' ? '\t' : ',')
            if (rows.reduce((count, row) => count + row.length, 0) > 10000) { setKind('text'); setText(content) }
            else setTable(rows)
          }
          else setText(content)
        } else if (type === 'word') {
          const { default: mammoth } = await import('mammoth/mammoth.browser')
          const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer })
          if (!cancelled) setText(result.value)
        } else if (type === 'workbook') {
          const { default: ExcelJS } = await import('exceljs')
          const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes.buffer)
          if (!book.worksheets.length) throw new Error('This workbook has no worksheets.')
          if (cancelled) return
          workbook.current = book
          setSheets(book.worksheets.map(sheet => ({ id: sheet.id, name: sheet.name })))
          const first = book.worksheets[0]; setSheetId(first.id)
          setGridSize({ rows: Math.min(200, Math.max(20, first.rowCount)), cols: Math.min(40, Math.max(5, first.columnCount)) })
        } else if (type === 'image') {
          const asset = await imageFromFile(new File([bytes], document.originalName, { type: document.mimeType }))
          const pdf = await PDFDocument.create(), image = await pdf.embedPng(asset.dataUrl)
          pdf.addPage([asset.width, asset.height]).drawImage(image, { x: 0, y: 0, width: asset.width, height: asset.height })
          const encoded = await blobBase64(new Blob([await pdf.save()]))
          if (!cancelled) setImageDocument({ ...document, pdfData: encoded })
        } else if (type === 'audio' || type === 'video') {
          url = URL.createObjectURL(new Blob([bytes], { type: document.mimeType })); if (!cancelled) setMediaUrl(url)
        }
        if (!cancelled && ['text','word','table','workbook'].includes(type)) {
          try {
            const draft = JSON.parse(sessionStorage.getItem(`document-draft:${pdfId}`) || 'null')
            if (draft && draft.version === document.updatedAt) {
              setText(draft.text || ''); setTable(draft.table || []); setChanges(draft.changes || {}); setDirty(true)
            }
          } catch { /* The loaded document is still usable when local draft storage is unavailable. */ }
        }
      } catch (err) { if (!cancelled) { setLoadFailed(true); setError(err.message || 'This file could not be opened.') } }
      finally { if (!cancelled) setLoading(false) }
    }
    load()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [pdfId, token])
  useEffect(() => {
    if (loading || !data || loadFailed) return
    const key = `document-draft:${pdfId}`
    try {
      if (dirty) sessionStorage.setItem(key, JSON.stringify({ version: data.updatedAt, text, table, changes }))
      else sessionStorage.removeItem(key)
    } catch { setError('Local draft storage is unavailable. Use Save to keep your edits.') }
  }, [dirty, text, table, changes, loading, loadFailed, pdfId, data])
  const markDirty = () => { revision.current++; setDirty(true) }
  const close = async () => {
    if (saving) return
    if (dirty && !await confirmation.ask('You have unsaved edits. Discard them and close the editor?', 'Discard edits')) return
    try { sessionStorage.removeItem(`document-draft:${pdfId}`) } catch { /* Closing remains available without local storage. */ }
    onClose()
  }
  const serialize = async () => {
    if (kind === 'word') {
      const { Document, Packer, Paragraph } = await import('docx')
      return Packer.toBlob(new Document({ sections: [{ children: text.split('\n').map(line => new Paragraph(line)) }] }))
    }
    if (kind === 'workbook') {
      Object.entries(changes).forEach(([key, value]) => { const [sheet, row, col] = key.split(':').map(Number); workbook.current.getWorksheet(sheet).getCell(row, col).value = typedValue(value) })
      workbook.current.calcProperties.fullCalcOnLoad = true
      return new Blob([await workbook.current.xlsx.writeBuffer()], { type: mime })
    }
    return new Blob([kind === 'table' ? serializeDelimited(table, separator) : text], { type: mime })
  }
  const save = async (replacement) => {
    if (saving) return
    const currentRevision = revision.current
    setSaving(true); setError('')
    try {
      const blob = replacement || await serialize()
      const response = await fetch(`/api/pdfs/${pdfId}/content`, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ data: await blobBase64(blob), mimeType: replacement?.type || mime }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.message || 'Could not save this document.')
      bytesRef.current = new Uint8Array(await blob.arrayBuffer())
      setData(prev => ({ ...prev, hasOriginalBackup: true }))
      if (revision.current === currentRevision) setDirty(false)
      if (replacement) onClose()
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }
  const download = async (original = false) => {
    try {
      if (original) {
        const response = await fetch(`/api/pdfs/${pdfId}/original`, { headers: { Authorization: `Bearer ${token}` } })
        if (!response.ok) throw new Error('Could not download the original.')
        downloadBlob(await response.blob(), filename)
      } else downloadBlob(dirty && !loadFailed && ['text','word','table','workbook'].includes(kind) ? await serialize() : new Blob([bytesRef.current], { type: mime }), filename)
    } catch (err) { setError(err.message) }
  }
  useShortcuts('Document editor', {
    save: () => { if (!loadFailed && ['text','word','table','workbook'].includes(kind)) save() },
    download: () => download(), close,
  }, !loading && !saving && !confirmation.pending && kind !== 'pdf' && kind !== 'image')
  if (kind === 'pdf' && !loading && !error) return <PDFEditor onCleanCopy={onCleanCopy} pdfId={pdfId} token={token} onClose={onClose} />
  if (kind === 'image' && imageDocument && !error) return <PDFEditor onCleanCopy={onCleanCopy} pdfId={pdfId} token={token} onClose={onClose} initialDocument={imageDocument} exportImage />
  const editable = ['text','word','table','workbook'].includes(kind) && !loading && !loadFailed
  const rows = kind === 'workbook' ? gridSize.rows : table.length
  const cols = kind === 'workbook' ? gridSize.cols : Math.max(1, ...table.map(row => row.length))
  return <div className="document-editor" role="region" aria-label="Document editor">
    <header><div className="document-title"><FileText size={22} /><div><h2>{data?.name || 'Document editor'}</h2><p>{filename} · {loading ? 'Loading…' : dirty ? 'Unsaved changes' : 'Saved'}</p></div></div><div className="document-actions">
      {editable && <button className="document-save" disabled={saving || !dirty} onClick={() => save()}><Save size={17} />{saving ? 'Saving…' : 'Save'}</button>}
      <button disabled={loading || saving || !data} onClick={() => download()}><Download size={17} />Download</button>
      {data?.hasOriginalBackup && <button disabled={saving} onClick={() => download(true)}>Original file</button>}
      <button aria-label="Close editor" disabled={saving} onClick={close}><X size={20} /></button>
    </div></header>
    <InlineConfirmation {...confirmation} />
    {error && <div role="alert" className="document-error">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    {kind === 'word' && <p className="document-notice">DOCX text editing: saves a new document containing your text. Original formatting, images, and tables are not retained in the edited version; the uploaded original remains downloadable.</p>}
    {kind === 'workbook' && <div className="document-tools"><label>Worksheet <select value={sheetId || ''} onChange={e => { const id = Number(e.target.value), sheet = workbook.current.getWorksheet(id); setSheetId(id); setGridSize({rows:Math.min(200,Math.max(20,sheet.rowCount)),cols:Math.min(40,Math.max(5,sheet.columnCount))}) }}>{sheets.map(sheet => <option key={sheet.id} value={sheet.id}>{sheet.name}</option>)}</select></label><span>Cell values and formulas; formulas recalculate when opened in Excel. Showing up to 200 rows × 40 columns; other cells are retained.</span></div>}
    {(kind === 'table' || kind === 'workbook') && editable && <div className="document-tools"><button onClick={() => { if (kind === 'table') setTable(prev => [...prev, Array(cols).fill('')]); else setGridSize(prev => ({...prev,rows:Math.min(500,prev.rows+1)})); markDirty() }}><Plus size={15} />Row</button><button onClick={() => { if (kind === 'table') setTable(prev=>prev.map(row=>[...Array.from({length:cols},(_,i)=>row[i]||''),''])); else setGridSize(prev=>({...prev,cols:Math.min(100,prev.cols+1)})); markDirty() }}><Plus size={15} />Column</button></div>}
    <main>
      {loading ? <div className="document-empty"><Loader2 className="animate-spin" />Loading document…</div> : !loadFailed && (kind === 'text' || kind === 'word') ? <textarea aria-label="Document content" className={`document-text ${kind === 'word'||isNotes ? 'document-prose' : ''}`} spellCheck={kind === 'word'||isNotes} placeholder={isNotes?'Start writing your notes…':undefined} value={text} onChange={e=>{setText(e.target.value);markDirty()}} /> : !loadFailed && (kind === 'table' || kind === 'workbook') ? <div className="document-grid"><table><thead><tr><th>#</th>{Array.from({length:cols},(_,c)=><th key={c}>{c+1}</th>)}</tr></thead><tbody>{Array.from({length:rows},(_,r)=><tr key={r}><th>{r+1}</th>{Array.from({length:cols},(_,c)=>{
        const key=`${sheetId}:${r+1}:${c+1}`
        const value=kind==='table' ? table[r]?.[c]||'' : changes[key] ?? cellText(workbook.current.getWorksheet(sheetId).getCell(r+1,c+1).value)
        return <td key={c}><input aria-label={`Row ${r+1}, column ${c+1}`} value={value} onChange={e=>{const value=e.target.value;if(kind==='table')setTable(prev=>prev.map((row,i)=>i===r?Array.from({length:cols},(_,j)=>j===c?value:row[j]||''):row));else setChanges(prev=>({...prev,[key]:value}));markDirty()}} /></td>
      })}</tr>)}</tbody></table></div> : <div className="document-empty">
        {!loadFailed && kind==='audio' && <audio controls src={mediaUrl} />}{!loadFailed && kind==='video' && <video controls src={mediaUrl} />}
        <h3>{kind==='audio'||kind==='video' ? 'Media preview' : 'File attachment'}</h3><p>{kind==='audio'||kind==='video' ? 'Playback depends on your browser’s codec support.' : 'This format is stored as an attachment. Download it to edit in its native application.'}</p>
        <label className="document-replace"><Upload size={18} />Replace file contents<input type="file" disabled={saving} accept={extensionOf(filename) ? `.${extensionOf(filename)}` : undefined} onChange={e=>{const file=e.target.files[0];if(!file)return;if(file.size>10*1024*1024){setError('Choose a file smaller than 10 MB.');return}if(extensionOf(file.name)!==extensionOf(filename)){setError('Replace with a file of the same type.');return}save(file)}} /></label>
      </div>}
    </main>
  </div>
}
