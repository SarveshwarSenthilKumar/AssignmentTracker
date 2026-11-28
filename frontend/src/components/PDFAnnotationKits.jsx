import { useEffect, useState } from 'react'
import { Check, Highlighter, Pen, Plus, StickyNote, Stamp } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'
import './PDFAnnotationKits.css'

const path = '/api/account/annotation-kits'
const references = { 'unit-circle': 'Unit circle', 'trig-reference': 'Exact trig values & special triangles' }
const fields = {
  pens: ['Pens', 'pen', 6],
  highlighters: ['Highlighters', 'highlighter', 6],
  notes: ['Sticky-note styles', 'note style', 6],
  stamps: ['Stamps', 'stamp', 12],
}

async function request(token, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store', ...options,
    headers: { Authorization: 'Bearer ' + token, ...(options.body && { 'Content-Type': 'application/json' }) },
  })
  const data = await readApiJson(response)
  if (!response.ok) throw new Error(data.message || 'Could not load annotation kits.')
  return data
}

const idForKit = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')

function KitFields({ section, values, onChange, onAdd }) {
  const [title, singular, limit] = fields[section]
  const update = (index, partial) => onChange(values.map((item, i) => i === index ? { ...item, ...partial } : item))
  return <fieldset className="annotation-kit-tools">
    <legend>{title}</legend>
    {values.map((item, index) => <div className="annotation-kit-fields" key={index}>
      {section === 'stamps' && <label>Stamp text<input required maxLength={40} value={item.label}
        onChange={event => update(index, { label: event.target.value })}/></label>}
      <label>{section === 'notes' ? 'Text color' : 'Color'}<input type="color" value={item.color}
        onChange={event => update(index, { color: event.target.value })}/></label>
      {section === 'notes' && <label>Background<input type="color" value={item.background}
        onChange={event => update(index, { background: event.target.value })}/></label>}
      {'width' in item && <label>Width (pt)<input type="number" required step="any" max={10000} value={item.width}
        onChange={event => update(index, { width: event.target.value })}/></label>}
      {'fontSize' in item && <label>Font size (pt)<input type="number" required min={6} max={144} step="any" value={item.fontSize}
        onChange={event => update(index, { fontSize: event.target.value })}/></label>}
      <button type="button" className="pc-button" aria-label={'Remove ' + singular + ' ' + (index + 1)}
        onClick={() => onChange(values.filter((_, i) => i !== index))}>Remove</button>
    </div>)}
    <button type="button" className="pc-button" disabled={values.length >= limit} onClick={onAdd}><Plus size={14}/>Add {singular}</button>
  </fieldset>
}

