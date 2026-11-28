import { useEffect, useRef, useState } from 'react'
import { Copy, Link2 } from 'lucide-react'
import { friendRequest, refreshFriends } from '../hooks/useFriends'
import './FriendSharing.css'

const endpoint = '/api/friend-invites'

export function FriendInviteLink({ token }) {
  const [invite, setInvite] = useState({ expiresAt: null, url: '' })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const field = useRef(null)
  const locked = useRef(false)
  const revision = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      if (locked.current) return
      const started = ++revision.current
      try {
        const { expiresAt } = await friendRequest(token, endpoint, { signal: controller.signal })
        if (!controller.signal.aborted && started === revision.current) setInvite(previous => ({
          expiresAt,
          url: expiresAt && previous.expiresAt === expiresAt ? previous.url : '',
        }))
      } catch (failure) {
        if (!controller.signal.aborted && started === revision.current) setError(failure.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    window.addEventListener('focus', load)
    return () => { controller.abort(); window.removeEventListener('focus', load) }
  }, [token])

  const change = async method => {
    if (locked.current) return
    locked.current = true
    revision.current++
    setBusy(true); setError(''); setNotice('')
    try {
      const data = await friendRequest(token, endpoint, { method, ...(method === 'POST' ? { body: JSON.stringify({ message: message.trim() }) } : {}) })
      if (method === 'DELETE') {
        setInvite({ expiresAt: null, url: '' })
        setNotice('Invite link revoked.')
      } else {
        const url = new URL('#' + data.path, location.href)
        url.search = ''
        setInvite({ expiresAt: data.expiresAt, url: url.href })
        setMessage('')
        setNotice('Invite link ready to copy.')
      }
    } catch (failure) { setError(failure.message) }
    finally { locked.current = false; setBusy(false) }
  }

  return <section className="friend-sharing" aria-label="Friend invite link">
    <h3>Invite by link</h3>
    <p>Anyone with this link can sign in and accept. Each link works once and expires after seven days.</p>
    {invite.expiresAt && <p>Active until {new Date(invite.expiresAt).toLocaleString()}. Creating a new link replaces it.</p>}
    <div className="friend-sharing-form">
      <label className="friend-message-field">Message for the next link (optional)
        <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={300}
          disabled={loading || busy} rows={2} placeholder="Add a short note for the recipient"/>
        <small>{message.length} / 300</small>
      </label>
      <button type="button" disabled={loading || busy} onClick={() => change('POST')}>
        <Link2 size={15} aria-hidden="true"/> {invite.expiresAt ? 'Replace invite link' : 'Create invite link'}
      </button>
      {invite.expiresAt && <button type="button" disabled={busy} onClick={() => change('DELETE')}>Revoke invite link</button>}
    </div>
    {invite.url && <div className="friend-sharing-form">
      <label>Invite link<input ref={field} value={invite.url} readOnly onFocus={event => event.target.select()}/></label>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(invite.url); setNotice('Invite link copied.') }
        catch { field.current?.focus(); field.current?.select(); setNotice('Copy the selected link.') }
      }}><Copy size={15} aria-hidden="true"/> Copy link</button>
    </div>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}

export function FriendInvitePage({ token, secret, onOpenFriends }) {
  const [invite, setInvite] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const path = endpoint + '/' + encodeURIComponent(secret)

  useEffect(() => {
    if (!secret) { setError('This invite link is invalid.'); return }
    const controller = new AbortController()
    friendRequest(token, path, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) setInvite(data)
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message)
    })
    return () => controller.abort()
  }, [path, token, secret])

  const accept = async () => {
    if (lock.current) return
    lock.current = true
    setBusy(true); setError('')
    try {
      await friendRequest(token, path, { method: 'POST' })
      setAccepted(true)
      refreshFriends()
    } catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }

  return <section className="account-card friend-sharing" aria-label="Friend invitation">
    {invite && <>
      <h2>{invite.username} invited you to become friends</h2>
      {invite.message && <p className="friend-request-note">{invite.message}</p>}
      {accepted || invite.alreadyFriends
        ? <p role="status">You and {invite.username} are friends.</p>
        : <><p>Accepting adds this account to your friends list.</p><button type="button" disabled={busy} onClick={accept}>{busy ? 'Accepting…' : 'Accept friend invite'}</button></>}
    </>}
    {!invite && !error && <p role="status">Loading invitation…</p>}
    {error && <p role="alert">{error}</p>}
    <button type="button" onClick={onOpenFriends}>Open Friends</button>
  </section>
}
