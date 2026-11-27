import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'
import { visibilityGroups } from '../lib/featureVisibility'

export default function FeatureVisibilitySettings({ isAdmin, onSaved }) {
  const { token, user, updatePreferences } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const hidden = user?.hiddenFeatures || []

  async function save(hiddenFeatures) {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiddenFeatures }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save section visibility.')
      if (!Array.isArray(data.hiddenFeatures)) throw new Error('Restart the updated backend and try again.')
      onSaved?.()
      updatePreferences({ hiddenFeatures: data.hiddenFeatures })
    } catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }

  return <section className="confirmation-settings" id="feature-visibility" aria-label="Platform visibility" aria-busy={busy}>
    <h3>Platform visibility</h3>
    <p>Choose which pages and tools are available in your account. You can restore them here anytime. Your data stays saved.</p>
    {visibilityGroups.map(([group, features]) => <details key={group}>
      <summary>{group}</summary>
      {features.filter(([id]) => id !== 'admin' || isAdmin).map(([id, label]) => <label key={id}>
        <span><strong>{label}</strong>{id === 'whiteboards' && <small>Requires Documents and editors.</small>}</span>
        <input type="checkbox" role="switch" checked={!hidden.includes(id)} disabled={busy} onChange={event => save(
          event.target.checked ? hidden.filter(value => value !== id) : [...hidden, id]
        )} />
      </label>)}
    </details>)}
    <button type="button" disabled={busy || !hidden.length} onClick={() => save([])}>Restore all sections</button>
    {busy && <p role="status">Saving visibility settings…</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
