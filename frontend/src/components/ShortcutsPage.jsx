import { useState } from 'react'
import { Keyboard, Search } from 'lucide-react'
import { SHORTCUTS } from '../lib/shortcuts'
export default function ShortcutsPage() {
  const [query, setQuery] = useState('')
  const scopes = [...new Set(SHORTCUTS.map(shortcut => shortcut.scope))]
  return <section className="shortcuts-page" aria-label="Keyboard shortcuts"><div className="page-heading"><Keyboard size={22}/><div><h2>Keyboard shortcuts</h2><p>Navigate the workspace and act on your files without leaving the keyboard.</p></div></div>
    <p className="shortcut-note">Shortcuts apply to the page or editor you’re using. Navigation and letter shortcuts are paused while typing. Esc cancels inline confirmations. Save and download work inside editors. Tab and Shift + Tab always move focus normally. Enter activates the focused control; Enter submits the new-task form. Text fields keep their standard typing and undo shortcuts.</p>
    <label className="shortcut-search"><Search size={17}/><input aria-label="Search keyboard shortcuts" placeholder="Search actions or key combinations" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="shortcut-sections">{scopes.map(scope=>{const items=SHORTCUTS.filter(item=>item.scope===scope&&`${item.label} ${item.keys} ${scope}`.toLowerCase().includes(query.toLowerCase()));return items.length?<section key={scope}><h3>{scope}</h3><dl>{items.map(item=><div key={item.id}><dt>{item.label}</dt><dd><kbd>{item.keys}</kbd></dd></div>)}</dl></section>:null})}</div>
    {!SHORTCUTS.some(item=>`${item.label} ${item.keys} ${item.scope}`.toLowerCase().includes(query.toLowerCase()))&&<p className="shortcut-note">No shortcuts match this search.</p>}
  </section>
}
