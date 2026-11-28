import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, Download, Package, Share2, X } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'
import { saveDownload } from '../lib/download'
import './AssignmentHandoff.css'

function SelectionList({ title, items, selected, onChange, limit, disabled }) {
  const [query, setQuery] = useState('')
  const visible = items.filter(item => item.label.toLowerCase().includes(query.trim().toLowerCase()))
  return <fieldset className="handoff-selection" disabled={disabled}>
    <legend>{title} ({selected.length} selected)</legend>
    <input type="search" aria-label={'Search ' + title.toLowerCase()} value={query} onChange={event => setQuery(event.target.value)} />
    <div className="handoff-choices">
      {visible.map(item => {
        const checked = selected.includes(item.id)
        return <label key={item.id}><input type="checkbox" checked={checked} disabled={!checked && selected.length >= limit}
          onChange={() => onChange(checked ? selected.filter(id => id !== item.id) : [...selected, item.id])}/>
          <span>{item.label}</span>
        </label>
      })}
      {!visible.length && <p>{query.trim() ? 'No matches.' : 'Nothing available to select.'}</p>}
    </div>
  </fieldset>
}

export default function AssignmentHandoff({ token, tasks, documents, onClose, onShare }) {
  const dialog = useRef(null)
  const heading = useId()
  const lock = useRef(false)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [taskIds, setTaskIds] = useState([])
  const [documentIds, setDocumentIds] = useState([])
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { dialog.current?.showModal() }, [])

  async function run(action, work) {
    if (lock.current) return
    lock.current = true
    setBusy(action); setError('')
    try { await work() }
    catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy('') }
  }

  const buildPreview = event => {
    event.preventDefault()
    run('Preparing preview…', async () => {
      const response = await fetch('/api/assignment-handoffs/preview', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), note, taskIds, documentIds }),
      })
      const result = await readApiJson(response)
      if (!response.ok) throw new Error(result.message || 'Could not prepare the handoff.')
      if (!result.zip || typeof result.text !== 'string' || !Array.isArray(result.attachments)) {
        throw new Error('The server did not return a handoff preview.')
      }
      const bytes = Uint8Array.from(atob(result.zip), value => value.charCodeAt(0))
      setPreview({ ...result, zip: new Blob([bytes], { type: 'application/zip' }) })
    })
  }

  const share = () => run('Saving handoff…', async () => {
    const form = new FormData()
    form.append('pdfFile', preview.zip, preview.filename)
    form.append('name', preview.filename)
    form.append('tags', JSON.stringify(['assignment handoff']))
    const response = await fetch('/api/pdfs', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form })
    const file = await readApiJson(response)
    if (!response.ok || !file._id) throw new Error(file.message || 'Could not save the handoff.')
    onShare(file)
  })

  return <dialog ref={dialog} className="assignment-handoff" aria-labelledby={heading} aria-busy={Boolean(busy)}
    onClose={onClose} onCancel={event => { if (lock.current) event.preventDefault() }} onKeyDown={event => event.stopPropagation()}>
    <header><h2 id={heading}><Package size={20} aria-hidden="true"/>{preview ? 'Preview assignment handoff' : 'Create assignment handoff'}</h2>
      <button type="button" aria-label="Close handoff" disabled={Boolean(busy)} onClick={() => dialog.current?.close()}><X size={18}/></button>
    </header>
    {preview ? <>
      <p>This is the exact text and file list in <strong>{preview.filename}</strong>.</p>
      <section className="handoff-preview" aria-label="handoff.txt preview"><h3>handoff.txt</h3><pre>{preview.text}</pre></section>
      <p>The ZIP is a snapshot of the selected tasks and saved files.</p>
      <div className="handoff-actions">
        <button type="button" disabled={Boolean(busy)} onClick={() => { setPreview(null); setError('') }}><ArrowLeft size={16} aria-hidden="true"/>Edit selection</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => run('Preparing download…', () => saveDownload(preview.zip, preview.filename))}><Download size={16} aria-hidden="true"/>Download ZIP</button>
        <button type="button" className="handoff-primary" disabled={Boolean(busy)} onClick={share}><Share2 size={16} aria-hidden="true"/>Save and open sharing</button>
      </div>
    </> : <form onSubmit={buildPreview}>
      <label>Handoff title<input required autoFocus maxLength={100} value={title} disabled={Boolean(busy)} onChange={event => setTitle(event.target.value)} placeholder="Project handoff" /></label>
      <label>Note for the recipient<textarea rows={3} maxLength={5000} value={note} disabled={Boolean(busy)} onChange={event => setNote(event.target.value)} /></label>
      <div className="handoff-pickers">
        <SelectionList title="Tasks" items={tasks.map(task => ({ id: task._id, label: task.text }))} selected={taskIds} onChange={setTaskIds} limit={50} disabled={Boolean(busy)}/>
        <SelectionList title="Files and saved notes" items={documents.filter(file => !file.deletedAt).map(file => ({ id: file._id, label: file.name }))} selected={documentIds} onChange={setDocumentIds} limit={20} disabled={Boolean(busy)}/>
      </div>
      <p>Tasks include their descriptions, status, and dates. Files use their saved contents. Separate PDF annotations are excluded.</p>
      <div className="handoff-actions"><button type="submit" className="handoff-primary"
        disabled={Boolean(busy) || !title.trim() || (!note.trim() && !taskIds.length && !documentIds.length)}>Preview handoff</button></div>
    </form>}
    {busy && <p role="status">{busy}</p>}
    {error && <p role="alert">{error}</p>}
  </dialog>
}
