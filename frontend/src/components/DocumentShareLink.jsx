import { useEffect, useState } from 'react'
import { Link2, X } from 'lucide-react'

const localTime=value=>{if(!value)return '';const date=new Date(value),pad=value=>String(value).padStart(2,'0');return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;}

export default function DocumentShareLink({ file, token, onClose }) {
  const [active, setActive] = useState(null)
  const [role, setRole] = useState('view')
  const [canEdit, setCanEdit] = useState(false)
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [savedRole,setSavedRole]=useState('view'),[needsOriginal,setNeedsOriginal]=useState(false),[original,setOriginal]=useState('')
  const [expires,setExpires]=useState(false),[expiry,setExpiry]=useState(''),[savedExpiry,setSavedExpiry]=useState(''),[expired,setExpired]=useState(false)
  const endpoint = `/api/pdfs/${file._id}/share-link`

  async function request(method, signal) {
    let expiresAt=null
    if(method==='POST'&&expires){
      if(!expiry||!Number.isFinite(Date.parse(expiry))||Date.parse(expiry)<=Date.now())throw new Error('Choose an expiration date and time in the future, or turn expiration off.')
      expiresAt=new Date(expiry).toISOString()
    }
    let existingToken
    if(method==='POST'&&original.trim()){
      const url=new URL(original.trim(),window.location.origin)
      existingToken=/^(?:#\/shared-document\/|\/api\/shared-document\/)([A-Za-z0-9_-]{43})$/.exec(url.hash||url.pathname)?.[1]
      if(!existingToken)throw new Error('Paste the full original document sharing link.')
    }
    const response = await fetch(endpoint, {
      method, signal, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(method === 'POST' && { 'Content-Type': 'application/json' }) },
      ...(method === 'POST' && { body: JSON.stringify({ role,existingToken,expiresAt }) })
    })
    if (response.status === 204) return null
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {if(data.requiresExistingLink)setNeedsOriginal(true);throw new Error(data.message || 'Could not manage this share link.')}
    return data
  }

  useEffect(() => {
    const controller = new AbortController()
    request('GET', controller.signal)
      .then(data => {
        if (controller.signal.aborted) return
        setActive(data.active === true)
        setRole(data.role === 'edit' ? 'edit' : 'view')
        setSavedRole(data.role==='edit'?'edit':'view')
        setNeedsOriginal(data.requiresExistingLink===true)
        setLink(data.path?new URL(data.path,window.location.href).href:'')
        setExpires(!!data.expiresAt);setExpiry(localTime(data.expiresAt));setSavedExpiry(localTime(data.expiresAt));setExpired(data.expired===true)
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
      setSavedRole(method==='POST'?role:'view')
      setNeedsOriginal(false);setOriginal('')
      setExpires(method==='POST'&&!!data.expiresAt);setExpiry(method==='POST'?localTime(data.expiresAt):'');setSavedExpiry(method==='POST'?localTime(data.expiresAt):'');setExpired(method==='POST'&&data.expired===true)
      setNotice(method === 'POST' ? data.expiresAt?`Sharing saved. This link expires ${new Date(data.expiresAt).toLocaleString()}.`:'Sharing saved. This link has no expiration.' : 'Share link revoked. Previous copies no longer grant access.')
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
        <select disabled={busy || active === null} value={role} onChange={event => setRole(event.target.value)}>
          <option value="view">Viewer</option>
          <option value="edit" disabled={!canEdit}>Editor</option>
        </select>
      </label>
      <p>{role === 'edit' ? 'Anyone with an Editor link can edit the original without signing in. PDFs and text open in the editor; other formats can be downloaded, edited, and replaced.' : 'Anyone with a Viewer link can download the saved file without signing in.'}</p>
      {!canEdit && active !== null && <p>Editor links support Markdown and plain-text files.</p>}
      <fieldset className="library-link-expiry"><legend>Link expiration</legend><label className="library-link-expiry-toggle"><input type="checkbox" checked={expires} onChange={event=>setExpires(event.target.checked)} disabled={busy||active===null}/><span>Expire this link</span></label>
        {expires&&<><label>Expiration date and time<input type="datetime-local" value={expiry} onChange={event=>setExpiry(event.target.value)} disabled={busy}/></label><div className="library-sharing-actions">{[[1,'In 1 hour'],[24,'In 1 day'],[168,'In 7 days']].map(([hours,label])=><button key={hours} type="button" disabled={busy} onClick={()=>setExpiry(localTime(Date.now()+hours*3600000))}>{label}</button>)}</div><small>Uses your device’s local time ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</small></>}
        {!expires&&<small>No expiration. Access remains subject to permissions, locks, and revocation.</small>}
      </fieldset>
      <p>Saving permissions or changing expiration keeps the same link address.</p>
      {expired&&<p role="status">This link has expired. Choose a future expiration or turn expiration off, then save to reactivate the same link.</p>}
      {active&&(role!==savedRole||(expires?expiry:'')!==savedExpiry)&&<p>Save settings to apply these changes to everyone using the link.</p>}
      {needsOriginal&&<label>Recover the original link<input type="text" inputMode="url" value={original} onChange={event=>setOriginal(event.target.value)} placeholder="Paste the link you already shared" disabled={busy}/><small>The original address has not changed. Paste it once so it can be copied again without replacing it.</small></label>}
      {link && <label>Share link
        <input type="url" readOnly value={link} onFocus={event => event.target.select()}/>
      </label>}
      <div className="library-sharing-actions">
        {link&&<a href={link} target="_blank" rel="noopener noreferrer">Open shared file</a>}
        {link && <button type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(link); setNotice('Link copied.') }
          catch { setNotice('Select and copy the link from the field above.') }
        }}>Copy link</button>}
        <button type="button" className="library-primary" disabled={busy || active === null || (needsOriginal&&!original.trim())} onClick={() => change('POST')}><Link2 size={16} aria-hidden="true"/>{active ? needsOriginal?'Recover existing link':'Save sharing settings' : 'Create link'}</button>
        {active && <button type="button" disabled={busy} onClick={() => change('DELETE')}>Revoke link</button>}
      </div>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert" className="library-modal-error">{error}</p>}
    </div>
  </div>
}
