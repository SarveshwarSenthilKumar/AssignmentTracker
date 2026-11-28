import { useState } from 'react'
import { ArrowDown, ArrowUp, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'
import { featureVisible } from '../lib/featureVisibility'
import { defaultNavigationPins, navigationPages } from './AppNavigation'
import './NavigationSettings.css'

const labels = Object.fromEntries(navigationPages)

export default function NavigationSettings({ activeWorkspaceProfile } = {}) {
  const { user, token, updatePreferences } = useAuth()
  const saved = Array.isArray(user?.navigationPins) ? user.navigationPins : defaultNavigationPins
  const [draft, setDraft] = useState(null)
  const [chosen, setChosen] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const pins = draft ?? saved
  const available = id => featureVisible(user?.hiddenFeatures, id)
  const choices = navigationPages.filter(([id]) => available(id) && !pins.includes(id))
  const selection = choices.some(([id]) => id === chosen) ? chosen : choices[0]?.[0] || ''
  const dirty = pins.length !== saved.length || pins.some((id, index) => id !== saved[index])

  function edit(next) {
    setDraft(next)
    setStatus('')
    setError('')
  }

  function move(index, offset) {
    const next = [...pins]
    const target = index + offset
    next[index] = pins[target]
    next[target] = pins[index]
    edit(next)
  }

  async function save(value) {
    setBusy(true); setError(''); setStatus('')
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigationPins: value }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save navigation settings.')
      if (data.navigationPins !== null && !Array.isArray(data.navigationPins)) throw new Error('Restart the updated backend and try again.')
      updatePreferences({ navigationPins: data.navigationPins })
      setDraft(null)
      setStatus('Navigation saved.')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  return <section className="confirmation-settings navigation-settings" aria-label="Navigation bar">
    <h3>Navigation bar</h3>
    <p>Pin and reorder pages in the top bar. Manage unpinned pages under Navigation menus. On smaller screens, pinned pages come first in the navigation menu.</p>
    {activeWorkspaceProfile && <p>{activeWorkspaceProfile} uses its own pinned pages. Edit them under <a href="#/workspace">Workspace → Pinned pages</a>.</p>}
    <ol aria-label="Pinned pages">
      {pins.map((id, index) => <li key={id}>
        <span>{labels[id] || id}{!available(id) && <small>Hidden in Platform visibility</small>}</span>
        <div className="navigation-settings-actions">
          <button type="button" disabled={busy || index === 0} aria-label={'Move ' + labels[id] + ' up'} onClick={() => move(index, -1)}><ArrowUp size={16} aria-hidden="true"/></button>
          <button type="button" disabled={busy || index === pins.length - 1} aria-label={'Move ' + labels[id] + ' down'} onClick={() => move(index, 1)}><ArrowDown size={16} aria-hidden="true"/></button>
          <button type="button" disabled={busy} aria-label={'Unpin ' + labels[id]} onClick={() => edit(pins.filter(route => route !== id))}><X size={16} aria-hidden="true"/></button>
        </div>
      </li>)}
    </ol>
    {!pins.length && <p>No pages pinned.</p>}
    {choices.length > 0 && <div className="navigation-settings-actions">
      <select aria-label="Page to pin" value={selection} disabled={busy} onChange={event => setChosen(event.target.value)}>
        {choices.map(([id, label]) => <option value={id} key={id}>{label}</option>)}
      </select>
      <button type="button" disabled={busy} onClick={() => edit([...pins, selection])}>Pin page</button>
    </div>}
    <div className="navigation-settings-actions">
      <button type="button" disabled={busy || !dirty} onClick={() => save(pins)}>{busy ? 'Saving…' : 'Save navigation'}</button>
      {dirty && <button type="button" disabled={busy} onClick={() => edit(null)}>Cancel changes</button>}
      <button type="button" disabled={busy || (!dirty && user?.navigationPins == null)} onClick={() => save(null)}>Restore defaults</button>
    </div>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
