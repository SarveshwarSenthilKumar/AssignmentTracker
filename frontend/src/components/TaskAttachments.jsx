import { useEffect, useRef, useState } from 'react'
import { Paperclip, Upload, FileText, Link2, X, Loader2 } from 'lucide-react'
import { descriptionParts, documentTaskIds } from '../lib/taskAttachments'
import './TaskAttachments.css'

export function TaskDescription({ text, documents, onOpen }) {
  return <div className="task-description">{descriptionParts(text).map((part, index) => {
    if (part.text !== undefined) return <span key={index}>{part.text}</span>
    const file = documents.find(file => file._id === part.documentId)
    return file && !file.deletedAt ? <button key={index} type="button" className="task-document-reference" onClick={() => onOpen(file._id)}><Paperclip size={13}/>{file.name}</button> : <span key={index} className="text-slate-500">[Document unavailable]</span>
  })}</div>
}

function MediaPreview({ file, token }) {
  const [url, setUrl] = useState(''), [failed, setFailed] = useState(false)
  const kind = file.mimeType?.split('/')[0]
  useEffect(() => {
    if (!['image','audio','video'].includes(kind)) return
    const controller = new AbortController(); let objectUrl
    setUrl(''); setFailed(false)
    fetch(`/api/pdfs/${file._id}`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Preview unavailable')
      const data = await response.json()
      if (controller.signal.aborted) return
      const bytes = Uint8Array.from(atob(data.pdfData), char => char.charCodeAt(0))
      objectUrl = URL.createObjectURL(new Blob([bytes], { type: file.mimeType })); setUrl(objectUrl)
    }).catch(error => { if (error.name !== 'AbortError') setFailed(true) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [file._id, file.updatedAt, file.mimeType, token, kind])
  if (!['image','audio','video'].includes(kind)) return null
  if (!url) return <small>{failed ? 'Preview unavailable. Open the document to download it.' : 'Loading preview…'}</small>
  if (kind === 'image') return <img src={url} alt={file.name} loading="lazy"/>
  if (kind === 'audio') return <audio src={url} controls preload="metadata"/>
  return <video src={url} controls preload="metadata"/>
}

export default function TaskAttachments({ taskId, documents, folders, token, onDocumentsChange, onOpen, onLibrary, onInsert }) {
  const [picker, setPicker] = useState(false), [query, setQuery] = useState(''), [folder, setFolder] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [preview, setPreview] = useState(null)
  const input = useRef(null), lock = useRef(false)
  const linked = documents.filter(file => !file.deletedAt && documentTaskIds(file).includes(String(taskId)))
  const available = documents.filter(file => !file.deletedAt && !documentTaskIds(file).includes(String(taskId)) && `${file.name} ${file.originalName}`.toLowerCase().includes(query.toLowerCase()))
  const run = async operation => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await operation() } catch (error) { setError(error.message) }
    finally { lock.current = false; setBusy(false) }
  }
  const request = async (url, options) => {
    const response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || 'Could not save the attachment.')
    return data
  }
  const link = (file, linked) => run(async () => {
    const data = await request(`/api/pdfs/${file._id}/task-link`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, linked }) })
    onDocumentsChange(prev => prev.map(item => item._id === data._id ? data : item))
    setNotice(linked ? 'Document linked. Edit the task to insert a reference in its description.' : 'Attachment link removed. The file remains in Documents; any inline description references are preserved.'); if (!linked && preview === file._id) setPreview(null)
  })
  const upload = files => run(async () => {
    let count = 0; const failures = []
    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) { failures.push(`${file.name}: exceeds 10 MB`); continue }
      try {
        const body = new FormData(); body.append('pdfFile', file); body.append('name', file.name); body.append('todoId', taskId); if (folder) body.append('pdfFolderId', folder)
        const data = await request('/api/pdfs', { method: 'POST', body })
        onDocumentsChange(prev => [data, ...prev]); count++
      } catch (error) { failures.push(`${file.name}: ${error.message}`) }
    }
    setNotice(`${count} ${count === 1 ? 'file' : 'files'} stored in Documents and linked to this task.`)
    if (failures.length) setError(failures.join('; '))
  })
  return <section className="task-attachments" aria-label="Task files and media" aria-busy={busy} onDragOver={event => { if (event.dataTransfer.types.includes('Files')) event.preventDefault() }} onDrop={event => { if (event.dataTransfer.files.length) { event.preventDefault(); event.stopPropagation(); upload(event.dataTransfer.files) } }}>
    <header><div><strong><Paperclip size={15}/> Files & media <span>{linked.length}</span></strong><small>Stored in Documents · drop files here · up to 10 MB each</small></div><button type="button" onClick={onLibrary}>Documents ↗</button></header>
    <div className="task-attachment-toolbar"><button type="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? <Loader2 size={14}/> : <Upload size={14}/>}Upload files</button><button type="button" disabled={busy} onClick={() => setPicker(!picker)}><Link2 size={14}/>Link existing</button><select aria-label="Upload destination folder" value={folder} disabled={busy} onChange={event => setFolder(event.target.value)}><option value="">Store in Unfiled</option>{folders.map(folder => <option key={folder._id} value={folder._id}>{folder.name}</option>)}</select><input ref={input} aria-label="Upload task attachments" type="file" multiple hidden onChange={event => { upload(event.target.files); event.target.value = '' }}/></div>
    {picker && <div className="task-attachment-picker"><input aria-label="Find existing documents" placeholder="Search the document library…" value={query} onChange={event => setQuery(event.target.value)}/><div>{available.map(file => <button key={file._id} type="button" disabled={busy} onClick={() => link(file, true)}><FileText size={14}/><span>{file.name}<small>{file.originalName}</small></span><Link2 size={14}/></button>)}{!available.length && <small>No available documents match.</small>}</div></div>}
    {error && <p role="alert" className="task-attachment-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    <div className="task-attachment-grid">{linked.map(file => <article key={file._id}><div className="task-attachment-title"><FileText size={18}/><button type="button" onClick={() => onOpen(file._id)}>{file.name}<small>{file.originalName}</small></button></div><small>{file.mimeType || 'File'} · {folders.find(folder => folder._id === file.pdfFolder)?.name || 'Unfiled'}</small><div className="task-attachment-actions"><button type="button" onClick={() => onOpen(file._id)}>Open</button>{['image','audio','video'].includes(file.mimeType?.split('/')[0]) && <button type="button" onClick={() => setPreview(preview === file._id ? null : file._id)}>{preview === file._id ? 'Hide preview' : 'Preview'}</button>}{onInsert && <button type="button" onClick={() => onInsert(`[[document:${file._id}]]`)}>Insert in description</button>}<button type="button" disabled={busy} aria-label={`Unlink ${file.name}`} onClick={() => link(file, false)}><X size={13}/>Unlink</button></div>{preview === file._id && <MediaPreview file={file} token={token}/>}</article>)}</div>
    {!linked.length && <small>Attach source material, images, recordings, spreadsheets, or other files.</small>}
  </section>
}
