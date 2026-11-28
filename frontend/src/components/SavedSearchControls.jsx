import { useEffect, useRef, useState } from 'react'
import { Bookmark, Pin, PinOff, Trash2 } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'

const path = '/api/account/saved-searches'
async function request(token, { id, method = 'GET', body, signal } = {}) {
  const response = await fetch(path + (id ? '/' + id : ''), {
    method, signal, cache: 'no-store',
    headers: { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': 'application/json' }) },
    ...(body && { body: JSON.stringify(body) }),
  })
  if (response.status === 204) return null
  const data = await readApiJson(response)
  if (!response.ok) throw new Error(data.message || 'Could not manage saved searches.')
  return data
}

export default function SavedSearchControls({ token, search, canSave, onUse, scopeAvailable, scopes }) {
  const [searches, setSearches] = useState(null)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [name, setName] = useState('')
  const [pinned, setPinned] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const running = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    request(token, { signal: controller.signal }).then(items => {
      if (!controller.signal.aborted) setSearches(items)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    })
    return () => controller.abort()
  }, [token])

  async function change(method, item) {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const body = method === 'POST' ? { ...search, name: name.trim(), pinned }
        : method === 'PATCH' ? { pinned: !item.pinned } : undefined
      const result = await request(token, { id: item?.id, method, body })
      setSearches(previous => method === 'POST' ? [...previous, result]
        : method === 'PATCH' ? previous.map(saved => saved.id === item.id ? { ...saved, pinned: result.pinned } : saved)
          : previous.filter(saved => saved.id !== item.id))
      if (method === 'POST') setEditing(false)
      setConfirm(null)
      setNotice(method === 'POST' ? 'Search saved.' : method === 'DELETE' ? 'Saved search removed.' : result.pinned ? 'Search pinned.' : 'Search unpinned.')
    } catch (failure) { setError(failure.message) }
    finally { running.current = false; setBusy(false) }
  }

  const visible = (searches || []).filter(item => scopeAvailable(item.scope))
  const pins = visible.filter(item => item.pinned)
  const use = item => { setEditing(false); setConfirm(null); setNotice(''); setError(''); onUse(item) }

  return <section className="global-saved-searches" aria-label="Saved searches">
    <div className="global-saved-actions">
      {pins.map(item => <button key={item.id} type="button" className="global-search-pin" disabled={busy} onClick={() => use(item)} title={item.name}>
        <Pin size={13} aria-hidden="true"/>{item.name}
      </button>)}
      <button type="button" disabled={!searches || !canSave || busy || searches.length >= 40} aria-expanded={editing} onClick={() => {
        setEditing(value => !value); setName(search.query.trim().slice(0, 80)); setPinned(true); setError(''); setNotice('')
      }}><Bookmark size={14} aria-hidden="true"/>Save search</button>
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>Saved searches</button>
    </div>
    {editing && <form className="global-saved-actions" onSubmit={event => { event.preventDefault(); change('POST') }}>
      <label>Search name<input required maxLength={80} placeholder="Overdue labs" value={name} disabled={busy}
        onChange={event => setName(event.target.value)} autoFocus onFocus={event => event.currentTarget.select()}/></label>
      <label><input type="checkbox" checked={pinned} disabled={busy} onChange={event => setPinned(event.target.checked)}/>Pin search</label>
      <button type="submit" disabled={!name.trim() || !canSave || busy}>{busy ? 'Saving…' : 'Save'}</button>
      <button type="button" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
    </form>}
    {expanded && <ul className="global-saved-list">
      {visible.length ? visible.map(item => <li key={item.id}>
        <button className="global-saved-run" type="button" disabled={busy} onClick={() => use(item)}>{item.name}
          <small>{scopes[item.scope]}{item.overdue ? ' · Overdue' : ''}{item.trash ? ' · Include Trash' : ''}</small></button>
        <button type="button" disabled={busy} onClick={() => change('PATCH', item)}
          aria-label={(item.pinned ? 'Unpin ' : 'Pin ') + item.name}>{item.pinned ? <PinOff size={14}/> : <Pin size={14}/>}</button>
        <button type="button" disabled={busy} onClick={() => setConfirm(item)} aria-label={'Remove saved search ' + item.name}><Trash2 size={14}/></button>
      </li>) : <li>{searches ? 'No saved searches yet.' : 'Loading saved searches…'}</li>}
    </ul>}
    {confirm && <div className="global-saved-actions"><span>Remove “{confirm.name}”?</span>
      <button type="button" disabled={busy} onClick={() => change('DELETE', confirm)}>Remove search</button>
      <button type="button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
    </div>}
    {error && <p role="alert" className="global-search-error">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </section>
}