export default function PDFAnnotationKits({ token, active, capture, onApply, onClear, onBrush, onNote, onInsert, canInsert, onClose }) {
  const [library, setLibrary] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    request(token, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setLibrary(data)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [token])

  const current = library?.kits.find(kit => kit.id === active?.id)
  const change = (key, value) => setDraft(previous => ({ ...previous, [key]: value }))
  const startNew = () => {
    setError('')
    const { pen, highlighter, note } = capture()
    setDraft({ id: idForKit(), name: '', pens: [pen], highlighters: [highlighter], notes: [note], stamps: [], references: [] })
  }
  const add = section => {
    const { pen, highlighter, note } = capture()
    const item = { pens: pen, highlighters: highlighter, notes: note, stamps: { label: '', color: pen.color } }[section]
    change(section, [...draft[section], item])
  }

  async function save(next) {
    if (!library || busy) return
    setBusy(true)
    setError('')
    try {
      const kits = next
        ? library.kits.some(kit => kit.id === next.id) ? library.kits.map(kit => kit.id === next.id ? next : kit) : [...library.kits, next]
        : library.kits.filter(kit => kit.id !== draft.id)
      const data = await request(token, { method: 'PUT', body: JSON.stringify({ kits, revision: library.revision }) })
      setLibrary(data)
      setDraft(null)
      setConfirmDelete(false)
      if (next) onApply(data.kits.find(kit => kit.id === next.id))
      else if (draft.id === active?.id) onClear()
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  function submit(event) {
    event.preventDefault()
    const brushes = items => items.map(item => ({ ...item, width: Number(item.width) }))
    save({ ...draft, pens: brushes(draft.pens), highlighters: brushes(draft.highlighters),
      notes: draft.notes.map(note => ({ ...note, fontSize: Number(note.fontSize) })) })
  }

  return <div className="annotation-kit-panel">
    {error && <p role="alert" className="annotation-kit-error">{error}</p>}
    {loading && <p role="status">Loading kits…</p>}
    {library && (draft ? <form onSubmit={submit}>
      <fieldset disabled={busy} className="annotation-kit-form">
        <label>Kit name<input autoFocus required maxLength={60} placeholder="e.g. Calculus" value={draft.name}
          onChange={event => change('name', event.target.value)}/></label>
        {Object.keys(fields).map(section => <KitFields key={section} section={section} values={draft[section]}
          onChange={value => change(section, value)} onAdd={() => add(section)}/>)}
        <fieldset className="annotation-kit-tools">
          <legend>Math references</legend>
          {Object.entries(references).map(([key, label]) => <label key={key} className="annotation-kit-check">
            <input type="checkbox" checked={draft.references.includes(key)} onChange={event =>
              change('references', event.target.checked ? [...draft.references, key] : draft.references.filter(item => item !== key))}/>{label}
          </label>)}
        </fieldset>
        {confirmDelete ? <div className="annotation-kit-actions">
          <span>Delete this kit?</span>
          <button type="button" className="pc-button" onClick={() => save(null)}>Delete kit</button>
          <button type="button" className="pc-button" onClick={() => setConfirmDelete(false)}>Keep kit</button>
        </div> : <div className="annotation-kit-actions">
          <button type="submit" className="pc-button">{busy ? 'Saving…' : 'Save and use kit'}</button>
          <button type="button" className="pc-button" onClick={() => { setDraft(null); setError('') }}>Cancel</button>
          {library.kits.some(kit => kit.id === draft.id) && <button type="button" className="pc-button" onClick={() => setConfirmDelete(true)}>Delete…</button>}
        </div>}
      </fieldset>
    </form> : <>
      <div className="annotation-kit-actions">
        <button type="button" className="pc-button" onClick={startNew} disabled={library.kits.length >= 24}><Plus size={14}/>New kit</button>
        {current && <button type="button" className="pc-button" onClick={() => { setDraft(current); setError('') }}>Edit active kit</button>}
        {active && <button type="button" className="pc-button" onClick={onClear}>Use editor defaults</button>}
      </div>
      {library.kits.length ? <div className="annotation-kit-list" aria-label="Saved kits">
        {library.kits.map(kit => <button type="button" key={kit.id} className="pc-menu-action" aria-pressed={kit.id === active?.id} onClick={() => onApply(kit)}>
          {kit.id === active?.id && <Check size={15}/>}<span>{kit.name}</span>
        </button>)}
      </div> : <p>Create a kit from your current brush settings.</p>}
      {current && <div className="annotation-kit-quick" aria-label={'Tools in ' + current.name}>
        {current.pens.map((item, i) => <button type="button" key={'pen-' + i} className="pc-button"
          onClick={() => { onBrush('pen', item); onClose() }}><Pen size={15} style={{ color: item.color }}/>Pen {item.width} pt</button>)}
        {current.highlighters.map((item, i) => <button type="button" key={'highlight-' + i} className="pc-button"
          onClick={() => { onBrush('highlighter', item); onClose() }}><Highlighter size={15} style={{ color: item.color }}/>Highlight {item.width} pt</button>)}
        {current.notes.map((note, i) => <button type="button" key={'note-' + i} className="pc-button" disabled={!canInsert}
          onClick={() => { onNote(note); onClose() }}><StickyNote size={15} style={{ color: note.background }}/>Note {i + 1}</button>)}
        {current.stamps.map((stamp, i) => <button type="button" key={'stamp-' + i} className="pc-button" disabled={!canInsert}
          onClick={() => { if (onInsert('stamp', { label: stamp.label }, stamp.color) !== false) onClose() }}><Stamp size={15} style={{ color: stamp.color }}/>{stamp.label}</button>)}
        {current.references.map(key => <button type="button" key={key} className="pc-button" disabled={!canInsert}
          onClick={() => { if (onInsert(key) !== false) onClose() }}>{references[key]}</button>)}
      </div>}
    </>)}
  </div>
}
