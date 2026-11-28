import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'
import { featureVisible } from '../lib/featureVisibility'
import { defaultNavigationMenu, defaultNavigationPins, navigationPages } from './AppNavigation'

const defaults = { tools: true, career: true, pages: {} }

export default function NavigationMenuSettings() {
  const { user, token, updatePreferences } = useAuth()
  const saved = user?.navigationMenus ?? defaults
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const value = draft ?? saved
  const pins = user?.navigationPins ?? defaultNavigationPins
  const dirty = value.tools !== saved.tools || value.career !== saved.career ||
    navigationPages.some(([id]) => (value.pages[id] ?? defaultNavigationMenu(id)) !== (saved.pages[id] ?? defaultNavigationMenu(id)))

  function edit(next) {
    setDraft(next)
    setError('')
    setNotice('')
  }

  function changePage(id, menu) {
    const pages = { ...value.pages }
    if (menu === defaultNavigationMenu(id)) delete pages[id]
    else pages[id] = menu
    edit({ ...value, pages })
  }

  async function save(navigationMenus) {
    if (lock.current) return
    lock.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigationMenus }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save navigation menus.')
      if (data.navigationMenus === undefined) throw new Error('Restart the updated backend and try again.')
      updatePreferences({ navigationMenus: data.navigationMenus })
      setDraft(null)
      setNotice(navigationMenus ? 'Menu settings saved.' : 'Default menus restored.')
    } catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }

  return <section className="confirmation-settings navigation-settings" aria-label="Navigation menus" aria-busy={busy}>
    <h3>Navigation menus</h3>
    <p>Choose where unpinned pages appear. Pinned pages stay in the top bar, and pages left out of both menus can still open through search or a direct link.</p>
    <label><span>Show Tools menu</span><input type="checkbox" role="switch" checked={value.tools} disabled={busy} onChange={event => edit({ ...value, tools: event.target.checked })}/></label>
    <label><span>Show Career menu</span><input type="checkbox" role="switch" checked={value.career} disabled={busy} onChange={event => edit({ ...value, career: event.target.checked })}/></label>
    <details>
      <summary>Choose where pages appear</summary>
      {navigationPages.map(([id, label]) => <label key={id}>
        <span><strong>{label}</strong>{!featureVisible(user?.hiddenFeatures, id)
          ? <small>Hidden in Platform visibility</small>
          : pins.includes(id) && <small>Applies when this page is unpinned</small>}</span>
        <select value={value.pages[id] ?? defaultNavigationMenu(id)} disabled={busy} onChange={event => changePage(id, event.target.value)}>
          <option value="tools">Tools</option>
          <option value="career">Career</option>
          <option value="none">Leave out of both menus</option>
        </select>
      </label>)}
    </details>
    <div className="navigation-settings-actions">
      <button type="button" disabled={busy || !dirty} onClick={() => save(value)}>{busy ? 'Saving…' : 'Save menus'}</button>
      {dirty && <button type="button" disabled={busy} onClick={() => edit(null)}>Cancel changes</button>}
      <button type="button" disabled={busy || (!dirty && user?.navigationMenus == null)} onClick={() => save(null)}>Restore default menus</button>
    </div>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
