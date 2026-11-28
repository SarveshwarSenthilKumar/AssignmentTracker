import { Briefcase, EyeOff, GripVertical, Pin, Wrench } from 'lucide-react'
import { useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { readApiJson } from '../lib/apiResponse'
import { featureVisible } from '../lib/featureVisibility'
import { defaultNavigationMenu, defaultNavigationPins, navigationPages } from './AppNavigation'

const menuColumns = [
  ['tools', 'Tools', Wrench],
  ['career', 'Career', Briefcase],
  ['none', 'Outside menus', EyeOff],
]
const defaults = { tools: true, career: true, pages: {} }

export default function NavigationMenuSettings() {
  const { user, token, updatePreferences } = useAuth()
  const saved = user?.navigationMenus ?? defaults
  const [dropTarget, setDropTarget] = useState(null)
  const draggedPage = useRef(null)
  const pageControls = useRef(new Map())
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const value = draft ?? saved
  const pins = user?.navigationPins ?? defaultNavigationPins
  const dirty = value.tools !== saved.tools || value.career !== saved.career ||
    navigationPages.some(([id]) => (value.pages[id] ?? defaultNavigationMenu(id)) !== (saved.pages[id] ?? defaultNavigationMenu(id)))

  const menuFor = id => value.pages[id] ?? defaultNavigationMenu(id)
  const available = id => featureVisible(user?.hiddenFeatures, id)
  const matched = navigationPages.filter(([, label]) => label.toLowerCase().includes(query.trim().toLowerCase()))
  const names = Object.fromEntries(navigationPages)
  const visiblePins = pins.filter(id => available(id) && names[id])

  function edit(next) {
    setDraft(next)
    setError('')
    setNotice('')
  }

  function changePage(id, menu) {
    const pages = { ...value.pages }
    if (menu === defaultNavigationMenu(id)) delete pages[id]
    else pages[id] = menu
    edit({ ...value, pages })
  }

  async function save(navigationMenus) {
    if (lock.current) return
    lock.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ navigationMenus }),
      })
      const data = await readApiJson(response)
      if (!response.ok) throw new Error(data.message || 'Could not save navigation menus.')
      if (data.navigationMenus === undefined) throw new Error('Restart the updated backend and try again.')
      updatePreferences({ navigationMenus: data.navigationMenus })
      setDraft(null)
      setNotice(navigationMenus ? 'Menu settings saved.' : 'Default menus restored.')
    } catch (failure) { setError(failure.message) }
    finally { lock.current = false; setBusy(false) }
  }

  return <section className="confirmation-settings navigation-settings menu-customizer" aria-label="Navigation menus" aria-busy={busy}>
    <h3>Navigation menus</h3>
    <p>Drag a page to another list or choose its destination from the menu on its card.</p>
    <div className="menu-customizer-controls navigation-settings-actions">
      <button type="button" disabled={busy} onClick={() => edit({
        tools: true, career: false, pages: Object.fromEntries(navigationPages.filter(([id]) => defaultNavigationMenu(id) === 'career').map(([id]) => [id, 'tools'])),
      })}>Put pages in Tools</button>
      <button type="button" disabled={busy} onClick={() => edit({ ...value, tools: false, career: false })}>Use top bar only</button>
      <button type="button" disabled={busy} onClick={() => edit(defaults)}>Preview defaults</button>
    </div>
    <div className="menu-preview-pins">
      <Pin size={15} aria-hidden="true"/><strong>Top bar</strong>
      {visiblePins.length ? visiblePins.map(id => <span key={id}>{names[id]}</span>) : <span>No pinned pages</span>}
    </div>
    <label className="menu-page-search">Find a page<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="menu-customizer-board" aria-label="Menu layout preview">
      {menuColumns.map(([id, label, Icon]) => {
        const pages = matched.filter(([route]) => menuFor(route) === id)
        const visibleCount = pages.filter(([route]) => available(route) && !pins.includes(route)).length
        return <div className={'menu-column' + (dropTarget === id ? ' is-drop-target' : '')} key={id}
          onDragOver={event => {
            if (!draggedPage.current || busy) return
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTarget(id)
          }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(null) }}
          onDrop={event => {
            if (!draggedPage.current || busy) return
            event.preventDefault()
            if (menuFor(draggedPage.current) !== id) changePage(draggedPage.current, id)
            draggedPage.current = null
            setDropTarget(null)
          }}>
          <h4><Icon size={16} aria-hidden="true"/>{label}</h4>
          {id !== 'none' && <label>
            <span>Show menu</span><input type="checkbox" role="switch" aria-label={'Show ' + label + ' menu'} checked={value[id]}
              disabled={busy} onChange={event => edit({ ...value, [id]: event.target.checked })}/>
          </label>}
          {id !== 'none' && <p>{value[id] ? visibleCount + (query.trim() ? ' matching menu pages' : ' menu pages') : 'Menu is off'}</p>}
          {pages.map(([route, title]) => <div className="menu-card" key={route}>
            <div className="menu-card-title">
              <span className="menu-card-grip" draggable={!busy} aria-hidden="true" title="Drag to move"
                onDragStart={event => {
                  draggedPage.current = route
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('application/x-assignment-menu-page', route)
                }}
                onDragEnd={() => { draggedPage.current = null; setDropTarget(null) }}><GripVertical size={14}/></span>
              <strong>{title}</strong>
            </div>
            {!available(route) ? <small>Hidden in Platform visibility</small> : pins.includes(route) && <small>In the top bar until unpinned</small>}
            <select aria-label={'Menu for ' + title} value={id} disabled={busy}
              ref={element => { if (element) pageControls.current.set(route, element); else pageControls.current.delete(route) }}
              onChange={event => {
                changePage(route, event.target.value)
                requestAnimationFrame(() => pageControls.current.get(route)?.focus())
              }}>
              {menuColumns.map(([menu, name]) => <option key={menu} value={menu}>{name}</option>)}
            </select>
          </div>)}
          {!pages.length && <p>{query.trim() ? 'No matching pages.' : 'No pages assigned.'}</p>}
        </div>
      })}
    </div>
    <p>Pages outside the menus can still open through a direct link.</p>
    <div className="navigation-settings-actions">
      <button type="button" disabled={busy || !dirty} onClick={() => save(value)}>{busy ? 'Saving…' : 'Save menus'}</button>
      {dirty && <button type="button" disabled={busy} onClick={() => edit(null)}>Cancel changes</button>}
      <button type="button" disabled={busy || (!dirty && user?.navigationMenus == null)} onClick={() => save(null)}>Restore default menus</button>
    </div>
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </section>
}
