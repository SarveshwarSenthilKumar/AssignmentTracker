import { useMemo, useRef, useState } from 'react'
import { ArrowUpRight, Bookmark, Pencil, Plus, Trash2 } from 'lucide-react'
import { documentRoute } from '../lib/openInTab'
import { descriptionParts, documentTaskIds } from '../lib/taskAttachments'
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

function opensInNewTab(url) {
  return !url.startsWith('#/') || /^#\/(?:documents|tasks)\//.test(url)
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

function linksInText(text) {
  if (typeof text !== 'string') return []
  return Array.from(text.matchAll(/(?:https?:\/\/|#\/)[^\s<>"\x27]+/gi), ([match]) => {
    let url = match.replace(/[.,;:!?]+$/, '')
    const pairs = [['(', ')'], ['[', ']'], ['{', '}']]
    for (const [open, close] of pairs) {
      while (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1)
    }
    return url.replace(/&amp;/gi, '&')
  })
}

function workspaceSuggestions(tasks, folders, documents) {
  const results = new Map()
  const files = new Map(documents.filter(file => !file.deletedAt).map(file => [String(file._id), file]))
  const tasksById = new Map(tasks.map(task => [String(task._id), task]))
  const add = (value, origin, title) => {
    try {
      const url = bookmarkUrl(value)
      if (url.length > 2048) return
      const existing = results.get(url)
      if (existing) {
        existing.sources.add(origin)
        return
      }
      results.set(url, { url, title: (title || (url.startsWith('#/') ? url : new URL(url).hostname)).slice(0, 100), sources: new Set([origin]) })
    } catch { /* The link is unsupported. */ }
  }
  for (const task of tasks) {
    const origin = task.text || 'Task'
    for (const url of [...(task.links || []), ...linksInText(task.text), ...linksInText(task.description), ...linksInText(task.canvasInstructions)]) {
      add(url, origin, task.text)
    }
    for (const part of descriptionParts(task.description || '')) {
      const file = files.get(part.documentId?.toLowerCase())
      if (file) add('#/' + documentRoute(file._id), origin, file.name)
    }
  }
  for (const file of files.values()) {
    for (const id of documentTaskIds(file)) {
      const task = tasksById.get(id)
      if (task) add('#/' + documentRoute(file._id), task.text || 'Task', file.name)
    }
  }
  for (const folder of folders) {
    for (const url of linksInText(folder.description)) add(url, folder.name || 'Folder', folder.name)
  }
  return [...results.values()]
}

export default function BookmarksPage({ userId, tasks, folders, documentFolders, documents }) {
  const storageKey = 'platform-bookmarks:' + userId
  const [bookmarks, setBookmarks] = useState(() => readBookmarks(storageKey))
  const [draft, setDraft] = useState(emptyDraft)
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [suggestionLimit, setSuggestionLimit] = useState(12)
  const candidates = useMemo(() => workspaceSuggestions(tasks, [...folders, ...documentFolders], documents), [tasks, folders, documentFolders, documents])
  const savedUrls = new Set(bookmarks.map(item => item.url))
  const suggestions = candidates.filter(item => !savedUrls.has(item.url))
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
        const newTab = opensInNewTab(item.url)
        return <li key={item.id}>
          <a href={item.url} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
            <Bookmark size={16} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.url}</small></span>
            {newTab && <ArrowUpRight size={15} aria-label="Opens in a new tab" />}
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

    <section className="bookmark-list bookmark-suggestions" aria-labelledby="bookmark-suggestions-title">
      <h2 id="bookmark-suggestions-title">Suggested links</h2>
      {suggestions.length ? <ul>{suggestions.slice(0, suggestionLimit).map(item => {
        const newTab = opensInNewTab(item.url)
        const [firstSource] = item.sources
        return <li key={item.url}>
          <a href={item.url} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
            <span><strong>{item.title}</strong><small>{item.url}</small><small>From {firstSource}{item.sources.size > 1 ? ' and ' + (item.sources.size - 1) + ' more' : ''}</small></span>
            {newTab && <ArrowUpRight size={15} aria-label="Opens in a new tab" />}
          </a>
          <div className="bookmark-actions">
            <button type="button" aria-label={'Save bookmark for ' + item.url} onClick={() => {
              setNotice('')
              if (save([{ id: crypto.randomUUID(), title: item.title, url: item.url }, ...bookmarks], 'Bookmark added.')) setQuery('')
            }}><Bookmark size={15} aria-hidden="true" />Save</button>
          </div>
        </li>
      })}</ul> : <p>Unsaved links from your tasks and folder descriptions will appear here.</p>}
      {suggestions.length > suggestionLimit && <div className="bookmark-actions bookmark-more">
        <button type="button" onClick={() => setSuggestionLimit(value => value + 12)}>Show more links</button>
      </div>}
    </section>

    <section className="bookmark-quick-links" aria-labelledby="bookmark-quick-links-title">
      <h2 id="bookmark-quick-links-title">Quick links</h2>
      <ul>{quickLinks.map(([title, url]) => <li key={url}><a href={url}>{title}<ArrowUpRight size={14} aria-hidden="true" /></a></li>)}</ul>
    </section>
  </section>
}
