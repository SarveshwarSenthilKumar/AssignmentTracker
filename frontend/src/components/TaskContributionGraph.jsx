import { useId, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import './TaskContributionGraph.css'

const dayMs = 86400000
const dateLabel = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' })
const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })
const dateOf = day => new Date(day * dayMs)

export default function TaskContributionGraph({ today, days }) {
  const [selected, setSelected] = useState(today)
  const [collapsed, setCollapsed] = useState(false)
  const [range, setRange] = useState(365)
  const contentId = useId()
  const scroller = useRef(null)
  const first = today - range + 1
  const start = first - dateOf(first).getUTCDay()
  const columns = Math.ceil((today - start + 1) / 7)
  const active = Math.max(first, Math.min(today, selected))
  const completions = day => days.get(day)?.completed.length ?? 0
  const activity = day => completions(day) + (days.get(day)?.progress.length ?? 0)
  const describe = day => `${dateLabel.format(dateOf(day))}, ${completions(day)} completed, ${activity(day) - completions(day)} with progress logged`
  const total = Array.from({ length: range }, (_, index) => activity(first + index)).reduce((sum, count) => sum + count, 0)
  const details = days.get(active)

  useLayoutEffect(() => {
    const element = scroller.current
    if (element) element.scrollLeft = element.scrollWidth
  }, [collapsed, range])

  return <section className="task-contributions" aria-label="Task contributions">
    <header>
      <div><h3>Task contributions</h3><p>{total} {total === 1 ? 'contribution' : 'contributions'} in the last {range} days</p></div>
      <div className="task-contribution-controls">
      <label>Time range
        <select className="task-contribution-toggle" value={range} onChange={event => {
          const next = Number(event.target.value)
          setRange(next)
          if (selected < today - next + 1) setSelected(today)
        }}>
          {[30, 90, 180, 365].map(days => <option key={days} value={days}>Last {days} days</option>)}
        </select>
      </label>
      <button type="button" className="task-contribution-toggle" aria-expanded={!collapsed} aria-controls={contentId} onClick={() => setCollapsed(previous => !previous)}>
        {collapsed ? <ChevronDown size={16} aria-hidden="true"/> : <ChevronUp size={16} aria-hidden="true"/>}
        {collapsed ? 'Expand graph' : 'Collapse graph'}
      </button>
      </div>
    </header>
    <div id={contentId} hidden={collapsed} className="task-contribution-content" data-short-range={range <= 90}>
    <div className="task-contribution-chart">
    <div className="task-contribution-scroll" ref={scroller}>
      <div className="task-contribution-grid" style={{ '--task-weeks': columns }}>
        {Array.from({ length: columns }, (_, week) => {
          const day = start + week * 7
          const monthStart = Array.from({ length: 7 }, (_, index) => day + index).find(value => value >= first && value <= today && dateOf(value).getUTCDate() === 1)
          return monthStart !== undefined && <span key={week} className="task-contribution-month" style={{ gridColumn: week + 2 }}>{monthLabel.format(dateOf(monthStart))}</span>
        })}
        {['Mon', 'Wed', 'Fri'].map((label, index) => <span key={label} className="task-contribution-weekday" style={{ gridRow: index * 2 + 3 }}>{label}</span>)}
        {Array.from({ length: range }, (_, index) => {
          const day = first + index
          const offset = day - start
          return <button key={day} type="button" className="task-contribution-cell"
            style={{ gridColumn: Math.floor(offset / 7) + 2, gridRow: offset % 7 + 2 }}
            data-day={day} data-level={Math.min(4, activity(day))}
            aria-label={describe(day)} title={describe(day)} aria-pressed={active === day}
            aria-current={day === today ? 'date' : undefined} tabIndex={active === day ? 0 : -1}
            onClick={() => setSelected(day)} onKeyDown={event => {
              const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[event.key]
              if (!step) return
              event.preventDefault()
              const next = Math.max(first, Math.min(today, day + step))
              setSelected(next)
              scroller.current.querySelector(`[data-day="${next}"]`)?.focus()
            }}/>
        })}
      </div>
    </div>
    <div className="task-contribution-legend" aria-label="Color scale from less to more activity">
      Less {[0, 1, 2, 3, 4].map(level => <span key={level} className="task-contribution-cell" data-level={level} aria-hidden="true"/>)} More
    </div>
    </div>
    <div className="task-contribution-details" aria-live="polite">
      <strong>{dateLabel.format(dateOf(active))}</strong>
      {!details && <p>No activity logged.</p>}
      {[['Completed tasks', details?.completed], ['Progress logged', details?.progress]].map(([label, titles]) => titles?.length > 0 &&
        <div key={label}><p>{label}</p><ul>{titles.map((title, index) => <li key={index}>{title}</li>)}</ul></div>)}
    </div>
    </div>
  </section>
}
