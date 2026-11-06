import { useEffect, useRef, useState } from 'react'
import { Undo2, Loader2, Trash2 } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'
import InlineConfirmation from './InlineConfirmation'

export const notifyTaskDeletion = () => window.dispatchEvent(new Event('task-deleted'))
const isRecoverable = record => !record.expiresAt || Date.parse(record.expiresAt) > Date.now()

export default function TaskDeletionUndo({ token, onRestored, onRecreate, recreatingTask }) {
  const [records, setRecords] = useState([]), [busy, setBusy] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true)
  const lock = useRef(false), generation = useRef(0)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [notice, setNotice] = useState('')
  const refresh = async () => {
    const current = ++generation.current
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/todos/deletion-history', { headers: { Authorization: `Bearer ${token}` } })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not load task recovery history.')
      if (current === generation.current) setRecords(data.filter(isRecoverable))
    } catch (err) { if (current === generation.current) setError(err.message) }
    finally { if (current === generation.current) setLoading(false) }
  }
  useEffect(() => {
    setRecords([]); setError(''); setPendingDelete(null); setNotice('')
    if (!token) return
    refresh()
    const listener = () => refresh()
    const expire = window.setInterval(() => setRecords(previous => previous.filter(isRecoverable)), 60000)
    window.addEventListener('task-deleted', listener)
    window.addEventListener('workspace-reset', listener)
    return () => { generation.current++; window.clearInterval(expire); window.removeEventListener('task-deleted', listener); window.removeEventListener('workspace-reset', listener) }
  }, [token])
  const changeRecord = async (id, permanent = false) => {
    if (lock.current || recreatingTask) return
    lock.current = true
    setBusy({ id, permanent }); setError(''); setNotice(''); setPendingDelete(null)
    try {
      const response = await fetch(`/api/todos/deletion-history/${id}${permanent ? '' : '/undo'}`, { method: permanent ? 'DELETE' : 'POST', headers: { Authorization: `Bearer ${token}` } })
      const result = await readApiJson(response)
      if (!response.ok) throw new Error(result.message || (permanent ? 'Could not permanently delete tasks.' : 'Could not restore deleted tasks.'))
      setRecords(previous => previous.filter(record => record._id !== id))
      if (permanent) setNotice('Permanently deleted.')
      else await onRestored()
    } catch (err) { setError(err.message) }
    finally { lock.current = false; setBusy(null) }
  }
  const recreate = async (recordId, taskId) => {
    setError('')
    try { await onRecreate(recordId, taskId) }
    catch (error) { setError(error.message) }
  }
  const recreateButton = (record, task) => task?.id && task.canRecreate && <button type="button" disabled={!!busy || loading || !!pendingDelete || !!recreatingTask} onClick={() => recreate(record._id, task.id)}>{recreatingTask === task.id ? 'Recreating…' : 'Recreate task'}</button>
  return <section className="recently-deleted-tasks" aria-labelledby="deleted-tasks-heading">
    <header><h2 id="deleted-tasks-heading">Recently deleted</h2><p>Use Recreate task to start a fresh copy from a deleted task. Expand a group to recreate a specific task. You can also restore or permanently delete a recovery record.</p></header>
    {error && <div role="alert">{error} <button type="button" disabled={!!busy || loading} onClick={refresh}>Retry</button></div>}
    {notice && <p role="status">{notice}</p>}
    {loading && <p role="status">Loading deleted tasks…</p>}
    {!loading && !error && !records.length && <p className="deleted-tasks-empty">No recently deleted tasks.</p>}
    <div className="deleted-task-list">{records.map(record => <article key={record._id}>
      <div className="deleted-task-summary"><h3>{record.label}</h3><p>{record.expiresAt ? `Available until ${new Date(record.expiresAt).toLocaleString()}` : 'No expiry'}</p>
        {record.count > 1 && <details><summary>View {record.count} deleted tasks</summary><ul>{record.tasks?.map((task, index) => <li key={task.id || index}>{task.text} {recreateButton(record, task)}</li>)}</ul></details>}
      </div>
      <div className="deleted-task-actions">
        {record.count === 1 && recreateButton(record, record.tasks?.[0])}
        <button type="button" disabled={!!busy || loading || !!pendingDelete} onClick={() => changeRecord(record._id)}>{busy?.id === record._id && !busy.permanent ? <><Loader2 size={16} className="animate-spin"/> Restoring…</> : <><Undo2 size={16}/> {record.count > 1 ? 'Restore group' : 'Restore task'}</>}</button>
        <button type="button" disabled={!!busy || loading || !!pendingDelete} onClick={() => setPendingDelete(record)}>{busy?.id === record._id && busy.permanent ? <><Loader2 size={16} className="animate-spin"/> Deleting…</> : <><Trash2 size={16}/> Permanently delete{record.count > 1 ? ' group' : ''}</>}</button>
      </div>
    </article>)}</div>
    <InlineConfirmation reveal pending={pendingDelete && {
      message: pendingDelete.count > 1 ? `Permanently delete all ${pendingDelete.count} tasks in this group? They cannot be restored.` : `Permanently delete “${pendingDelete.label}”? It cannot be restored.`,
      action: 'Permanently delete'
    }} settle={confirmed => confirmed ? changeRecord(pendingDelete._id, true) : setPendingDelete(null)}/>
  </section>
}
