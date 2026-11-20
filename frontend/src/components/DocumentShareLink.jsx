import { useEffect, useState } from 'react'
import { Link2, X } from 'lucide-react'

export default function DocumentShareLink({ file, token, onClose }) {
  const [active, setActive] = useState(null)
  const [role, setRole] = useState('view')
  const [canEdit, setCanEdit] = useState(false)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const endpoint = `/api/pdfs/${file._id}/share-link`

  async function request(method, signal) {
    const response = await fetch(endpoint, {
      method, signal, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' && { 'Content-Type': 'application/json' }) },
      ...(method === 'POST' && { body: JSON.stringify({ role }) })
    })
    if (response.status === 204) return null
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || 'Could not manage this share link.')
    return data
  }

  useEffect(() => {
    const controller = new AbortController()
    request('GET', controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        setActive(data.active === true)
        setRole(data.role === 'edit' ? 'edit' : 'view')
        setCanEdit(data.canEdit === true)
      })
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [endpoint, token])

  async function change(method) {
    if (busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const data = await request(method)
      if (method === 'POST' && !/^(?:\/api|#)\/shared-document\/[A-Za-z0-9_-]{43}$/.test(data?.path || '')) throw new Error('The server did not return a share link.')
      setLink(method === 'POST' ? new URL(data.path, window.location.href).href : '')
      setActive(method === 'POST')
      setNotice(method === 'POST' ? 'Share link created.' : 'Share link revoked.')
    } catch (error) {
      setError(error.message)
    } finally {
      setBusy(false)
    }
  }

  return <div className="library-modal-backdrop" onKeyDown={event => {
    if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose() }
  }}>
    <div className="library-share-link-panel" role="dialog" aria-labelledby="document-share-title" aria-busy={busy}>
      <div className="library-modal-heading">
        <h3 id="document-share-title">Share {file.name}</h3>
        <button type="button" autoFocus disabled={busy} aria-label="Close share link" onClick={onClose}><X size={18}/></button>
      </div>
      <label>Link permission
        <select disabled={busy || active === null} value={role} onChange={event => { setRole(event.target.value); setLink('') }}>
          <option value="view">Viewer</option>
          <option value="edit" disabled={!canEdit}>Editor</option>
        </select>
      </label>
      <p>{role === 'edit' ? 'Anyone with an Editor link can edit the original without signing in. PDFs and text open in the editor; other formats can be downloaded, edited, and replaced.' : 'Anyone with a Viewer link can download the saved file without signing in.'}</p>
      {!canEdit && active !== null && <p>Editor links support Markdown and plain-text files.</p>}
      {active && !link && <p>A link already exists. Creating a new one revokes the old link.</p>}
      {link && <label>Share link
        <input type="url" readOnly value={link} onFocus={event => event.target.select()}/>
      </label>}
      <div className="library-sharing-actions">
        {link && <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(link); setNotice('Link copied.') }
          catch { setNotice('Select and copy the link from the field above.') }
        }}>Copy link</button>}
        <button type="button" className="library-primary" disabled={busy || active === null} onClick={() => change('POST')}><Link2 size={16} aria-hidden="true"/>{active ? 'Replace link' : 'Create link'}</button>
        {active && <button type="button" disabled={busy} onClick={() => change('DELETE')}>Revoke link</button>}
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="library-modal-error">{error}</p>}
    </div>
  </div>
}
