import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Play, Plus, X } from 'lucide-react'
import './BoardPresentation.css'

const makeId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('')

export default function BoardPresentation({ stops, onChange, capture, visit, onClose, onPresent, loading, loadError, onReload, disabled }) {
  const [activeId, setActiveId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const close = useRef(null)
  const playing = activeId !== null
  const activeIndex = stops.findIndex(stop => stop.id === activeId)
  const active = stops[activeIndex]
  const editable = Boolean(onChange) && !loading && !loadError

  function present(index) {
    const stop = stops[index]
    if (!stop || disabled || pending.current) return
    if (visit(stop) === false) { setError('This area is unavailable. Try again after the board loads.'); return }
    setError('')
    if (!playing) onPresent?.(true)
    setActiveId(stop.id)
  }

  function end() {
    onPresent?.(false)
    setActiveId(null)
  }

  useEffect(() => { close.current?.focus({ preventScroll: true }) }, [playing])
  useEffect(() => {
    if (playing && !active && !loading) { end(); setError('That stop is no longer available.') }
  }, [playing, active, loading])
  useEffect(() => {
    if (!playing) return
    const key = event => {
      if (event.altKey || event.ctrlKey || event.metaKey || !['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') end()
      else present(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1))
    }
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  })

  async function save(next) {
    if (!editable || pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await onChange(next)
      setEditing(null)
    } catch (failure) { setError(failure.message) }
    finally { pending.current = false; setBusy(false) }
  }

  function startCapture(existing) {
    const position = capture()
    if (!position) { setError('Wait until the board is ready before capturing a stop.'); return }
    setError('')
    setEditing({ ...position, id: existing?.id || makeId(), title: existing?.title || 'Stop ' + (stops.length + 1) })
  }

  const shift = (index, offset) => {
    const next = [...stops]
    const [stop] = next.splice(index, 1)
    next.splice(index + offset, 0, stop)
    return save(next)
  }

  if (playing && active) return <div className="board-stop-player" role="group" aria-label="Board presentation">
    <div aria-live="polite"><strong>{active.title}</strong><small>{activeIndex + 1} of {stops.length}</small></div>
    <button type="button" disabled={activeIndex < 1 || disabled} onClick={() => present(activeIndex - 1)}><ArrowLeft size={16}/>Previous</button>
    <button type="button" disabled={activeIndex + 1 >= stops.length || disabled} onClick={() => present(activeIndex + 1)}>Next<ArrowRight size={16}/></button>
    <button type="button" ref={close} onClick={end}>End presentation</button>
    {error && <p role="alert">{error}</p>}
  </div>

  return <section className="board-stop-panel" aria-label="Presentation stops"
    onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (!busy) onClose() } }}>
    <header><h2>Presentation stops</h2><button ref={close} type="button" aria-label="Close presentation stops" onClick={onClose} disabled={busy}><X size={17}/></button></header>
    {loading && <p role="status">Loading stops…</p>}
    {(loadError || error) && <p role="alert">{loadError || error}</p>}
    {onReload && (loadError || error) && <button type="button" onClick={() => { setError(''); onReload() }} disabled={loading || busy}>Reload stops</button>}
    <div className="board-stop-actions">
      {editable && <button type="button" disabled={busy || disabled || stops.length >= 40} onClick={() => startCapture()}><Plus size={16}/>Capture current view</button>}
      {!!stops.length && <button type="button" disabled={busy || disabled} onClick={() => present(0)}><Play size={16}/>Present</button>}
    </div>
    {editing && <form onSubmit={event => {
      event.preventDefault()
      const title = editing.title.trim()
      if (!title) return
      const stop = { ...editing, title }
      save(stops.some(item => item.id === stop.id) ? stops.map(item => item.id === stop.id ? stop : item) : [...stops, stop])
    }}>
      <label>Stop name<input autoFocus required maxLength={80} value={editing.title} disabled={busy}
        onFocus={event => event.currentTarget.select()} onChange={event => setEditing({ ...editing, title: event.target.value })}/></label>
      <button type="submit" disabled={busy || !editing.title.trim()}>{busy ? 'Saving…' : 'Save stop'}</button>
      <button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
    </form>}
    {!loading && !loadError && !stops.length && <p>{editable ? 'Pan and zoom to the area you want, then capture the view.' : 'This board has no presentation stops yet.'}</p>}
    <ol>{stops.map((stop, index) => <li key={stop.id}>
      <button type="button" className="board-stop-preview" disabled={disabled} onClick={() => setError(visit(stop) === false ? 'This area is unavailable.' : '')}>
        <span>{index + 1}. {stop.title}</span><small>{stop.page ? 'Section ' + stop.page + ' · ' : ''}{Math.round(stop.zoom * 100)}%</small>
      </button>
      {editable && <div className="board-stop-actions">
        <button type="button" aria-label={'Move ' + stop.title + ' up'} disabled={busy || index === 0} onClick={() => shift(index, -1)}><ArrowUp size={14}/></button>
        <button type="button" aria-label={'Move ' + stop.title + ' down'} disabled={busy || index === stops.length - 1} onClick={() => shift(index, 1)}><ArrowDown size={14}/></button>
        <button type="button" disabled={busy} onClick={() => setEditing(stop)}>Rename</button>
        <button type="button" disabled={busy || disabled} onClick={() => startCapture(stop)}>Update view</button>
        <button type="button" disabled={busy} onClick={() => save(stops.filter(item => item.id !== stop.id))}>Remove</button>
      </div>}
    </li>)}</ol>
  </section>
}
