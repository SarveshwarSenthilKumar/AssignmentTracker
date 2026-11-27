import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'
import { featureVisible } from '../lib/featureVisibility'
import { navigationPages } from './AppNavigation'
import './SectionNewTabSettings.css'

const sectionPages = [...navigationPages, ['account', 'Account settings']]
const sectionLabels = Object.fromEntries(sectionPages)

export function SectionNewTabButton({ page, enabled }) {
  if (!enabled?.includes(page) || !sectionLabels[page]) return null
  const hash = window.location.hash
  const currentPage = hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  return <a className="section-new-tab-button" href={currentPage === page ? hash : '#/' + page}
    target="_blank" rel="noopener noreferrer" aria-label={'Open ' + sectionLabels[page] + ' in a new tab'}>
    <ArrowUpRight size={16} aria-hidden="true" />Open in new tab
  </a>
}

export default function SectionNewTabSettings() {
  const { user, token, updatePreferences } = useAuth()
  const saved = user?.navigationNewTabs || []
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const selected = draft ?? saved
  const dirty = selected.length !== saved.length || selected.some(id => !saved.includes(id))

  async function save() {
    setBusy(true); setError(''); setStatus('')
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigationNewTabs: selected }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save new-tab buttons.')
      if (!Array.isArray(data.navigationNewTabs)) throw new Error('Restart the updated backend and try again.')
      updatePreferences({ navigationNewTabs: data.navigationNewTabs })
      setDraft(null)
      setStatus('Page buttons saved.')
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  return <section className="confirmation-settings" aria-label="Page new-tab buttons">
    <h3>Page new-tab buttons</h3>
    <p>Choose which pages show an Open in new tab button in their header.</p>
    <details>
      <summary>Choose pages</summary>
      {sectionPages.map(([id, label]) => <label key={id}>
        <span>{label}{!featureVisible(user?.hiddenFeatures, id) && <small>Hidden in Platform visibility</small>}</span>
        <input type="checkbox" role="switch" checked={selected.includes(id)} disabled={busy} onChange={event => {
          setDraft(event.target.checked ? [...selected, id] : selected.filter(route => route !== id))
          setError(''); setStatus('')
        }}/>
      </label>)}
    </details>
    <div className="navigation-settings-actions">
      <button type="button" disabled={busy || !dirty} onClick={save}>{busy ? 'Saving…' : 'Save page buttons'}</button>
      {dirty && <button type="button" disabled={busy} onClick={() => { setDraft(null); setError('') }}>Cancel changes</button>}
    </div>
    {status && <p role="status">{status}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
