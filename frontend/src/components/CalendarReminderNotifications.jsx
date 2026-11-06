import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { activeTimeZone, localToInstant } from '../lib/timeZone'
import './CalendarReminderNotifications.css'

function startTime(entry) {
  try {
    return Date.parse(entry.allDay ? localToInstant(`${entry.startDate}T09:00`) : entry.startAt)
  } catch {
    return NaN
  }
}

export default function CalendarReminderNotifications({ token, userId, onOpen }) {
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (!token || !userId) return
    const storageKey = `calendar-reminders-seen:${userId}`
    const seen = new Map()
    let entries = [], request
    const loadSeen = () => {
      try {
        for (const [key, expiry] of JSON.parse(localStorage.getItem(storageKey) || '[]')) {
          if (expiry > Date.now()) seen.set(key, expiry)
        }
      } catch {}
    }
    const check = () => {
      const now = Date.now()
      const due = []
      loadSeen()
      for (const [key, expiry] of seen) if (expiry <= now) seen.delete(key)
      for (const entry of entries) {
        const start = startTime(entry)
        const trigger = start - entry.reminderMinutes * 60000
        const expiry = start + 10 * 60000
        const key = `${entry._id}:${start}:${entry.reminderMinutes}`
        if (!Number.isFinite(start) || now < trigger || now > expiry || seen.has(key)) continue
        seen.set(key, expiry)
        due.push({ ...entry, key, start })
      }
      if (!due.length) return
      try { localStorage.setItem(storageKey, JSON.stringify([...seen])) } catch {}
      setNotifications(previous => [...previous, ...due])
    }
    const refresh = async () => {
      request?.abort()
      const controller = new AbortController()
      request = controller
      try {
        const response = await fetch('/api/calendar-reminders', {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal
        })
        if (!response.ok) return
        const data = await response.json()
        if (controller.signal.aborted || !Array.isArray(data)) return
        entries = data
        const keys = new Set(entries.map(entry => `${entry._id}:${startTime(entry)}:${entry.reminderMinutes}`))
        setNotifications(previous => previous.filter(notification => keys.has(notification.key)))
        check()
      } catch {}
    }
    refresh()
    const refreshTimer = setInterval(refresh, 60000)
    const checkTimer = setInterval(check, 5000)
    window.addEventListener('focus', refresh)
    window.addEventListener('calendar-changed', refresh)
    window.addEventListener('workspace-reset', refresh)
    return () => {
      request?.abort()
      clearInterval(refreshTimer)
      clearInterval(checkTimer)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('calendar-changed', refresh)
      window.removeEventListener('workspace-reset', refresh)
    }
  }, [token, userId])

  const dismiss = key => setNotifications(previous => previous.filter(notification => notification.key !== key))
  if (!notifications.length) return null
  return <aside className="calendar-reminder-stack" aria-label="Calendar reminders" aria-live="polite">
    {notifications.map(notification => <section className="calendar-reminder-toast" key={notification.key}>
      <Bell size={18} aria-hidden="true"/>
      <div>
        <strong>{notification.title}</strong>
        <p>{notification.allDay ? 'All-day event' : new Date(notification.start).toLocaleString(undefined, { timeZone: activeTimeZone(), dateStyle: 'medium', timeStyle: 'short' })}</p>
        {onOpen && <button type="button" onClick={() => { dismiss(notification.key); onOpen(notification._id) }}>Open event</button>}
      </div>
      <button type="button" aria-label={`Dismiss reminder for ${notification.title}`} onClick={() => dismiss(notification.key)}><X size={17}/></button>
    </section>)}
  </aside>
}
