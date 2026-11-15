import { createContext, useContext, useEffect, useLayoutEffect, useState } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'

const SectionLockContext = createContext(null)
const sections = [
  ['home', 'Home'], ['workspace', 'Workspace'], ['tasks', 'Tasks'], ['calendar', 'Calendar'],
  ['documents', 'Documents'], ['prep', 'Prep'], ['resumes', 'Resumes'], ['cover-letters', 'Cover letters'],
  ['jobs', 'Saved jobs'], ['study', 'Question bank'], ['assistant', 'AI assistant'],
  ['visualization', 'Visualization'], ['canvas', 'Canvas'], ['analytics', 'Analytics'],
  ['shortcuts', 'Keyboard shortcuts'], ['roadmap', 'Site roadmap'], ['report-bug', 'Report a bug'],
  ['suggest-feature', 'Feature suggestions'], ['handbook', 'Product handbook'], ['logbook', 'Update logbook'],
  ['account', 'Account settings'], ['admin', 'Admin portal']
]

export function SectionLockSettings() {
  const { locks, selectSection, busy, passwordMode, selectPasswordMode } = useContext(SectionLockContext)
  return <section className="confirmation-settings">
    <h3>Section locks</h3>
    <p>Choose which pages require a password. Confirm changes with your account password.</p>
    <label><span><strong>Password for locked sections</strong><small>Applies to all locked sections.</small></span>
      <select value={passwordMode} disabled={busy} onChange={event => selectPasswordMode(event.target.value)}>
        <option value="account">Account password</option>
        <option value="custom">Custom password</option>
      </select>
    </label>
    {passwordMode === 'custom' && <button type="button" disabled={busy} onClick={() => selectPasswordMode('custom')}>Change custom password</button>}
    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {sections.map(([id, label]) => {
        const locked = locks.includes(id)
        return <label key={id}><span>{label}</span><input type="checkbox" role="switch" checked={locked} disabled={busy} onChange={() => selectSection(id, label, locked)}/></label>
      })}
    </div>
  </section>
}

export default function SectionLock({ section, token, children }) {
  const [locks, setLocks] = useState(null)
  const [unlocked, setUnlocked] = useState(false)
  const [action, setAction] = useState(null)
  const [target, setTarget] = useState(null)
  const [password, setPassword] = useState('')
  const [passwordMode, setPasswordMode] = useState('account')
  const [customPassword, setCustomPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const locked = locks?.includes(section)
  const blocked = locked && unlocked !== section
  const headers = { Authorization: `Bearer ${token}` }

  useLayoutEffect(() => {
    setUnlocked(false)
    setAction(null)
    setTarget(null)
    setPassword('')
    setCustomPassword('')
    setError('')
  }, [section])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/account/section-locks', { headers, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const data = await readApiJson(response)
        if (!response.ok || !Array.isArray(data.lockedSections)) throw new Error(data.message || 'Could not load section locks.')
        if (!controller.signal.aborted) {
          setLocks(data.lockedSections)
          setPasswordMode(data.passwordMode === 'custom' ? 'custom' : 'account')
        }
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [token, reload])

  async function submit(event) {
    event.preventDefault()
    if (busy) return
    const next = blocked ? 'unlock' : action
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/account/section-locks', {
        method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: target?.id || section, action: next, password, ...(next === 'use-custom' ? { customPassword } : {}) })
      })
      const data = await readApiJson(response)
      if (!response.ok || !Array.isArray(data.lockedSections)) throw new Error(data.message || 'Could not update the section lock.')
      setLocks(data.lockedSections)
      setPasswordMode(data.passwordMode === 'custom' ? 'custom' : 'account')
      if (!next.startsWith('use-') && (!target || target.id === section)) setUnlocked(next === 'unlock' ? section : false)
      setAction(null)
      setTarget(null)
    } catch (error) {
      setError(error.message)
    } finally {
      setPassword('')
      setCustomPassword('')
      setBusy(false)
    }
  }

  const control = 'rounded-lg border border-[var(--border-strong)] bg-[var(--surface-input)] px-3 py-2 text-sm'
  if (!locks) return <section className="py-4">
    {error ? <><p role="alert">{error}</p><button type="button" className={control} onClick={() => { setError(''); setReload(value => value + 1) }}>Retry</button></> : <p role="status">Loading section access…</p>}
  </section>

  const selectSection = (id, label, isLocked) => {
    setTarget({ id, label })
    setError('')
    setPassword('')
    setCustomPassword('')
    setAction(isLocked ? 'remove' : 'lock')
  }
  const selectPasswordMode = mode => {
    setTarget(null)
    setError('')
    setPassword('')
    setCustomPassword('')
    setAction(mode === 'custom' ? 'use-custom' : 'use-account')
  }
  return <SectionLockContext.Provider value={{ locks, selectSection, busy, passwordMode, selectPasswordMode }}>
    <section aria-label="Section lock" className="mb-4">
      {!blocked && !action && <div className="flex flex-wrap justify-end gap-2">
        {locked && <button type="button" className={control} onClick={() => setUnlocked(false)}>Lock now</button>}
        <button type="button" className={`${control} inline-flex items-center gap-2`} onClick={() => setAction(locked ? 'remove' : 'lock')}>
          {locked ? <Unlock size={15} aria-hidden="true"/> : <Lock size={15} aria-hidden="true"/>}
          {locked ? 'Remove section lock' : 'Lock this section'}
        </button>
      </div>}
      {(blocked || action) && <form onSubmit={submit} className="mx-auto grid max-w-md gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-panel)] p-5">
        <h2 className="font-semibold">{blocked ? 'This section is locked' : action === 'use-custom' ? 'Set a custom section-lock password' : action === 'use-account' ? 'Use your account password for section locks' : target ? `${action === 'lock' ? 'Lock' : 'Unlock'} ${target.label}` : action === 'lock' ? 'Lock this section' : 'Remove section lock'}</h2>
        <label className="grid gap-2 text-sm">{blocked && passwordMode === 'custom' ? 'Custom section-lock password' : 'Account password'}
          <input key={target?.id || section} autoFocus className={control} type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)}/>
        </label>
        {!blocked && action === 'use-custom' && <label className="grid gap-2 text-sm">New custom password
          <input className={control} type="password" autoComplete="new-password" required minLength={8} maxLength={72} value={customPassword} onChange={event => setCustomPassword(event.target.value)}/>
          <small>Use at least 8 characters.</small>
        </label>}
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className={control} type="submit" disabled={busy || !password}>{blocked ? 'Unlock section' : action.startsWith('use-') ? 'Save password choice' : action === 'lock' ? 'Lock section' : 'Remove lock'}</button>
          {!blocked && <button className={control} type="button" disabled={busy} onClick={() => { setAction(null); setTarget(null); setPassword(''); setCustomPassword(''); setError('') }}>Cancel</button>}
        </div>
      </form>}
    </section>
    {!blocked && children}
  </SectionLockContext.Provider>
}
