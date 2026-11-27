import { useEffect, useRef, useState } from 'react'
import { Link2 } from 'lucide-react'
import { calendarDay, calendarTime, dayLabel } from '../lib/calendar'
import { readApiJson } from '../lib/apiResponse'
import './CalendarEventSharing.css'

async function request(path, token, options = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', headers: { Authorization: 'Bearer ' + token } })
  const data = await readApiJson(response)
  if (!response.ok) throw new Error(data.message || 'Could not complete calendar sharing.')
  return data
}

export function CalendarEventShareLink({ entry, token, disabled }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const linkField = useRef(null)
  const path = '/api/calendar-entries/' + entry._id + '/share-link'

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setActive(null)
    request(path, token, { signal: controller.signal }).then(data => setActive(data.active)).catch(error => {
      if (!controller.signal.aborted) setError(error.message)
    })
    return () => controller.abort()
  }, [open, path, token])

  const changeLink = async method => {
    setError(''); setNotice(''); setBusy(true)
    try {
      const data = await request(path, token, { method })
      if (method === 'DELETE') {
        setUrl(''); setActive(false); setNotice('Share link revoked.')
      } else {
        const link = new URL('#' + data.path, window.location.href)
        link.search = ''
        setUrl(link.href); setActive(true); setNotice('Share link ready.')
      }
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }

  if (!open) return <div className="calendar-detail-actions"><button type="button" disabled={disabled} onClick={() => setOpen(true)}><Link2 size={15} aria-hidden="true"/>Share event</button></div>
  return <section className="calendar-event-share" aria-label="Share calendar event">
    <h5>Share event</h5>
    <p>Anyone with the link and an Assignment Tracker account can copy this event, including its notes and the attachments present when you create the link. The link shares this occurrence. Linked tasks stay private.</p>
    {entry.documentIds?.length > 0 && <p>Recipients get their own copies of the attachments. The combined copy limit is 50 MB.</p>}
    {active && !url && <p>A link is active. Creating a new link replaces it.</p>}
    <div className="calendar-detail-actions">
      <button type="button" disabled={disabled || busy || active === null} onClick={() => changeLink('POST')}>{active ? 'Replace link' : 'Create link'}</button>
      {active && <button type="button" disabled={disabled || busy} onClick={() => changeLink('DELETE')}>Revoke link</button>}
      <button type="button" disabled={busy} onClick={() => { setOpen(false); setError(''); setNotice('') }}>Done</button>
    </div>
    {url && <div className="calendar-share-copy">
      <label>Event link<input ref={linkField} value={url} readOnly onFocus={event => event.target.select()}/></label>
      <div className="calendar-detail-actions"><button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(url); setNotice('Link copied.') }
        catch { linkField.current?.focus(); linkField.current?.select(); setNotice('Copy the selected link.') }
      }}>Copy link</button></div>
    </div>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}

export function SharedCalendarEvent({ shareToken, token, onOpenEvent }) {
  const [event, setEvent] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const path = '/api/calendar-event-shares/' + encodeURIComponent(shareToken || 'invalid')

  useEffect(() => {
    const controller = new AbortController()
    request(path, token, { signal: controller.signal }).then(setEvent).catch(error => {
      if (!controller.signal.aborted) setError(error.message)
    })
    return () => controller.abort()
  }, [path, token])

  const add = async () => {
    setBusy(true); setError('')
    try {
      const { entryId } = await request(path, token, { method: 'POST' })
      onOpenEvent(entryId)
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }

  const startDay = event && (event.allDay ? event.startDate : calendarDay(event.startAt))
  const endDay = event && (event.allDay ? event.endDate : event.endAt ? calendarDay(event.endAt) : startDay)
  return <article className="calendar-event-share shared-calendar-event" aria-label="Shared calendar event">
    {event ? <>
      <h2>{event.title}</h2>
      <p>{dayLabel(startDay, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        {endDay !== startDay && ' – ' + dayLabel(endDay, { month: 'long', day: 'numeric', year: 'numeric' })}
        <br />{calendarTime(event)}</p>
      {event.location && <p>{event.location}</p>}
      {event.notes && <p className="shared-calendar-notes">{event.notes}</p>}
      {event.attachments.length > 0 && <section aria-label="Event attachments">
        <h3>Attachments included</h3>
        <ul>{event.attachments.map((file, index) => <li key={index}>{file.name}</li>)}</ul>
      </section>}
      <div className="calendar-detail-actions">
        {event.entryId ? <button type="button" onClick={() => onOpenEvent(event.entryId)}>View in my calendar</button>
          : <button type="button" disabled={busy} onClick={add}>{busy ? 'Adding event…' : 'Add to my calendar'}</button>}
        <a className="calendar-event-link" href="#/calendar">Back to Calendar</a>
      </div>
    </> : !error && <p role="status">Loading shared event…</p>}
    {error && <p role="alert">{error}</p>}
  </article>
}
