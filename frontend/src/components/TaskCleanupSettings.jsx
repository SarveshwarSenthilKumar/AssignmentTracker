import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'

export default function TaskCleanupSettings() {
  const { user, token, updatePreferences } = useAuth()
  const savedDays = user?.completedTaskRetentionDays || 0
  const savedRecoveryDays = user?.deletedTaskRetentionDays ?? 7
  const [enabled, setEnabled] = useState(savedDays > 0)
  const [days, setDays] = useState(String(savedDays || 30))
  const [recoveryDays, setRecoveryDays] = useState(String(savedRecoveryDays || 7))
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    setEnabled(savedDays > 0)
    setDays(String(savedDays || 30))
  }, [savedDays])
  useEffect(() => setRecoveryDays(String(savedRecoveryDays || 7)), [savedRecoveryDays])

  async function save(preferences, message) {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences)
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save automatic deletion settings.')
      if (Object.entries(preferences).some(([key, value]) => data[key] !== value)) throw new Error('Restart the updated backend before saving deletion settings.')
      updatePreferences(preferences)
      setFeedback({ message })
    } catch (error) {
      setFeedback({ message: error.message, error: true })
    } finally {
      setBusy(false)
    }
  }

  const saveCleanup = retention => save({ completedTaskRetentionDays: retention }, retention ? 'Automatic deletion settings saved.' : 'Automatic deletion is off.')

  return <section className="confirmation-settings" aria-label="Automatic task deletion" aria-busy={busy}>
    <h3>Automatic task deletion</h3>
    <p>Move completed tasks to Recently deleted after a set number of days. This applies to existing completed tasks too.</p>
    <p role="status">{savedDays ? `On · ${savedDays} ${savedDays === 1 ? 'day' : 'days'} after completion` : 'Off · Automatic deletion is disabled.'}</p>
    <form onSubmit={event => { event.preventDefault(); saveCleanup(enabled ? Number(days) : 0) }}>
      <label><span>Automatically delete completed tasks</span><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)}/></label>
      {enabled && <label><span>Days after completion</span><input type="number" min="1" max="3650" step="1" required value={days} disabled={busy} onChange={event => setDays(event.target.value)}/></label>}
      <div className="calendar-detail-actions">
        <button type="submit" disabled={busy || (enabled ? Number(days) : 0) === savedDays}>{busy ? 'Saving…' : 'Save deletion settings'}</button>
        {savedDays > 0 && <button type="button" disabled={busy} onClick={() => saveCleanup(0)}>Turn off automatic deletion</button>}
      </div>
    </form>
    <h3>Recently deleted recovery period</h3>
    <p>Choose how long new deletions can be restored. Items already in Recently deleted keep the expiry date shown there. You can permanently delete them sooner from that view.</p>
    <p role="status">{savedRecoveryDays ? `Automatic expiry is on · ${savedRecoveryDays} ${savedRecoveryDays === 1 ? 'day' : 'days'}` : 'Automatic expiry is off. New deletions have no expiry.'}</p>
    <form onSubmit={event => {
      event.preventDefault()
      save({ deletedTaskRetentionDays: Number(recoveryDays) }, 'Recovery period saved for new deletions.')
    }}>
      <label><span>Days to keep deleted tasks</span><input type="number" min="1" max="90" step="1" required value={recoveryDays} disabled={busy} onChange={event => setRecoveryDays(event.target.value)}/></label>
      <div className="calendar-detail-actions">
        <button type="submit" disabled={busy || Number(recoveryDays) === savedRecoveryDays}>{savedRecoveryDays ? 'Save recovery period' : 'Turn on automatic expiry'}</button>
        {savedRecoveryDays > 0 && <button type="button" disabled={busy} onClick={() => save({ deletedTaskRetentionDays: 0 }, 'Automatic expiry is off for new deletions.')}>Turn off automatic expiry</button>}
      </div>
    </form>
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </section>
}
