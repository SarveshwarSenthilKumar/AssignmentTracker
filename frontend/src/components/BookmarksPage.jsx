import { useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Pencil, Plus, Trash2 } from 'lucide-react'
import './BookmarksPage.css'

const quickLinks = [
  ['Tasks', '#/tasks'], ['Calendar', '#/calendar'], ['Documents', '#/documents'],
  ['Workspace', '#/workspace'], ['Canvas', '#/canvas'], ['Question bank', '#/study'],
  ['Tutorial', '#/tutorial'], ['Keyboard shortcuts', '#/shortcuts'],
]
const emptyDraft = { title: '', url: '' }

function bookmarkUrl(input) {
  const value = input.trim()
  if (/^#\/[a-z0-9][^\s]*$/i.test(value)) return value
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error()
  if (url.origin === window.location.origin && url.pathname === window.location.pathname && /^#\/[a-z0-9]/i.test(url.hash)) return url.hash
  return url.href
}

function readBookmarks(key) {
  try {
    const records = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(records) ? records.flatMap(item => {
      try {
        if (typeof item?.id !== 'string' || typeof item.title !== 'string' || !item.title.trim()) return []
        return [{ id: item.id, title: item.title, url: bookmarkUrl(item.url) }]
      } catch { return [] }
    }) : []
  } catch { return [] }
}

export default function BookmarksPage({ userId }) {
  const storageKey = 'platform-bookmarks:' + userId
  const [bookmarks, setBookmarks] = useState(() => readBookmarks(storageKey))
  const [draft, setDraft] = useState(emptyDraft)
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const titleField = useRef(null)
  const shown = bookmarks.filter(item => (item.title + ' ' + item.url).toLowerCase().includes(query.trim().toLowerCase()))

  const save = (next, message) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      setError('This browser could not save your bookmarks.')
      return false
    }
    setBookmarks(next)
    setError('')
    setNotice(message)
    return true
  }

  const submit = event => {
    event.preventDefault()
    setNotice('')
    const title = draft.title.trim()
    if (!title) { setError('Enter a name for the bookmark.'); return }
    let url
    try { url = bookmarkUrl(draft.url) }
    catch { setError('Enter a full HTTP or HTTPS address, or a platform link such as #/tasks.'); return }
    if (bookmarks.some(item => item.url === url && item.id !== editing)) {
      setError('That link is already bookmarked.')
      return
    }
    const record = { id: editing || crypto.randomUUID(), title, url }
    const next = editing ? bookmarks.map(item => item.id === editing ? record : item) : [record, ...bookmarks]
    if (save(next, editing ? 'Bookmark updated.' : 'Bookmark added.')) {
      setEditing(null)
      setDraft(emptyDraft)
      setQuery('')
    }
  }

  return <section className="bookmarks-page" aria-label="Bookmarks">
    <form className="bookmark-form" onSubmit={submit}>
      <h2>{editing ? 'Edit bookmark' : 'Add a bookmark'}</h2>
      <label>Name<input ref={titleField} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={100} required /></label>
      <label>Link<input value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} placeholder="https://example.com or #/tasks" maxLength={2048} required /></label>
      <div className="bookmark-actions">
        <button type="submit"><Plus size={16} aria-hidden="true" />{editing ? 'Save changes' : 'Add bookmark'}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setDraft(emptyDraft); setError('') }}>Cancel</button>}
      </div>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </form>

    <section className="bookmark-list" aria-labelledby="saved-bookmarks-title">
      <h2 id="saved-bookmarks-title">Saved bookmarks</h2>
      {bookmarks.length > 0 && <label>Find a bookmark<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>}
      {shown.length ? <ul>{shown.map(item => {
        const external = !item.url.startsWith('#/')
        return <li key={item.id}>
          <a href={item.url} target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}>
            <Bookmark size={16} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.url}</small></span>
            {external && <ArrowUpRight size={15} aria-label="Opens in a new tab" />}
          </a>
          <div className="bookmark-actions">
            <button type="button" aria-label={'Edit ' + item.title} onClick={() => {
              setEditing(item.id); setDraft({ title: item.title, url: item.url }); setError(''); setNotice(''); titleField.current?.focus()
            }}><Pencil size={15} aria-hidden="true" /></button>
            <button type="button" aria-label={'Remove ' + item.title} onClick={() => {
              if (save(bookmarks.filter(entry => entry.id !== item.id), 'Bookmark removed.') && editing === item.id) {
                setEditing(null); setDraft(emptyDraft)
              }
            }}><Trash2 size={15} aria-hidden="true" /></button>
          </div>
        </li>
      })}</ul> : <p>{bookmarks.length ? 'No bookmarks match your search.' : 'Add a link to keep it handy.'}</p>}
      <p className="bookmark-note">Bookmarks are saved for your account in this browser.</p>
    </section>

    <section className="bookmark-quick-links" aria-labelledby="bookmark-quick-links-title">
      <h2 id="bookmark-quick-links-title">Quick links</h2>
      <ul>{quickLinks.map(([title, url]) => <li key={url}><a href={url}>{title}<ArrowUpRight size={14} aria-hidden="true" /></a></li>)}</ul>
    </section>
  </section>
}
