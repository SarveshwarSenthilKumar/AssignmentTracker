import { useRef, useState } from 'react'
import { ArrowRight, GitBranch, X } from 'lucide-react'
import { dependencySummary } from '../lib/taskDependencies'
import './TaskDependencies.css'

const labels = { todo: 'To do', 'in-progress': 'In progress', completed: 'Completed' }
export default function TaskDependencies({ taskId, tasks, token, onTasksChange, onOpenTask }) {
  const [adding, setAdding] = useState(false), [query, setQuery] = useState(''), [direction, setDirection] = useState('after'), [relatedId, setRelatedId] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const lock = useRef(false), summary = dependencySummary(taskId, tasks), task = tasks.find(task => task._id === taskId)
  const options = tasks.filter(task => task._id !== taskId && `${task.text} ${task.description || ''}`.toLowerCase().includes(query.toLowerCase()) && !(direction === 'after' ? summary.prerequisites : summary.following).some(item => item._id === task._id))
  const save = async (beforeId, afterId, linked) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/task-dependencies', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ beforeId, afterId, linked }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Could not save the connection.')
      onTasksChange(prev => prev.map(task => task._id === data._id ? data : task))
      setNotice(linked ? 'Connection saved. Task statuses remain unrestricted.' : 'Connection removed.'); setRelatedId('')
    } catch (error) { setError(error.message) }
    finally { lock.current = false; setBusy(false) }
  }
  const list = (items, before) => <div className="task-dependency-list">{items.map(item => <div key={item._id}><button type="button" className="task-dependency-open" onClick={() => onOpenTask(item)}><ArrowRight size={13}/><span>{item.text}<small>{labels[item.status] || 'To do'}</small></span></button><button type="button" disabled={busy} aria-label={`Remove connection to ${item.text}`} onClick={() => save(before ? item._id : taskId, before ? taskId : item._id, false)}><X size={14}/></button></div>)}</div>
  return <section className="task-dependencies" aria-label="Task connections" aria-busy={busy}>
    <header><strong><GitBranch size={16}/>Task connections</strong><button type="button" disabled={busy} onClick={() => { setAdding(!adding); setError('') }}>{adding ? 'Close picker' : 'Add connection'}</button></header>
    <p>Planned order only. You can start or complete any task at any time.</p>
    {!!summary.prerequisites.length && <div className="task-dependency-progress"><span>{summary.completed}/{summary.prerequisites.length} prerequisites complete</span><progress max={summary.prerequisites.length} value={summary.completed} aria-label="Prerequisite completion"/></div>}
    {summary.open.length > 0 && <p className="task-dependency-note">{task?.status === 'completed' ? 'Completed with' : 'Planned after'} {summary.open.length} unfinished {summary.open.length === 1 ? 'prerequisite' : 'prerequisites'}. Status changes are still available.</p>}
    {summary.circular && <p className="task-dependency-note">Circular sequence: this task eventually leads back to itself. Review the connections if that was unintended.</p>}
    <h5>Before this task <span>{summary.prerequisites.length}</span></h5>{summary.prerequisites.length ? list(summary.prerequisites, true) : <small>No prerequisites linked.</small>}
    <h5>After this task <span>{summary.following.length}</span></h5>{summary.following.length ? list(summary.following, false) : <small>No follow-up tasks linked.</small>}
    {adding && <div className="task-dependency-picker"><label>Planned order<select aria-label="Task connection direction" value={direction} disabled={busy} onChange={event => { setDirection(event.target.value); setRelatedId('') }}><option value="after">This task comes after the linked task</option><option value="before">This task comes before the linked task</option></select></label><input aria-label="Search tasks to connect" placeholder="Search tasks across all folders…" value={query} onChange={event => { setQuery(event.target.value); setRelatedId('') }}/><select aria-label="Task to connect" value={relatedId} disabled={busy} onChange={event => setRelatedId(event.target.value)}><option value="">Choose a task…</option>{options.map(task => <option key={task._id} value={task._id}>{task.text} · {labels[task.status] || 'To do'}</option>)}</select>{!options.length && <small>No unlinked tasks match this direction and search.</small>}<button type="button" disabled={busy || !options.some(task => task._id === relatedId)} onClick={() => save(direction === 'after' ? relatedId : taskId, direction === 'after' ? taskId : relatedId, true)}>{busy ? 'Saving…' : 'Save connection'}</button></div>}
    {error && <p role="alert" className="task-dependency-error">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>
}
