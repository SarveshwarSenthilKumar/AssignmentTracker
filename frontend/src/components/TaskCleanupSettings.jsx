import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'

export default function TaskCleanupSettings() {
  const { user, token, updatePreferences } = useAuth()
  const savedDays = user?.completedTaskRetentionDays || 0
  const [enabled, setEnabled] = useState(savedDays > 0)
  const [days, setDays] = useState(String(savedDays || 30))
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    setEnabled(savedDays > 0)
    setDays(String(savedDays || 30))
  }, [savedDays])

  async function save(retention) {
    if (busy) return
    setBusy(true)
    setFeedback(null)
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ completedTaskRetentionDays: retention })
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save automatic deletion settings.')
      if (data.completedTaskRetentionDays !== retention) throw new Error('Restart the updated backend before saving automatic deletion settings.')
      updatePreferences({ completedTaskRetentionDays: retention })
      setFeedback({ message: retention ? `Completed tasks will move to Recently deleted after ${retention} days.` : 'Automatic deletion is off.' })
    } catch (error) {
      setFeedback({ message: error.message, error: true })
    } finally {
      setBusy(false)
    }
  }

  return <section className="confirmation-settings" aria-label="Automatic task deletion" aria-busy={busy}>
    <h3>Automatic task deletion</h3>
    <p>Move completed tasks to Recently deleted after a set number of days. This applies to existing completed tasks too. You have seven days to restore them.</p>
    <p role="status">{savedDays ? `On · ${savedDays} ${savedDays === 1 ? 'day' : 'days'} after completion` : 'Off · Automatic deletion is disabled.'}</p>
    <form onSubmit={event => { event.preventDefault(); save(enabled ? Number(days) : 0) }}>
      <label><span>Automatically delete completed tasks</span><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)}/></label>
      {enabled && <label><span>Days after completion</span><input type="number" min="1" max="3650" step="1" required value={days} disabled={busy} onChange={event => setDays(event.target.value)}/></label>}
      <div className="calendar-detail-actions">
        <button type="submit" disabled={busy || (enabled ? Number(days) : 0) === savedDays}>{busy ? 'Saving…' : 'Save deletion settings'}</button>
        {savedDays > 0 && <button type="button" disabled={busy} onClick={() => save(0)}>Turn off automatic deletion</button>}
      </div>
    </form>
    {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </section>
}
