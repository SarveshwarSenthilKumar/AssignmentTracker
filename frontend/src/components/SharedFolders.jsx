import { useEffect, useState } from 'react'
import { Download, FolderOpen, Users } from 'lucide-react'
import { downloadBlob } from '../lib/documentFormats'
import SharedTextEditor from './SharedTextEditor'

const base = '/api/shared-folders'

export default function SharedFolders({ token, selectedFolder, folderName,receivedOnly=false,onShowReceived,refreshKey=0 }) {
  const [panel, setPanel] = useState(receivedOnly?'received':null)
  const [folders, setFolders] = useState([])
  const [active, setActive] = useState(null)
  const [members, setMembers] = useState(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('view')
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ownerFolder = /^[a-f\d]{24}$/i.test(selectedFolder || '') ? selectedFolder : null

  async function request(path, options = {}) {
    const response = await fetch(base + path, {
      ...options, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...options.headers }
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.message || 'Could not access the shared folder.')
    }
    return response
  }

  useEffect(() => {
    if (!panel) return
    const controller = new AbortController()
    setMembers(null)
    setError('')
    const load = async (path, update) => {
      const response = await request(path, { signal: controller.signal })
      const data = await response.json()
      if (!controller.signal.aborted) update(data)
    }
    const pending = panel === 'share' && ownerFolder ? load(`/${ownerFolder}/members`, setMembers) : load('', setFolders)
    pending
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [panel, ownerFolder, token,refreshKey])

  const run = async operation => {
    if (busy) return
    setBusy(true)
    setError('')
    try { await operation() }
    catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }
  const openFolder = id => run(async () => {
    setActive(null)
    const response = await request(`/${id}`)
    setActive({ ...await response.json(), id })
  })
  async function saveAccess(memberEmail, permission) {
    const response = await request(`/${ownerFolder}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: memberEmail, role: permission })
    })
    const member = await response.json()
    setMembers(previous => {
      const list = previous || []
      return list.some(item => item._id === member._id)
        ? list.map(item => item._id === member._id ? member : item)
        : [...list, member]
    })
  }

  const togglePanel = next => {
    setActive(null)
    setPanel(previous => previous === next ? null : next)
  }
  return <section className="library-sharing" aria-label="Document folder sharing">
    {!receivedOnly&&<div className="library-sharing-actions">
      {ownerFolder && <button type="button" className="library-primary" disabled={!!editing} aria-expanded={panel === 'share'} onClick={() => togglePanel('share')}><Users size={16} aria-hidden="true"/> Share folder</button>}
      <button type="button" disabled={!!editing} aria-expanded={panel === 'received'} onClick={() => onShowReceived?onShowReceived():togglePanel('received')}><FolderOpen size={16} aria-hidden="true"/> Shared with me</button>
    </div>}
    {panel && <div className="library-sharing-panel">
      {panel === 'share' && ownerFolder && <section aria-label="Share selected folder">
        <h3>Share {folderName}</h3>
        <p>Members can download files. Editors can also edit Markdown and plain-text files live. Share subfolders individually.</p>
        <button type="button" disabled={busy || !!editing} onClick={() => openFolder(ownerFolder)}>Open collaborative files</button>
        <form onSubmit={event => {
          event.preventDefault()
          run(async () => {
            await saveAccess(email, role)
            setEmail('')
          })
        }}>
          <label>Account email <input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label>
          <label>Permission <select value={role} onChange={event => setRole(event.target.value)}><option value="view">Viewer</option><option value="edit">Editor</option></select></label>
          <button type="submit" disabled={busy || members === null}>Save access</button>
        </form>
        {members?.length > 0 && <ul>{members.map(member => <li key={member._id}>
          <span>{member.username} ({member.email})</span>
          <select aria-label={`Permission for ${member.email}`} value={member.role} disabled={busy} onChange={event => {
            const permission = event.target.value
            run(() => saveAccess(member.email, permission))
          }}>
            <option value="view">Viewer</option>
            <option value="edit">Editor</option>
          </select>
          <button type="button" disabled={busy} aria-label={`Revoke access for ${member.email}`} onClick={() => run(async () => {
            await request(`/${ownerFolder}/members/${member._id}`, { method: 'DELETE' })
            setMembers(previous => previous?.filter(item => item._id !== member._id))
          })}>Revoke</button>
        </li>)}</ul>}
      </section>}
      {panel === 'received' && <section aria-label="Folders shared with me">
        <h3>{receivedOnly?'Shared folders':'Shared with me'}</h3>
        {!folders.length && <p>No folders shared with you.</p>}
        <ul>{folders.map(folder => <li key={folder._id}><button type="button" disabled={busy || !!editing} onClick={() => openFolder(folder._id)}>{folder.name}</button></li>)}</ul>
      </section>}
        {active && <div>
          <h4>{active.name}</h4>
          {!active.files.length && <p>No available documents in this folder.</p>}
          <ul>{active.files.map(file => <li key={file._id}><span>{file.name}</span>{file.canEdit && <button type="button" disabled={!!editing} onClick={() => setEditing(file)}>Edit live</button>}<button type="button" disabled={busy} onClick={() => run(async () => {
            const response = await request(`/${active.id}/files/${file._id}`)
            await downloadBlob(await response.blob(), file.originalName)
          })}><Download size={15} aria-hidden="true"/> Download</button></li>)}</ul>
          {editing && <SharedTextEditor token={token} name={editing.name} url={`${base}/${active.id}/files/${editing._id}/text`} onClose={() => setEditing(null)}/>}
        </div>}
      {error && <p role="alert" className="library-error">{error}</p>}
    </div>}
  </section>
}
