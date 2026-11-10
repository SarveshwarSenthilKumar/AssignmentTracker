import { useRef, useState } from 'react'
import { readApiJson } from '../lib/apiResponse'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ClassScheduleImport({ token, disabled, onReview }) {
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)

  async function importFile(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file || lock.current) return
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a schedule file up to 10 MB.')
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('schedule', file)
      const response = await fetch('/api/calendar/class-schedule/import', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body
      })
      const data = await readApiJson(response)
      if (!response.ok || !Array.isArray(data.classes)) throw new Error(data.message || 'Could not read the schedule.')
      setRows(data.classes)
    } catch (error) {
      setError(error.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <details className="calendar-repeat">
    <summary>Import class schedule from PDF or screenshot</summary>
    <p>The file is sent to Gemini to extract meetings. Review and save each class separately.</p>
    <label>Schedule file <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={busy || disabled} onChange={importFile}/></label>
    {busy && <p role="status">Reading schedule…</p>}
    {error && <p role="alert">{error}</p>}
    {rows.length > 0 && <ul>{rows.map((row, index) => <li key={index}>
      <strong>{row.title}</strong> · {row.weekdays.map(day => weekdays[day]).join(', ') || 'Weekdays needed'} · {row.startTime || 'Start time needed'}{row.endTime ? `–${row.endTime}` : ' · End time needed'}
      {(!row.startDate || !row.endDate) && ' · Review term dates'}
      <div className="calendar-detail-actions"><button type="button" disabled={busy || disabled} onClick={() => onReview(row)}>Fill class form</button></div>
    </li>)}</ul>}
  </details>
}
