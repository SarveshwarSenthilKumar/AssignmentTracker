import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, X } from 'lucide-react'
import { tutorialWelcomeDuration } from '../lib/platformTutorialContent'
import './TutorialWelcomeBanner.css'

function wasDismissed(key) {
  try { return localStorage.getItem(key) === '1' } catch { return false }
}

export default function TutorialWelcomeBanner({ userId, createdAt, page }) {
  const key = 'tutorial-welcome:' + userId
  const [dismissed, setDismissed] = useState(() => wasDismissed(key))
  const [now, setNow] = useState(Date.now)
  const created = Date.parse(createdAt)
  const expires = created + tutorialWelcomeDuration

  useEffect(() => {
    const remaining = expires - Date.now()
    if (dismissed || !Number.isFinite(remaining) || remaining <= 0) return
    const timer = setTimeout(() => setNow(Date.now()), Math.min(remaining, tutorialWelcomeDuration))
    return () => clearTimeout(timer)
  }, [dismissed, expires])

  useEffect(() => {
    const sync = event => {
      if (event.key === key && event.newValue === '1') setDismissed(true)
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key])

  useEffect(() => {
    if (page !== 'tutorial' || dismissed) return
    try { localStorage.setItem(key, '1') } catch {}
    setDismissed(true)
  }, [page, dismissed, key])

  if (!userId || dismissed || page === 'tutorial' || !Number.isFinite(created) || now < created || now >= expires) return null

  return <aside className="tutorial-welcome-banner" aria-label="Welcome to Assignment Tracker">
    <BookOpen size={21} aria-hidden="true"/>
    <div><strong>New to Assignment Tracker?</strong><p>Take the tutorial to learn how to plan tasks, edit PDFs, and set up your workspace.</p></div>
    <a href="#/tutorial">Open tutorial<ArrowRight size={16} aria-hidden="true"/></a>
    <button type="button" aria-label="Dismiss tutorial banner" onClick={() => {
      try { localStorage.setItem(key, '1') } catch {}
      setDismissed(true)
    }}><X size={17} aria-hidden="true"/></button>
  </aside>
}
