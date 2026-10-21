import { useEffect, useRef, useState } from 'react'
import { Undo2, Loader2 } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'

export const notifyTaskDeletion = () => window.dispatchEvent(new Event('task-deleted'))

export default function TaskDeletionUndo({ token, onRestored }) {
  const [records, setRecords] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false), generation = useRef(0)
  const refresh = async () => {
    const current = ++generation.current
    try {
      const response = await fetch('/api/todos/deletion-history', { headers: { Authorization: `Bearer ${token}` } })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not load task recovery history.')
      if (current === generation.current) setRecords(data)
    } catch (err) { if (current === generation.current) setError(err.message) }
  }
  useEffect(() => {
    setRecords([]); setError('')
    if (!token) return
    refresh()
    const listener = () => { setError(''); refresh() }
    window.addEventListener('task-deleted', listener)
    window.addEventListener('workspace-reset', listener)
    return () => { generation.current++; window.removeEventListener('task-deleted', listener); window.removeEventListener('workspace-reset', listener) }
  }, [token])
  const undo = async () => {
    if (lock.current || !records.length) return
    lock.current = true; setBusy(true); setError('')
    try {
      const response = await fetch(`/api/todos/deletion-history/${records[0]._id}/undo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const result = await readApiJson(response)
      if (!response.ok) throw new Error(result.message || 'Could not restore deleted tasks.')
      setRecords(previous => previous.slice(1))
      await onRestored()
    } catch (err) { setError(err.message) }
    finally { lock.current = false; setBusy(false); await refresh() }
  }
  if (!records.length && !error) return null
  return <div className="calendar-feedback task-deletion-undo" role="status">
    <span>{records.length ? <>Deleted {records[0].count === 1 ? `“${records[0].label}”` : records[0].label}. <small>Recoverable for 7 days.{records.length > 1 ? ' Undo again to restore earlier deletions.' : ''}</small></> : 'Task recovery is unavailable.'}</span>
    {records.length > 0 && <button type="button" disabled={busy} onClick={undo} aria-label="Undo last task deletion">{busy ? <Loader2 size={16} className="animate-spin"/> : <Undo2 size={16}/>} {busy ? 'Restoring…' : 'Undo deletion'}</button>}
    {error && <span role="alert">{error} <button type="button" disabled={busy} onClick={refresh}>Retry</button></span>}
  </div>
}
