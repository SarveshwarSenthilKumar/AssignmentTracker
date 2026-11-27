import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Bookmark, Folder, Pencil, Plus, Trash2 } from 'lucide-react'
import { documentRoute } from '../lib/openInTab'
import { descriptionParts, documentTaskIds } from '../lib/taskAttachments'
import './BookmarksPage.css'

const quickLinks = [
  ['Tasks', '#/tasks'], ['Calendar', '#/calendar'], ['Documents', '#/documents'],
  ['Workspace', '#/workspace'], ['Canvas', '#/canvas'], ['Question bank', '#/study'],
  ['Tutorial', '#/tutorial'], ['Keyboard shortcuts', '#/shortcuts'],
]
const emptyDraft = { title: '', url: '', folderId: '' }

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
    const stored = JSON.parse(localStorage.getItem(key) || '[]')
    const folders = Array.isArray(stored?.folders) ? stored.folders.filter(folder =>
      typeof folder?.id === 'string' && folder.id && typeof folder.name === 'string' && folder.name.trim()
    ) : []
    const ids = new Set(folders.map(folder => folder.id))
    const records = Array.isArray(stored) ? stored : stored?.bookmarks
    const bookmarks = Array.isArray(records) ? records.flatMap(item => {
      try {
        if (typeof item?.id !== 'string' || typeof item.title !== 'string' || !item.title.trim()) return []
        return [{ id: item.id, title: item.title, url: bookmarkUrl(item.url), folderId: ids.has(item.folderId) ? item.folderId : '' }]
      } catch { return [] }
    }) : []
    return { bookmarks, folders }
  } catch { return { bookmarks: [], folders: [] } }
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

