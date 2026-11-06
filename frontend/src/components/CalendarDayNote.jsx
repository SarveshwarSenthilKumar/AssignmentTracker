import { useState } from 'react'
import { StickyNote } from 'lucide-react'

export default function CalendarDayNote({ dateLabel, note, loading, loadError, onRetry, onSave }) {
  const [draft, setDraft] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      await onSave(draft)
      setDraft(null)
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return <section className="calendar-day-note" aria-label="Note for selected day">
    <header>
      <div className="calendar-day-note-heading"><StickyNote size={20} aria-hidden="true"/><div><h4>Day note</h4><small>{dateLabel}</small></div></div>
      {draft === null && <button className="calendar-day-note-primary" type="button" disabled={loading || !!loadError} onClick={() => setDraft(note)}>{note ? 'Edit day note' : 'Add day note'}</button>}
    </header>
    {loadError ? <p role="alert">{loadError} <button type="button" onClick={onRetry}>Retry</button></p> : loading ? <p role="status">Loading day notes…</p> : null}
    {draft === null ? <>
      {note && <p>{note}</p>}
      {!note && !loading && !loadError && <p>Select any date below to see or add a note for that day.</p>}
    </> : <form onSubmit={save}>
      <label>Note<textarea autoFocus rows={4} maxLength={2000} disabled={saving} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Plans, reminders, or thoughts for this day"/></label>
      <small>{draft.length}/2,000{note && ' · Clear the text and save to remove the note.'}</small>
      <div className="calendar-detail-actions">
        <button type="submit" disabled={saving || draft.trim() === note}>{saving ? 'Saving…' : 'Save note'}</button>
        <button type="button" disabled={saving} onClick={() => { setDraft(null); setError('') }}>Cancel</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>}
  </section>
}
