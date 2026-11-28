import { useEffect, useId, useRef, useState } from 'react'
import { Link2, Plus } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'

const empty = { id: '', label: '', role: 'view', shareMessage: '', expiry: '', useExpiry: false }
const localTime = value => {
  if (!value) return ''
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}
const draftFor = link => ({ ...link, expiry: localTime(link.expiresAt), useExpiry: !!link.expiresAt })

export default function DocumentAudienceLinks({ documentId, token, onBusy }) {
  const [links, setLinks] = useState(null)
  const [draft, setDraft] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const pending = useRef(false)
  const linkInput = useRef(null)
  const title = useId()
  const endpoint = '/api/pdfs/' + documentId + '/audience-links'
  const selected = links?.find(link => link.id === draft?.id)
  const expired = selected?.expiresAt && Date.parse(selected.expiresAt) <= Date.now()
  const href = selected?.path ? new URL(selected.path, window.location.href).href : ''

  async function request(method, id, body, signal) {
    const response = await fetch(endpoint + (id ? '/' + id : ''), {
      method, signal, cache: 'no-store',
      headers: { Authorization: 'Bearer ' + token, ...(body && { 'Content-Type': 'application/json' }) },
      ...(body && { body: JSON.stringify(body) }),
    })
    if (response.status === 204) return null
    const data = await readApiJson(response)
    if (!response.ok) throw new Error(data.message || 'Could not manage audience links.')
    return data
  }

  useEffect(() => {
    const controller = new AbortController()
    request('GET', '', null, controller.signal).then(items => {
      if (!controller.signal.aborted) setLinks(items)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    })
    return () => controller.abort()
  }, [endpoint, token])

  const edit = next => {
    setDraft(next)
    setConfirm(false)
    setNotice('')
    setError('')
  }
  const change = fields => setDraft(previous => ({ ...previous, ...fields }))

  async function save(method) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    onBusy?.(true)
    setError('')
    setNotice('')
    try {
      let body
      if (method !== 'DELETE') {
        if (draft.useExpiry && !(Date.parse(draft.expiry) > Date.now())) throw new Error('Choose a future expiration date and time.')
        body = { label: draft.label, role: draft.role, shareMessage: draft.shareMessage,
          expiresAt: draft.useExpiry ? new Date(draft.expiry).toISOString() : null }
      }
      const result = await request(method, draft.id, body)
      setLinks(items => method === 'POST' ? [...items, result]
        : method === 'PUT' ? items.map(link => link.id === result.id ? result : link)
          : items.filter(link => link.id !== draft.id))
      setDraft(result ? draftFor(result) : null)
      setConfirm(false)
      setNotice(method === 'POST' ? 'Audience link created.' : method === 'PUT' ? 'Audience link updated.' : 'Audience link revoked.')
    } catch (failure) { setError(failure.message) }
    finally { pending.current = false; setBusy(false); onBusy?.(false) }
  }

  return <section className="document-audience-links" aria-labelledby={title}>
    <h4 id={title}>Audience links</h4>
    <p>Give each group its own link. Anyone with that link can use its saved permissions.</p>
    {!links && !error && <p role="status">Loading audience links…</p>}
    {links && <div className="library-sharing-actions">
      {links.map(link => <button key={link.id} type="button" aria-pressed={link.id === draft?.id} disabled={busy}
        onClick={() => edit(draftFor(link))}>{link.label} · {link.expiresAt && Date.parse(link.expiresAt) <= Date.now() ? 'Expired' : link.role === 'edit' ? 'Editor' : 'Viewer'}</button>)}
      <button type="button" disabled={busy || links.length >= 24} onClick={() => edit(empty)}><Plus size={15}/>New audience link</button>
    </div>}
    {draft && <form onSubmit={event => { event.preventDefault(); save(draft.id ? 'PUT' : 'POST') }}>
      <fieldset disabled={busy}>
        <label>Audience name<input required maxLength={80} value={draft.label} placeholder="e.g. Study group"
          onChange={event => change({ label: event.target.value })}/><small>Visible only to people who manage the document’s links.</small></label>
        <label>Access level<select value={draft.role} onChange={event => change({ role: event.target.value })}>
          <option value="view">Viewer</option><option value="edit">Editor</option>
        </select></label>
        <label>Message<textarea rows={2} maxLength={300} value={draft.shareMessage} onChange={event => change({ shareMessage: event.target.value })}
          placeholder="Add context for this group"/></label>
        <fieldset className="library-link-expiry"><legend>Expiration</legend>
          <label className="library-link-expiry-toggle"><input type="checkbox" checked={draft.useExpiry}
            onChange={event => change({ useExpiry: event.target.checked })}/>Expire this link</label>
          {draft.useExpiry && <label>Expiration date and time<input type="datetime-local" required value={draft.expiry}
            onChange={event => change({ expiry: event.target.value })}/><small>Uses your device’s local time.</small></label>}
        </fieldset>
        {expired && <p>This link has expired. Set a future expiration or turn it off to reactivate this address.</p>}
        {selected && !href && <p>The address cannot be recovered here. Revoke this link and create a new one if you need to share an address.</p>}
        {href && <label>Audience link<input type="url" ref={linkInput} readOnly value={href} onFocus={event => event.currentTarget.select()}/></label>}
        <div className="library-sharing-actions">
          <button type="submit" className="library-primary" disabled={!draft.label.trim()}>
            <Link2 size={15}/>{draft.id ? 'Save settings' : 'Create audience link'}
          </button>
          {href && !expired && <><button type="button" onClick={async () => {
            try { await navigator.clipboard.writeText(href); setNotice('Link copied.') }
            catch { linkInput.current?.select(); setNotice('Copy the selected address.') }
          }}>Copy link</button><a href={href} target="_blank" rel="noopener noreferrer">Open link</a></>}
          {selected && !confirm && <button type="button" onClick={() => setConfirm(true)}>Revoke link…</button>}
          {!selected && <button type="button" onClick={() => edit(null)}>Cancel</button>}
        </div>
        {confirm && <div className="library-sharing-actions">
          <span>Revoke access through {selected?.label}?</span>
          <button type="button" onClick={() => save('DELETE')}>Revoke this link</button>
          <button type="button" onClick={() => setConfirm(false)}>Keep link</button>
        </div>}
      </fieldset>
    </form>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="library-modal-error">{error}</p>}
  </section>
}
