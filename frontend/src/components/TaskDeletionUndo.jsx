import { useEffect, useRef, useState } from 'react'
import { Undo2, Loader2 } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'

export const notifyTaskDeletion = () => window.dispatchEvent(new Event('task-deleted'))

export default function TaskDeletionUndo({ token, onRestored }) {
  const [records, setRecords] = useState([]), [busy, setBusy] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const lock = useRef(false), generation = useRef(0)
  const refresh = async () => {
    const current = ++generation.current
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/todos/deletion-history', { headers: { Authorization: `Bearer ${token}` } })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not load task recovery history.')
      if (current === generation.current) setRecords(data.filter(record => new Date(record.expiresAt) > new Date()))
    } catch (err) { if (current === generation.current) setError(err.message) }
    finally { if (current === generation.current) setLoading(false) }
  }
  useEffect(() => {
    setRecords([]); setError('')
    if (!token) return
    refresh()
    const listener = () => refresh()
    const expire = window.setInterval(() => setRecords(previous => previous.filter(record => new Date(record.expiresAt) > new Date())), 60000)
    window.addEventListener('task-deleted', listener)
    window.addEventListener('workspace-reset', listener)
    return () => { generation.current++; window.clearInterval(expire); window.removeEventListener('task-deleted', listener); window.removeEventListener('workspace-reset', listener) }
  }, [token])
  const restore = async id => {
    if (lock.current) return
    lock.current = true; setBusy(id); setError('')
    try {
      const response = await fetch(`/api/todos/deletion-history/${id}/undo`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const result = await readApiJson(response)
      if (!response.ok) throw new Error(result.message || 'Could not restore deleted tasks.')
      setRecords(previous => previous.filter(record => record._id !== id))
      await onRestored()
    } catch (err) { setError(err.message) }
    finally { lock.current = false; setBusy(null) }
  }
  return <section className="recently-deleted-tasks" aria-labelledby="deleted-tasks-heading">
    <header><h2 id="deleted-tasks-heading">Recently deleted</h2><p>Deleted tasks stay here for seven days before being permanently removed. Restore a deletion to return its tasks to their original folders, or Inbox if a folder no longer exists.</p></header>
    {error && <div role="alert">{error} <button type="button" disabled={!!busy || loading} onClick={refresh}>Retry</button></div>}
    {loading && <p role="status">Loading deleted tasks…</p>}
    {!loading && !error && !records.length && <p className="deleted-tasks-empty">No recently deleted tasks.</p>}
    <div className="deleted-task-list">{records.map(record => <article key={record._id}>
      <div className="deleted-task-summary"><h3>{record.label}</h3><p>Available until {new Date(record.expiresAt).toLocaleString()}</p>
        {record.count > 1 && <details><summary>View {record.count} deleted tasks</summary><ul>{record.tasks?.map((task, index) => <li key={index}>{task.text}</li>)}</ul></details>}
      </div>
      <button type="button" disabled={!!busy || loading} onClick={() => restore(record._id)}>{busy === record._id ? <Loader2 size={16} className="animate-spin"/> : <Undo2 size={16}/>} {busy === record._id ? 'Restoring…' : record.count > 1 ? 'Restore group' : 'Restore task'}</button>
    </article>)}</div>
  </section>
}
