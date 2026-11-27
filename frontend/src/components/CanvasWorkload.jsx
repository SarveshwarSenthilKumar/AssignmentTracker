import { useId, useMemo, useState } from 'react'
import { taskDueLabel } from '../lib/calendar'

function minutes(value) {
  if (value < 60) return value + ' min'
  const remainder = value % 60
  return Math.floor(value / 60) + ' hr' + (remainder ? ' ' + remainder + ' min' : '')
}

export function canvasEstimateLabel({ low, high }) {
  return low === high ? minutes(low) : minutes(low) + ' – ' + minutes(high)
}

export default function CanvasWorkload({ tasks, onOpenTask }) {
  const headingId = useId()
  const [showCompleted, setShowCompleted] = useState(false)
  const [limit, setLimit] = useState(20)
  const assignments = useMemo(() => tasks.filter(task => task.canvasType === 'assignment' &&
    (showCompleted || (task.status !== 'completed' && !task.canvasSubmittedAt))).sort((a, b) =>
    (a.dueDate || '9999').localeCompare(b.dueDate || '9999')), [tasks, showCompleted])
  const total = assignments.reduce((result, { canvasEstimate }) => canvasEstimate ? {
    low: result.low + canvasEstimate.low,
    high: result.high + canvasEstimate.high,
    count: result.count + 1,
  } : result, { low: 0, high: 0, count: 0 })

  return <section className="rounded-2xl border border-white/10 bg-slate-900 p-6" aria-labelledby={headingId}>
    <h2 id={headingId} className="text-xl font-semibold">Canvas assignment workload</h2>
    <p className="mt-2 text-sm text-slate-300">Sync to refresh instructions and estimates. Estimates represent focused work time and use the details available in Canvas. Linked files and external tools may add work.</p>
    <label className="mt-4 flex items-center gap-2">
      <input type="checkbox" checked={showCompleted} onChange={event => { setShowCompleted(event.target.checked); setLimit(20) }}/>
      Include completed or submitted assignments
    </label>
    {!assignments.length ? <p className="mt-4">No assignments match this view.</p> : <>
      <p className="my-4 text-sm" role="status">{total.count ? canvasEstimateLabel(total) + ' total for ' + total.count + ' estimated assignments.' : 'No time estimates available.'}
        {total.count < assignments.length && ' ' + (assignments.length - total.count) + ' without estimates.'}
      </p>
      <ul className="space-y-3">
        {assignments.slice(0, limit).map(task => <li key={task._id} className="rounded-xl border border-white/10 p-3">
          <button type="button" className="break-words text-left font-semibold underline" onClick={() => onOpenTask(task)}>{task.text}</button>
          <p className="text-sm text-slate-300">{[task.calendarContext, task.dueDate && taskDueLabel(task, true), task.canvasSubmittedAt && 'Submitted in Canvas'].filter(Boolean).join(' · ')}</p>
          <p className="mt-1 text-sm">{task.canvasEstimate ? canvasEstimateLabel(task.canvasEstimate) + '. ' + task.canvasEstimate.reason
            : task.canvasInstructions === undefined ? 'Sync Canvas to check for an estimate.'
            : 'The Canvas instructions do not provide enough detail for an estimate.'}</p>
        </li>)}
      </ul>
      {assignments.length > limit && <button type="button" className="mt-4 underline" onClick={() => setLimit(value => value + 20)}>Show more assignments</button>}
    </>}
  </section>
}