export default function BookmarksPage({ userId, tasks, folders, documentFolders, documents, showSuggestions = true }) {
  const storageKey = 'platform-bookmarks:' + userId
  const [{ bookmarks, folders: bookmarkFolders }, setLibrary] = useState(() => readBookmarks(storageKey))
  const [folderFilter, setFolderFilter] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [folderDraft, setFolderDraft] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const currentFolder = bookmarkFolders.find(folder => folder.id === folderFilter)
  const defaultFolderId = currentFolder?.id || ''
  const [draft, setDraft] = useState(emptyDraft)
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')
  const [suggestionLimit, setSuggestionLimit] = useState(12)
  const candidates = useMemo(() => showSuggestions ? workspaceSuggestions(tasks, [...folders, ...documentFolders], documents) : [], [showSuggestions, tasks, folders, documentFolders, documents])
  const savedUrls = new Set(bookmarks.map(item => item.url))
  const suggestions = candidates.filter(item => !savedUrls.has(item.url))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const titleField = useRef(null)
  const savedView = folderFilter === 'all' || folderFilter === '' || Boolean(currentFolder)
  useEffect(() => {
    if (formOpen) titleField.current?.focus()
  }, [formOpen, editing])
  const shown = bookmarks.filter(item => (folderFilter === 'all' || item.folderId === folderFilter) && (item.title + ' ' + item.url).toLowerCase().includes(query.trim().toLowerCase()))

  const save = (next, message, nextFolders = bookmarkFolders) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ bookmarks: next, folders: nextFolders }))
    } catch {
      setError('This browser could not save your bookmarks.')
      return false
    }
    setLibrary({ bookmarks: next, folders: nextFolders })
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
    const record = { id: editing || crypto.randomUUID(), title, url, folderId: draft.folderId }
    const next = editing ? bookmarks.map(item => item.id === editing ? record : item) : [record, ...bookmarks]
    if (save(next, editing ? 'Bookmark updated.' : 'Bookmark added.')) {
      setEditing(null)
      setDraft({ ...emptyDraft, folderId: record.folderId })
      setFormOpen(false)
      setQuery('')
    }
  }

  const selectFolder = id => {
    setFolderFilter(id)
    setConfirmDelete(false)
    setFolderDraft(null)
    setEditing(null)
    setFormOpen(false)
    setQuery('')
    setError('')
    setDraft({ ...emptyDraft, folderId: bookmarkFolders.some(folder => folder.id === id) ? id : '' })
  }

  const saveFolder = event => {
    event.preventDefault()
    const name = folderDraft.name.trim()
    if (!name) { setError('Enter a folder name.'); return }
    if (bookmarkFolders.some(folder => folder.id !== folderDraft.id && folder.name.toLowerCase() === name.toLowerCase())) {
      setError('A folder with that name already exists.')
      return
    }
    const folder = { id: folderDraft.id || crypto.randomUUID(), name }
    const next = folderDraft.id ? bookmarkFolders.map(item => item.id === folder.id ? folder : item) : [...bookmarkFolders, folder]
    if (save(bookmarks, folderDraft.id ? 'Folder renamed.' : 'Folder created.', next)) {
      selectFolder(folder.id)
      setDraft({ ...emptyDraft, folderId: folder.id })
    }
  }

  const removeFolder = () => {
    const id = currentFolder.id
    const next = bookmarks.map(item => item.folderId === id ? { ...item, folderId: '' } : item)
    if (!save(next, 'Folder removed. Its bookmarks are in Unfiled.', bookmarkFolders.filter(folder => folder.id !== id))) return
    selectFolder(null)
  }

  return <section className="bookmarks-page" aria-label="Bookmarks">
    <section className="bookmark-folders" aria-labelledby="bookmark-folders-title">
      <h2 id="bookmark-folders-title">{folderFilter === null ? 'Folders' : currentFolder?.name ?? ({ all: 'All bookmarks', '': 'Unfiled', suggestions: 'Suggested links', quick: 'Quick links' })[folderFilter]}</h2>
      {folderFilter === null ? <>
        <ul className="bookmark-folder-grid">
          {[['all', 'All bookmarks', Bookmark], ['', 'Unfiled', Folder], ...bookmarkFolders.map(folder => [folder.id, folder.name, Folder])].map(([id, name, Icon]) =>
            <li key={id}><button type="button" onClick={() => selectFolder(id)}><Icon size={16} aria-hidden="true"/>{name}</button></li>
          )}
          {showSuggestions && <li><button type="button" onClick={() => selectFolder('suggestions')}>Suggested links</button></li>}
          <li><button type="button" onClick={() => selectFolder('quick')}>Quick links</button></li>
        </ul>
        <div className="bookmark-actions"><button type="button" onClick={() => { setFolderDraft({ name: '' }); setError('') }}>New folder</button></div>
      </> : <div className="bookmark-actions">
        <button type="button" onClick={() => { setNotice(''); selectFolder(null) }}><ArrowLeft size={16} aria-hidden="true"/>Back to folders</button>
        {savedView && !formOpen && <button type="button" onClick={() => {
          setDraft({ ...emptyDraft, folderId: defaultFolderId }); setError(''); setNotice(''); setFormOpen(true)
        }}><Plus size={16} aria-hidden="true"/>Add bookmark</button>}
        {currentFolder && <>
          <button type="button" onClick={() => { setFolderDraft({ ...currentFolder }); setConfirmDelete(false); setError('') }}>Rename folder</button>
          <button type="button" onClick={() => { setConfirmDelete(true); setFolderDraft(null) }}>Remove folder</button>
        </>}
      </div>}
      {folderDraft && <form onSubmit={saveFolder}>
        <label>Folder name<input value={folderDraft.name} onChange={event => setFolderDraft({ ...folderDraft, name: event.target.value })} maxLength={100} required /></label>
        <div className="bookmark-actions">
          <button type="submit">{folderDraft.id ? 'Save name' : 'Create folder'}</button>
          <button type="button" onClick={() => { setFolderDraft(null); setError('') }}>Cancel</button>
        </div>
      </form>}
      {confirmDelete && currentFolder && <>
        <p>Remove {currentFolder.name} and move its bookmarks to Unfiled?</p>
        <div className="bookmark-actions">
          <button type="button" onClick={removeFolder}>Move bookmarks and remove folder</button>
          <button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      </>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </section>

    {savedView && formOpen && <form className="bookmark-form" onSubmit={submit}>
      <h2>{editing ? 'Edit bookmark' : 'Add a bookmark'}</h2>
      <label>Name<input ref={titleField} value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={100} required /></label>
      <label>Link<input value={draft.url} onChange={event => setDraft({ ...draft, url: event.target.value })} placeholder="https://example.com or #/tasks" maxLength={2048} required /></label>
      {bookmarkFolders.length > 0 && <label>Folder
        <select value={draft.folderId} onChange={event => setDraft({ ...draft, folderId: event.target.value })}>
          <option value="">Unfiled</option>
          {bookmarkFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
      </label>}
      <div className="bookmark-actions">
        <button type="submit"><Plus size={16} aria-hidden="true" />{editing ? 'Save changes' : 'Add bookmark'}</button>
        <button type="button" onClick={() => { setFormOpen(false); setEditing(null); setDraft({ ...emptyDraft, folderId: defaultFolderId }); setError('') }}>Cancel</button>
      </div>
    </form>}

    {savedView && <section className="bookmark-list" aria-labelledby="saved-bookmarks-title">
      <h2 id="saved-bookmarks-title">{currentFolder?.name ?? (folderFilter === 'all' ? "Saved bookmarks" : "Unfiled")}</h2>
      {bookmarks.length > 0 && <label>Find a bookmark<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>}
      {shown.length ? <ul>{shown.map(item => {
        const newTab = opensInNewTab(item.url)
        return <li key={item.id}>
          <a href={item.url} target={newTab ? '_blank' : undefined} rel={newTab ? 'noopener noreferrer' : undefined}>
            <Bookmark size={16} aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.url}</small>{folderFilter === 'all' && item.folderId && <small>{bookmarkFolders.find(folder => folder.id === item.folderId)?.name}</small>}</span>
            {newTab && <ArrowUpRight size={15} aria-label="Opens in a new tab" />}
          </a>
          <div className="bookmark-actions">
            <button type="button" aria-label={'Edit ' + item.title} onClick={() => {
              setEditing(item.id); setDraft({ title: item.title, url: item.url, folderId: item.folderId }); setError(''); setNotice(''); setFormOpen(true)
            }}><Pencil size={15} aria-hidden="true" /></button>
            <button type="button" aria-label={'Remove ' + item.title} onClick={() => {
              if (save(bookmarks.filter(entry => entry.id !== item.id), 'Bookmark removed.') && editing === item.id) {
                setFormOpen(false); setEditing(null); setDraft({ ...emptyDraft, folderId: defaultFolderId })
              }
            }}><Trash2 size={15} aria-hidden="true" /></button>
          </div>
        </li>
      })}</ul> : <p>{query.trim() ? 'No bookmarks match your search.' : folderFilter !== 'all' ? 'This folder is empty.' : 'Add a link to keep it handy.'}</p>}
      <p className="bookmark-note">Bookmarks are saved for your account in this browser.</p>
    </section>}

    {showSuggestions && folderFilter === 'suggestions' && <section className="bookmark-list bookmark-suggestions" aria-labelledby="bookmark-suggestions-title">
      <h2 id="bookmark-suggestions-title">Choose where to save suggestions</h2>
      {bookmarkFolders.length > 0 && <label>Destination folder
        <select value={draft.folderId} onChange={event => setDraft({ ...emptyDraft, folderId: event.target.value })}>
          <option value="">Unfiled</option>
          {bookmarkFolders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
        </select>
      </label>}
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
              if (save([{ id: crypto.randomUUID(), title: item.title, url: item.url, folderId: draft.folderId }, ...bookmarks], 'Bookmark added.')) setQuery('')
            }}><Bookmark size={15} aria-hidden="true" />Save</button>
          </div>
        </li>
      })}</ul> : <p>Unsaved links from your tasks and folder descriptions will appear here.</p>}
      {suggestions.length > suggestionLimit && <div className="bookmark-actions bookmark-more">
        <button type="button" onClick={() => setSuggestionLimit(value => value + 12)}>Show more links</button>
      </div>}
    </section>}

    {folderFilter === 'quick' && <section className="bookmark-quick-links" aria-labelledby="bookmark-quick-links-title">
      <h2 id="bookmark-quick-links-title">Quick links</h2>
      <ul>{quickLinks.map(([title, url]) => <li key={url}><a href={url}>{title}<ArrowUpRight size={14} aria-hidden="true" /></a></li>)}</ul>
    </section>}
  </section>
}
