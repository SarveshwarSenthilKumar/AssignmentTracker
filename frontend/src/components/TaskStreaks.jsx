import { useEffect, useId, useMemo, useState } from 'react'
import { Check, Flame, Target, Trophy } from 'lucide-react'
import './TaskStreaks.css'

const DAY_MS = 86400000
const milestones = [3, 7, 14, 30, 60, 100, 365]
const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short', timeZone: 'UTC' })
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeZone: 'UTC' })

function localDay(value) {
  const date = new Date(value)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

export default function TaskStreaks({ tasks }) {
  const [today, setToday] = useState(() => localDay(Date.now()))
  const [pinnedDay, setPinnedDay] = useState(null)
  const detailsId = useId()
  useEffect(() => {
    const update = () => setToday(localDay(Date.now()))
    const timer = setInterval(update, 30000)
    window.addEventListener('focus', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])

  const { current, longest, days } = useMemo(() => {
    const days = new Map()
    const add = (day, type, title) => {
      if (!Number.isFinite(day) || day > today) return
      if (!days.has(day)) days.set(day, { completed: [], progress: [] })
      days.get(day)[type].push(title)
    }
    for (const task of tasks) {
      if (task.canvasType === 'calendar_event') continue
      if (task.status === 'completed' && task.completedAt) add(localDay(task.completedAt), 'completed', task.text)
      const loggedDays = new Set((task.progressLogs || []).map(log => Date.parse(`${log.day}T00:00:00Z`) / DAY_MS))
      for (const day of loggedDays) add(day, 'progress', task.text)
    }
    let run = 0, longest = 0, previous = -Infinity
    for (const day of [...days.keys()].sort((a, b) => a - b)) {
      run = day === previous + 1 ? run + 1 : 1
      longest = Math.max(longest, run)
      previous = day
    }
    return { current: previous >= today - 1 ? run : 0, longest, days }
  }, [tasks, today])

  const activeToday = days.has(today)
  const week = Array.from({ length: 7 }, (_, index) => today - 6 + index)
  const activeThisWeek = week.filter(day => days.has(day)).length
  const next = milestones.find(goal => goal > current) || (Math.floor(current / 100) + 1) * 100

  return <section className="task-streak-card" aria-label="Task streaks">
    <div className="task-streak-overview">
      <div className="task-streak-flame" data-active={activeToday}><Flame size={24} aria-hidden="true"/></div>
      <div>
        <h2>Task streak</h2>
        <div className="task-streak-count"><strong>{current}</strong> {current === 1 ? 'day' : 'days'} in a row</div>
      </div>
      <span className="task-streak-best"><Trophy size={15} aria-hidden="true"/> Best {longest} {longest === 1 ? 'day' : 'days'}</span>
    </div>
    <div className="task-streak-status" data-active={activeToday} aria-live="polite">
      {activeToday ? <Check size={17} aria-hidden="true"/> : <Target size={17} aria-hidden="true"/>}
      <span>{activeToday ? 'Today is checked off. Nice work!' : current ? 'Complete a task or log progress today to keep your streak going.' : 'Complete a task or log progress today to start a streak.'}</span>
    </div>
    <div className="task-streak-week">
      <div className="task-streak-label"><h3>Last 7 days</h3><span>{activeThisWeek} active</span></div>
      <ol onKeyDown={event => { if (event.key === 'Escape') { setPinnedDay(null); event.target.blur() } }}>{week.map(day => {
        const date = new Date(day * DAY_MS)
        const activity = days.get(day)
        const id = `${detailsId}-${day}`
        return <li key={day} data-active={!!activity} data-pinned={pinnedDay === day}>
          <button type="button" className="task-streak-day" aria-label={fullDate.format(date)} aria-current={day === today ? 'date' : undefined} aria-describedby={id} aria-pressed={pinnedDay === day} onClick={() => setPinnedDay(previous => previous === day ? null : day)}>
            <span>{day === today ? 'Today' : weekday.format(date)}</span>
            <span className="task-streak-day-mark">{activity ? <Check size={18} aria-hidden="true"/> : <span aria-hidden="true">·</span>}</span>
          </button>
          <div className="task-streak-day-detail" id={id}>
            <strong>{fullDate.format(date)}</strong>
            {activity ? <>
              {activity.completed.length > 0 && <><p>Completed tasks</p><ul>{activity.completed.map((title, index) => <li key={index}>{title}</li>)}</ul></>}
              {activity.progress.length > 0 && <><p>Progress logged</p><ul>{activity.progress.map((title, index) => <li key={index}>{title}</li>)}</ul></>}
            </> : <p>No activity logged.</p>}
          </div>
        </li>
      })}</ol>
    </div>
    <div className="task-streak-milestone">
      <div className="task-streak-label"><h3>Next milestone</h3><span>{current} of {next} days</span></div>
      <progress value={current} max={next} aria-label={`Progress toward a ${next}-day streak`}/>
      <ul aria-label="Streak milestones">{milestones.map(goal => <li key={goal} data-earned={longest >= goal}>{longest >= goal && <Check size={12} aria-label="Earned"/>}{goal} days</li>)}</ul>
    </div>
  </section>
}
