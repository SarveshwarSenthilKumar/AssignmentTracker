import { useEffect, useRef, useState } from 'react'
import { zonedLocal } from '../lib/timeZone'
import { readApiJson } from '../lib/apiResponse'
import './TaskProgress.css'

const today = () => zonedLocal(Date.now()).slice(0, 10)
const number = value => Number(value).toLocaleString()
const totalFor = task => (task.progressLogs || []).reduce((sum, entry) => sum + entry.amount, 0)
const dateLabel = day => new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { timeZone: 'UTC', year: 'numeric', month: 'short', day: 'numeric' })

function MilestoneFields({ items, onChange, target, disabled }) {
  const update = (index, field, value) => onChange(items.map((item, position) => position === index ? { ...item, [field]: value } : item))
  return <fieldset className="task-progress-milestones" disabled={disabled}>
    <legend>Milestones (optional)</legend>
    <p>Set cumulative goals by date, such as 50 by Friday and 100 by the following Friday.</p>
    {items.map((item, index) => <div className="task-progress-fields" key={index}>
      <label>Total by this date<input type="number" min="1" max={Number(target) || 1000000000} step="1" required value={item.target} onChange={event => update(index, 'target', event.target.value)}/></label>
      <label>Due date<input type="date" required value={item.day} onChange={event => update(index, 'day', event.target.value)}/></label>
      <button type="button" onClick={() => onChange(items.filter((_, position) => position !== index))} aria-label={`Remove milestone ${index + 1}`}>Remove</button>
    </div>)}
    <button type="button" disabled={items.length >= 30} onClick={() => onChange([...items, { day: '', target: '' }])}>Add milestone</button>
  </fieldset>
}

function MilestoneSummary({ task, today, total }) {
  const milestones = task.progressMilestones || []
  if (!milestones.length) return null
  return <section className="task-progress-milestones" aria-label="Progress milestones">
    <strong>Milestones</strong>
    <ul>{milestones.map(({ day, target }) => {
      const byDeadline = (task.progressLogs || []).reduce((sum, entry) => entry.day <= day ? sum + entry.amount : sum, 0)
      const state = byDeadline >= target ? 'Reached on time' : day < today ? total >= target ? 'Reached after deadline' : 'Past due' : day === today ? 'Due today' : 'Upcoming'
      return <li key={day}>
        <strong>{number(target)} {task.progressUnit || 'units'} by {dateLabel(day)}</strong>
        <span>{number(byDeadline)} of {number(target)} logged by deadline · {state}</span>
        <progress value={Math.min(byDeadline, target)} max={target} aria-label={`${number(byDeadline)} of ${number(target)} by ${dateLabel(day)}`}/>
      </li>
    })}</ul>
  </section>
}

export function ProgressSummary({ task }) {
  if (!task.progressTarget) return null
  const total = totalFor(task)
  return <span className="task-progress-summary"><span>{number(total)} / {number(task.progressTarget)} {task.progressUnit || 'units'}{total >= task.progressTarget ? ' · Goal reached' : ''}</span><progress max={task.progressTarget} value={Math.min(total, task.progressTarget)} aria-label={`${task.text}: ${total} of ${task.progressTarget}`}/></span>
}

export function ProgressCreateFields({ value, onChange, disabled }) {
  return <div className="task-progress-create"><label className="task-progress-toggle"><input type="checkbox" checked={value.enabled} disabled={disabled} onChange={event => onChange({ ...value, enabled: event.target.checked })}/>Track progress over multiple days</label>{value.enabled && <div className="task-progress-fields"><label>Target<input type="number" min="1" max="1000000000" step="1" required disabled={disabled} value={value.target} onChange={event => onChange({ ...value, target: event.target.value })} placeholder="200"/></label><label>Unit (optional)<input maxLength="40" disabled={disabled} value={value.unit} onChange={event => onChange({ ...value, unit: event.target.value })} placeholder="applications"/></label><label className="task-progress-toggle"><input type="checkbox" checked={!!value.autoComplete} disabled={disabled} onChange={event => onChange({ ...value, autoComplete: event.target.checked })}/>Mark complete when the goal is reached</label><MilestoneFields items={value.milestones||[]} onChange={milestones=>onChange({...value,milestones})} target={value.target} disabled={disabled}/></div>}</div>
}

