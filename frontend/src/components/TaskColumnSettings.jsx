import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'
import { defaultTaskColumns, taskColumnNames } from '../lib/taskColumnNames'

export default function TaskColumnSettings() {
  const { user, token, updatePreferences } = useAuth()
  const saved = taskColumnNames(user?.taskColumnNames)
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const names = draft ?? saved
  const keys = Object.keys(defaultTaskColumns)
  const changed = keys.some(key => names[key].trim() !== saved[key])

  async function save(value) {
    if (lock.current) return
    lock.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskColumnNames: value }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save task column names.')
      if (data.taskColumnNames === undefined) throw new Error('Restart the updated backend and try again.')
      updatePreferences({ taskColumnNames: data.taskColumnNames })
      setDraft(null)
      setNotice(value ? 'Task column names saved.' : 'Default names restored.')
    } catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }

  return <section className="confirmation-settings" aria-label="Task column names" aria-busy={busy}>
    <h3>Task column names</h3>
    <p>Rename the columns used to organize tasks by status.</p>
    <form onSubmit={event => {
      event.preventDefault()
      if (changed && keys.every(key => names[key].trim())) save(taskColumnNames(names))
    }}>
      {keys.map(key => <label key={key}>
        <span><strong>{defaultTaskColumns[key]}</strong></span>
        <input type="text" maxLength={40} required disabled={busy} value={names[key]} onChange={event => {
          setDraft({ ...names, [key]: event.target.value })
          setNotice('')
          setError('')
        }}/>
      </label>)}
      <div className="appearance-settings-actions">
        <button type="submit" disabled={busy || !changed || keys.some(key => !names[key].trim())}>{busy ? 'Saving…' : 'Save column names'}</button>
        <button type="button" disabled={busy || (!changed && user?.taskColumnNames == null)} onClick={() => save(null)}>Restore default names</button>
      </div>
    </form>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
