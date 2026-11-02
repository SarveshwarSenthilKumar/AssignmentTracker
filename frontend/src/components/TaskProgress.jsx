import { useEffect, useRef, useState } from 'react'
import { zonedLocal } from '../lib/timeZone'
import { readApiJson } from '../lib/apiResponse'
import './TaskProgress.css'

const today = () => zonedLocal(Date.now()).slice(0, 10)
const number = value => Number(value).toLocaleString()
const totalFor = task => (task.progressLogs || []).reduce((sum, entry) => sum + entry.amount, 0)
const dateLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })

export function ProgressSummary({ task }) {
  if (!task.progressTarget) return null
  const total = totalFor(task)
  return <div className="task-progress-summary"><span>{number(total)} / {number(task.progressTarget)} {task.progressUnit || 'units'}{total >= task.progressTarget ? ' · Goal reached' : ''}</span><progress max={task.progressTarget} value={Math.min(total, task.progressTarget)} aria-label={`${task.text}: ${total} of ${task.progressTarget}`}/></div>
}

export function ProgressCreateFields({ value, onChange, disabled }) {
  return <div className="task-progress-create"><label className="task-progress-toggle"><input type="checkbox" checked={value.enabled} disabled={disabled} onChange={event => onChange({ ...value, enabled: event.target.checked })}/>Track progress over multiple days</label>{value.enabled && <div className="task-progress-fields"><label>Target<input type="number" min="1" max="1000000000" step="1" required disabled={disabled} value={value.target} onChange={event => onChange({ ...value, target: event.target.value })} placeholder="200"/></label><label>Unit (optional)<input maxLength="40" disabled={disabled} value={value.unit} onChange={event => onChange({ ...value, unit: event.target.value })} placeholder="applications"/></label><p>Log a little each day, such as 20 applications toward a target of 200.</p></div>}</div>
}

export default function TaskProgress({ task, token, onSaved }) {
  const [target, setTarget] = useState(String(task.progressTarget || ''))
  const [unit, setUnit] = useState(task.progressUnit || '')
  const [editing, setEditing] = useState(false)
  const [day, setDay] = useState(today), [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const lock = useRef(false), pending = useRef(null)
  useEffect(() => { setTarget(String(task.progressTarget || '')); setUnit(task.progressUnit || '') }, [task._id, task.progressTarget, task.progressUnit])
  const total = totalFor(task), logs = task.progressLogs || []
  const save = async (suffix, method, body, message, after) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/todos/${task._id}/progress${suffix}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save progress.')
      if (!data._id) throw new Error('The server did not confirm the save. Retry the entry to check it.')
      onSaved(data); setNotice(message); after?.()
    } catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }
  const configure = event => {
    event.preventDefault()
    save('', 'PUT', { progressTarget: Number(target), progressUnit: unit }, 'Progress target saved.', () => setEditing(false))
  }
  const logProgress = event => {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isSafeInteger(value) || value <= 0 || value > 1000000000 || !day || day > today()) { setError('Choose today or an earlier date and a positive whole-number amount.'); return }
    // Keep the ID after a network failure, so a retry cannot count the same entry twice.
    if (!pending.current || pending.current.day !== day || pending.current.amount !== value) pending.current = { id: crypto.randomUUID(), day, amount: value }
    save('/entries', 'POST', pending.current, `Logged ${number(value)} for ${dateLabel(day)}.`, () => { pending.current = null; setAmount('') })
  }
  const days = [...new Set(logs.map(entry => entry.day))].sort().reverse()
  return <section className="task-progress" aria-label="Daily task progress" aria-busy={busy} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <header><strong>Daily progress</strong>{!!task.progressTarget && <button type="button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? 'Close target settings' : 'Edit target'}</button>}</header>
    {!task.progressTarget && !editing && <><p>Chip away at a larger goal, such as 200 job applications.</p><button type="button" onClick={() => setEditing(true)}>Set a progress target</button></>}
    {editing && <form onSubmit={configure} className="task-progress-fields"><label>Target<input type="number" min="1" max="1000000000" step="1" required value={target} disabled={busy} onChange={event => setTarget(event.target.value)}/></label><label>Unit (optional)<input value={unit} maxLength="40" disabled={busy} onChange={event => setUnit(event.target.value)} placeholder="applications"/></label><button disabled={busy}>Save target</button>{!task.progressTarget && <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>}</form>}
    {!!task.progressTarget && <>
      <ProgressSummary task={task}/>
      <p>{total >= task.progressTarget ? 'Goal reached!' : `${number(task.progressTarget - total)} remaining`} · Today: {number(logs.filter(entry => entry.day === today()).reduce((sum, entry) => sum + entry.amount, 0))} {task.progressUnit || 'units'}</p>
      <p>Log dates follow your account time zone. Task status stays under your control.</p>
      <form onSubmit={logProgress} className="task-progress-fields"><label>Day<input type="date" required value={day} max={today()} disabled={busy} onChange={event => setDay(event.target.value)}/></label><label>Add {task.progressUnit || 'progress'}<input type="number" min="1" max="1000000000" step="1" required value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} placeholder="20"/></label><button disabled={busy}>{busy ? 'Saving…' : 'Log progress'}</button></form>
      <details><summary>Daily history ({logs.length} {logs.length === 1 ? 'entry' : 'entries'})</summary>{!logs.length && <p>No progress logged yet.</p>}{days.map(date => <div className="task-progress-day" key={date}><strong>{dateLabel(date)} · {number(logs.filter(entry => entry.day === date).reduce((sum, entry) => sum + entry.amount, 0))} {task.progressUnit || 'units'}</strong>{logs.filter(entry => entry.day === date).map(entry => <div className="task-progress-entry" key={entry.id}><span>+{number(entry.amount)}</span><button type="button" disabled={busy} aria-label={`Remove ${entry.amount} from ${dateLabel(date)}`} onClick={() => save(`/entries/${entry.id}`, 'DELETE', null, 'Entry removed; totals updated.')}>Remove entry</button></div>)}</div>)}</details>
    </>}
    {error && <p role="alert" className="task-progress-error">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}
