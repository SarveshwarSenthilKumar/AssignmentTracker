import { useRef, useState } from 'react'
import { readApiJson } from '../lib/apiResponse'
import CoverLetterError from './CoverLetterError'

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ClassScheduleImport({ token, disabled, onReview }) {
  const [rows, setRows] = useState([])
  const [warning, setWarning] = useState('')
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const lock = useRef(false)

  async function importFile(file, useOriginal = false) {
    if (!file || lock.current) return
    setRows([])
    setWarning('')
    if (file.size > 10 * 1024 * 1024) {
      setError('Choose a schedule file up to 10 MB.')
      return
    }
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      let extracted = ''
      if (!useOriginal) {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 30000)
        setStage('Reading text on this device')
        try {
          const { readLocalJobFile } = await import('../lib/localJobFile')
          const result = await readLocalJobFile(file, { signal: controller.signal, preserveRows: true })
          extracted = result.text
        } catch {
          // If the text layer or local OCR is unavailable, Gemini can read the original.
        } finally { clearTimeout(timer) }
      }
      if (extracted) body.append('scheduleText', extracted)
      else body.append('schedule', file)
      setStage(extracted ? 'Organizing extracted text with Gemini' : 'Reading the original file with Gemini')
      const response = await fetch('/api/calendar/class-schedule/import', {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body
      })
      const data = await readApiJson(response)
      if (!response.ok || !Array.isArray(data.classes)) {
        setError({ message: data.message || 'Could not read the schedule.', diagnostics: data.diagnostics })
        return
      }
      setRows(data.classes)
      setWarning(data.warning || '')
    } catch (error) {
      setError(error.message)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  return <details className="calendar-repeat">
    <summary>Import class schedule from PDF or screenshot</summary>
    <p>Text is extracted on this device when possible. Gemini receives the extracted text or the original file if local reading is unavailable. Review and save each class separately.</p>
    <label>Schedule file <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" disabled={busy || disabled} onChange={event => {
      const file = event.currentTarget.files[0]
      if (!file) return
      setSelectedFile(file)
      importFile(file)
    }}/></label>
    {busy && <p role="status">{stage || 'Reading schedule'} · {selectedFile?.name}</p>}
    {error && (error.diagnostics ? <CoverLetterError error={error} expanded/> : <p role="alert">{error.message || error}</p>)}
    {warning && <p role="status">{warning}</p>}
    {error && selectedFile && <button type="button" disabled={busy || disabled} onClick={() => importFile(selectedFile)}>Retry selected file</button>}
    {selectedFile && !busy && (error || rows.length > 0) && <button type="button" disabled={disabled} onClick={() => importFile(selectedFile, true)}>Read original file with Gemini</button>}
    {rows.length > 0 && <ul>{rows.map((row, index) => <li key={index}>
      <strong>{row.title}</strong> · {row.weekdays.map(day => weekdays[day]).join(', ') || 'Weekdays needed'} · {row.startTime || 'Start time needed'}{row.endTime ? `–${row.endTime}` : ' · End time needed'}
      {(!row.startDate || !row.endDate) && ' · Review term dates'}
      <div className="calendar-detail-actions"><button type="button" disabled={busy || disabled} onClick={() => onReview(row)}>Fill class form</button></div>
    </li>)}</ul>}
  </details>
}
