import { useEffect, useMemo, useState } from 'react'

const DAY_MS = 86400000

function localDay(value) {
  const date = new Date(value)
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

export default function TaskStreaks({ tasks }) {
  const [today, setToday] = useState(() => localDay(Date.now()))
  useEffect(() => {
    const update = () => setToday(localDay(Date.now()))
    const timer = setInterval(update, 30000)
    window.addEventListener('focus', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
    }
  }, [])

  const { current, longest, activeToday } = useMemo(() => {
    const days = new Set()
    const add = day => {
      if (Number.isFinite(day) && day <= today) days.add(day)
    }
    for (const task of tasks) {
      if (task.canvasType === 'calendar_event') continue
      if (task.status === 'completed' && task.completedAt) add(localDay(task.completedAt))
      for (const log of task.progressLogs || []) add(Date.parse(`${log.day}T00:00:00Z`) / DAY_MS)
    }
    let run = 0, longest = 0, previous = -Infinity
    for (const day of [...days].sort((a, b) => a - b)) {
      run = day === previous + 1 ? run + 1 : 1
      longest = Math.max(longest, run)
      previous = day
    }
    return { current: previous >= today - 1 ? run : 0, longest, activeToday: days.has(today) }
  }, [tasks, today])

  return <section aria-label="Task streaks" className="mb-4 rounded-xl border border-white/10 bg-slate-900/70 p-4">
    <h2 className="font-semibold">Task streaks</h2>
    <dl className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
      <div><dt className="text-sm text-slate-400">Current streak</dt><dd className="text-lg font-semibold">{current} {current === 1 ? 'day' : 'days'}</dd></div>
      <div><dt className="text-sm text-slate-400">Longest streak</dt><dd className="text-lg font-semibold">{longest} {longest === 1 ? 'day' : 'days'}</dd></div>
    </dl>
    <p className="mt-2 text-sm text-slate-400">{activeToday ? 'Today counts toward your streak.' : 'Complete a task or log progress to count today.'} Streaks use your local calendar days and saved task history.</p>
  </section>
}
