import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Bell, Link2, MessageSquare, Shield } from 'lucide-react'
import { readApiJson } from '../lib/apiResponse'
import FriendDocumentDownload, { downloadFriendDocument } from './FriendDocumentDownload'
import './DocumentActivity.css'

const groups = [
  ['share', 'New shares', Link2],
  ['access', 'Access changes', Shield],
  ['comment', 'Comments', MessageSquare],
]
const dateLabel = value => new Date(value).toLocaleString()

async function request(token, path, options = {}) {
  const response = await fetch(path, {
    cache: 'no-store', ...options,
    headers: { Authorization: 'Bearer ' + token, ...(options.body && { 'Content-Type': 'application/json' }) },
  })
  if (response.status === 204) return null
  const data = await readApiJson(response)
  if (!response.ok) {
    const error = new Error(data.message || 'Could not load shared-file activity.')
    error.status = response.status
    throw error
  }
  return data
}

export function DocumentActivityInbox({ token }) {
  const [activity, setActivity] = useState(null)
  const [error, setError] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(null)
  const endpoint = '/api/document-activity'
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    request(token, endpoint, { signal: controller.signal }).then(data => {
      if (!controller.signal.aborted) { setActivity(data); setError('') }
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [token, version])

  async function markRead(id) {
    if (busy) return
    setBusy(true); setError('')
    try {
      await request(token, endpoint + '/read', { method: 'POST', body: JSON.stringify(id ? { id } : {}) })
      setActivity(previous => ({
        unread: id ? Math.max(0, previous.unread - 1) : 0,
        entries: previous.entries.map(item => !id || item.id === id ? { ...item, read: true } : item),
      }))
    } catch (failure) { setError(failure.message) }
    finally { setBusy(false) }
  }

  async function openFile(item) {
    setOpening(item.id)
    setError('')
    try {
      const { file } = await request(token, '/api/document-discussion/' + item.documentId + '?view=file')
      if (file.openPath) window.location.hash = file.openPath
      else if (file.friendShare) await downloadFriendDocument(file, token)
      else throw new Error('Ask the owner for a link to open this document.')
    } catch (failure) { setError(failure.message) }
    finally { setOpening(null) }
  }

  const visible = (activity?.entries || []).filter(item => !unreadOnly || !item.read)
  return <section className="document-activity" aria-label="Shared-file activity">
    <header><h2><Bell size={18} aria-hidden="true"/>Inbox{activity?.unread ? ' · ' + activity.unread + ' unread' : ''}</h2>
      <div className="document-activity-actions">
        <label><input type="checkbox" checked={unreadOnly} onChange={event => setUnreadOnly(event.target.checked)}/> Unread only</label>
        <button type="button" disabled={loading || busy} onClick={() => setVersion(value => value + 1)}>Refresh</button>
        <button type="button" disabled={loading || busy || !activity?.unread} onClick={() => markRead()}>Mark all as read</button>
      </div>
    </header>
    {error && <p role="alert">{error}</p>}
    {loading && <p role="status">Loading activity…</p>}
    {visible.length > 0 && groups.map(([kind, label, Icon]) => {
      const entries = visible.filter(item => item.kind === kind)
      return entries.length > 0 && <section key={kind} className="document-activity-group">
        <h3><Icon size={16} aria-hidden="true"/>{label}</h3>
        <ul>{entries.map(item => <li key={item.id}>
          <div><a href={'#/document-discussion/' + item.documentId}>{item.name}<ArrowUpRight size={14} aria-hidden="true"/></a>
            <p>{item.actor} · {item.detail}</p>
            <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time>
          </div>
          <div className="document-activity-actions">
          <button type="button" disabled={Boolean(opening)} onClick={() => openFile(item)}
            aria-label={'Open file ' + item.name}>{opening === item.id ? 'Opening…' : 'Open file'}</button>
          {!item.read && <button type="button" disabled={busy || loading} onClick={() => markRead(item.id)}
            aria-label={'Mark activity for ' + item.name + ' as read'}>Mark read</button>}
          </div>
        </li>)}</ul>
      </section>
    })}
    {!loading && !error && !visible.length && <p>{unreadOnly ? 'No unread activity.' : 'New shares, access changes, and comments will appear here.'}</p>}
  </section>
}

export function DocumentDiscussion({ token, documentId }) {
  const [data, setData] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(true)
  const lock = useRef(false)
  const endpoint = '/api/document-discussion/' + documentId

  useEffect(() => {
    const controller = new AbortController()
    request(token, endpoint, { signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) setData(result)
    }).catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setPending(false) })
    return () => controller.abort()
  }, [token, endpoint])

  const post = async event => {
    event.preventDefault()
    if (lock.current || !text.trim()) return
    lock.current = true; setBusy(true); setError('')
    try {
      await request(token, endpoint, { method: 'POST', body: JSON.stringify({ text }) })
      setText('')
      setData(await request(token, endpoint))
    } catch (failure) {
      if (failure.status === 404) setData(null)
      setError(failure.message)
    }
    finally { lock.current = false; setBusy(false) }
  }

  return <section className="document-activity" aria-label="Document discussion">
    <a href="#/document-activity">Back to shared-file activity</a>
    {pending && <p role="status">Opening discussion…</p>}
    {error && <p role="alert">{error}</p>}
    {data && <>
      <h2>{data.file.name}</h2>
      <div className="document-activity-actions">
        {data.file.openPath && <a href={data.file.openPath} target="_blank" rel="noopener noreferrer">Open document<ArrowUpRight size={15} aria-hidden="true"/></a>}
        {data.file.friendShare && <FriendDocumentDownload file={data.file} token={token}/>}
        {!data.file.openPath && !data.file.friendShare && <p>Ask the owner for a link to open this document.</p>}
      </div>
      <form onSubmit={post}>
        <label>Add a comment<textarea value={text} rows={3} maxLength={2000} required disabled={busy} onChange={event => setText(event.target.value)}/></label>
        <button type="submit" disabled={busy || !text.trim()}>{busy ? 'Posting…' : 'Post comment'}</button>
      </form>
      <h3>Comments</h3>
      {data.comments.length ? <ul className="document-comments">{data.comments.map(item => <li key={item.id}>
        <strong>{item.author}</strong> <time dateTime={item.createdAt}>{dateLabel(item.createdAt)}</time><p>{item.text}</p>
      </li>)}</ul> : <p>No comments yet.</p>}
    </>}
  </section>
}
