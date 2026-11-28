import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { calendarDay, calendarTime, dayLabel } from '../lib/calendar'
import { readApiJson } from '../lib/apiResponse'
import './CalendarEventSharing.css'

const labels = { title: 'Title', schedule: 'Date, time and event type', location: 'Location', notes: 'Notes', reminder: 'Reminder' }
const kinds = { appointment: 'Appointment', marker: 'Date marker', sports: 'Sports event', class: 'Class meeting' }

function format(key, value) {
  if (key === 'reminder') {
    if (value === null) return 'No reminder'
    return value === 0 ? 'At the start' : value === 1440 ? '1 day before' : value + ' min before'
  }
  if (key === 'schedule') {
    const start = value.allDay ? value.startDate : calendarDay(value.startAt)
    const end = value.allDay ? value.endDate : value.endAt ? calendarDay(value.endAt) : start
    const date = day => dayLabel(day, { month: 'short', day: 'numeric', year: 'numeric' })
    const details = value.sports && [value.sports.sport, value.sports.league, [value.sports.team, value.sports.opponent].filter(Boolean).join(' vs ')].filter(Boolean).join(' · ')
    return [kinds[value.kind], date(start) + (end && end !== start ? ' – ' + date(end) : ''), calendarTime(value), details].filter(Boolean).join('\n')
  }
  return value || 'Empty'
}

export default function CalendarSharedUpdates({ entryId, token, shareToken, disabled, onApplied }) {
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(null)
  const path = '/api/calendar-entries/' + entryId + '/shared-updates'
  useEffect(() => () => pending.current?.abort(), [])

  async function run(apply = false) {
    if (pending.current) return
    const controller = new AbortController()
    pending.current = controller
    setBusy(true)
    setError('')
    setNotice('')
    if (!apply) { setResult(null); setSelected([]) }
    try {
      const response = await fetch(path + (apply ? '' : '/check'), {
        method: apply ? 'PUT' : 'POST', cache: 'no-store', signal: controller.signal,
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareToken, ...(apply && { version: result.version, selected }) }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not compare event updates.')
      if (controller.signal.aborted) return
      if (apply) {
        setResult(null)
        setSelected([])
        setNotice('Selected updates applied. Use Calendar Undo to restore the previous version.')
        onApplied?.(data)
      } else setResult(data)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure.message)
    } finally {
      pending.current = null
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  return <section className="calendar-event-share" aria-label="Shared event updates">
    <div className="calendar-detail-actions">
      <button type="button" disabled={busy || disabled} onClick={() => run()}>
        <RefreshCw size={15} aria-hidden="true"/>{busy && !result ? 'Checking…' : result ? 'Check again' : 'Check for updates'}
      </button>
    </div>
    {error && <p role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {result && (result.changes.length ? <div className="calendar-update-comparison">
      {!result.hasBaseline && <p>For some fields, the original value is unavailable. Review the differences before applying them.</p>}
      {result.changes.map(change => <div className="calendar-update-change" key={change.key}>
        <label><input type="checkbox" checked={selected.includes(change.key)} disabled={busy || disabled}
          onChange={event => setSelected(previous => event.target.checked ? [...previous, change.key] : previous.filter(key => key !== change.key))}/>
          {labels[change.key]}{change.locallyEdited && ' · Edited in your copy'}
        </label>
        <div className="calendar-update-values">
          <div><strong>Your copy</strong><p>{format(change.key, change.current)}</p></div>
          <div><strong>Shared original</strong><p>{format(change.key, change.incoming)}</p></div>
        </div>
      </div>)}
      <div className="calendar-detail-actions">
        <button type="button" disabled={busy || disabled || !selected.length} onClick={() => run(true)}>{busy ? 'Applying…' : 'Apply selected changes'}</button>
        <button type="button" disabled={busy} onClick={() => { setResult(null); setSelected([]); setError('') }}>Done</button>
      </div>
    </div> : <p role="status">No new differences to apply.</p>)}
  </section>
}