export default function TaskProgress({ task, token, onSaved, showSummary = true }) {
  const [target, setTarget] = useState(String(task.progressTarget || ''))
  const [unit, setUnit] = useState(task.progressUnit || '')
  const [autoComplete, setAutoComplete] = useState(task.progressAutoComplete === true)
  const [milestones, setMilestones] = useState(task.progressMilestones || [])
  const [editing, setEditing] = useState(false)
  const [day, setDay] = useState(today), [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [noteDraft, setNoteDraft] = useState(null)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const lock = useRef(false), pending = useRef(null)
  useEffect(() => {
    setTarget(String(task.progressTarget || ''))
    setUnit(task.progressUnit || '')
    setAutoComplete(task.progressAutoComplete === true)
    setMilestones(task.progressMilestones || [])
  }, [task._id, task.progressTarget, task.progressUnit, task.progressAutoComplete, task.progressMilestones])
  const total = totalFor(task), logs = task.progressLogs || []
  const todayLabel = today()
  const yesterday = new Date(Date.parse(`${todayLabel}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  const remaining = Math.max(0, (task.progressTarget || 0) - total)
  const save = async (suffix, method, body, message, after) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/todos/${task._id}/progress${suffix}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save progress.')
      if (!data._id) throw new Error('The server did not confirm the save. Retry the entry to check it.')
      onSaved(data); setNotice(task.status !== 'completed' && data.status === 'completed' ? `${message} Task marked complete.` : message); after?.()
    } catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }
  const configure = event => {
    event.preventDefault()
    save('', 'PUT', {
      progressTarget: Number(target), progressUnit: unit, progressAutoComplete: autoComplete,
      progressMilestones: milestones.map(item => ({ day: item.day, target: Number(item.target) }))
    }, 'Progress target saved.', () => setEditing(false))
  }
  const logProgress = event => {
    event.preventDefault()
    const value = Number(amount)
    if (!Number.isSafeInteger(value) || value <= 0 || value > 1000000000 || !day || day > today()) { setError('Choose today or an earlier date and a positive whole-number amount.'); return }
    // Keep the ID after a network failure, so a retry cannot count the same entry twice.
    const entry = pending.current
    const id = entry?.day === day && entry.amount === value ? entry.id : crypto.randomUUID()
    pending.current = { id, day, amount: value, note: note.trim() }
    save('/entries', 'POST', pending.current, `Logged ${number(value)} for ${dateLabel(day)}.`, () => { pending.current = null; setAmount(''); setNote('') })
  }
  const days = [...new Set(logs.map(entry => entry.day))].sort().reverse()
  return <section className="task-progress" aria-label="Daily task progress" aria-busy={busy} onClick={event => event.stopPropagation()} onPointerDown={event => event.stopPropagation()}>
    <header><strong>Daily progress</strong>{!!task.progressTarget && <button type="button" disabled={busy} onClick={() => setEditing(!editing)}>{editing ? 'Close target settings' : 'Edit target'}</button>}</header>
    {!task.progressTarget && !editing && <><p>Chip away at a larger goal, such as 200 job applications.</p><button type="button" onClick={() => setEditing(true)}>Set a progress target</button></>}
    {editing && <form onSubmit={configure} className="task-progress-fields"><label>Target<input type="number" min="1" max="1000000000" step="1" required value={target} disabled={busy} onChange={event => setTarget(event.target.value)}/></label><label>Unit (optional)<input value={unit} maxLength="40" disabled={busy} onChange={event => setUnit(event.target.value)} placeholder="applications"/></label><label className="task-progress-toggle"><input type="checkbox" checked={autoComplete} disabled={busy} onChange={event => setAutoComplete(event.target.checked)}/>Mark complete when the goal is reached</label><MilestoneFields items={milestones} onChange={setMilestones} target={target} disabled={busy}/><button disabled={busy}>Save target</button>{!task.progressTarget && <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>}</form>}
    {!!task.progressTarget && <>
      {showSummary && <ProgressSummary task={task}/>}
      <MilestoneSummary task={task} today={todayLabel} total={total}/>
      <p>{task.progressAutoComplete ? 'Completes automatically when the goal is reached.' : 'You mark this task complete manually.'}</p>
      <p>{total >= task.progressTarget ? 'Goal reached!' : `${number(task.progressTarget - total)} remaining`} · Today: {number(logs.filter(entry => entry.day === today()).reduce((sum, entry) => sum + entry.amount, 0))} {task.progressUnit || 'units'}</p>
      <form onSubmit={logProgress} className="task-progress-log">
        <div className="task-progress-fields">
          <label>Add {task.progressUnit || 'units'}<input type="number" inputMode="numeric" min="1" max="1000000000" step="1" required value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} placeholder="Enter amount"/></label>
          <label>Date<input type="date" required value={day} max={todayLabel} disabled={busy} onChange={event => setDay(event.target.value)}/></label>
        </div>
        <div className="task-progress-presets" role="group" aria-label="Choose amount">
          {[1, 5, 10].map(value => <button key={value} type="button" disabled={busy} aria-pressed={Number(amount) === value} onClick={() => setAmount(String(value))}>{value}</button>)}
          {remaining > 0 && <button type="button" disabled={busy} aria-pressed={Number(amount) === remaining} onClick={() => setAmount(String(remaining))}>Remaining ({number(remaining)})</button>}
        </div>
        <div className="task-progress-presets" role="group" aria-label="Choose date">
          <button type="button" disabled={busy} aria-pressed={day === todayLabel} onClick={() => setDay(todayLabel)}>Today</button>
          <button type="button" disabled={busy} aria-pressed={day === yesterday} onClick={() => setDay(yesterday)}>Yesterday</button>
        </div>
        <label className="task-progress-note">Note (optional)<textarea rows={2} maxLength={1000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="What did you work on?"/></label>
        <button className="task-progress-submit" disabled={busy || !amount || !day}>{busy ? 'Saving…' : 'Save progress'}</button>
      </form>
      <details>
        <summary>Daily history ({logs.length} {logs.length === 1 ? 'entry' : 'entries'})</summary>
        {!logs.length && <p>No progress logged yet.</p>}
        {days.map(date => {
          const entries = logs.filter(entry => entry.day === date)
          return <div className="task-progress-day" key={date}>
            <strong>{dateLabel(date)} · {number(entries.reduce((sum, entry) => sum + entry.amount, 0))} {task.progressUnit || 'units'}</strong>
            {entries.map(entry => <div key={entry.id}>
              <div className="task-progress-entry">
                <span>+{number(entry.amount)}</span>
                <button type="button" disabled={busy} onClick={() => setNoteDraft({ id: entry.id, text: entry.note || '' })}>{entry.note ? 'Edit note' : 'Add note'}</button>
                <button type="button" disabled={busy} aria-label={`Remove ${entry.amount} from ${dateLabel(date)}`} onClick={() => save(`/entries/${entry.id}`, 'DELETE', null, 'Entry removed. Totals updated.', () => { if (noteDraft?.id === entry.id) setNoteDraft(null) })}>Remove entry</button>
              </div>
              {noteDraft?.id === entry.id ? <form onSubmit={event => {
                event.preventDefault()
                save(`/entries/${entry.id}`, 'PATCH', { note: noteDraft.text }, 'Note saved.', () => setNoteDraft(null))
              }}>
                <label className="task-progress-note">Entry note<textarea rows={2} maxLength={1000} value={noteDraft.text} disabled={busy} onChange={event => setNoteDraft({ id: entry.id, text: event.target.value })}/></label>
                <div className="task-progress-presets"><button disabled={busy}>Save note</button><button type="button" disabled={busy} onClick={() => setNoteDraft(null)}>Cancel</button></div>
              </form> : entry.note && <p className="task-progress-note-text">{entry.note}</p>}
            </div>)}
          </div>
        })}
      </details>
    </>}
    {error && <p role="alert" className="task-progress-error">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}
