import { useState } from 'react'
import { StickyNote } from 'lucide-react'

export default function CalendarDayNote({ note, onSave }) {
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
    <header><StickyNote size={16} aria-hidden="true"/><h4>Day note</h4></header>
    {draft === null ? <>
      {note && <p>{note}</p>}
      <button type="button" onClick={() => setDraft(note)}>{note ? 'Edit note' : 'Add day note'}</button>
    </> : <form onSubmit={save}>
      <label>Note<textarea rows={4} maxLength={2000} disabled={saving} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Plans, reminders, or thoughts for this day"/></label>
      <small>{draft.length}/2,000{note && ' · Clear the text and save to remove the note.'}</small>
      <div className="calendar-detail-actions">
        <button type="submit" disabled={saving || draft.trim() === note}>{saving ? 'Saving…' : 'Save note'}</button>
        <button type="button" disabled={saving} onClick={() => { setDraft(null); setError('') }}>Cancel</button>
      </div>
      {error && <p role="alert">{error}</p>}
    </form>}
  </section>
}
