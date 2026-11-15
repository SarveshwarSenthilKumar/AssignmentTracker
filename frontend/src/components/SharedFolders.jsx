import { useEffect, useState } from 'react'
import { Download, Users } from 'lucide-react'
import { downloadBlob } from '../lib/documentFormats'

const base = '/api/shared-folders'

export default function SharedFolders({ token, selectedFolder }) {
  const [show, setShow] = useState(false)
  const [folders, setFolders] = useState([])
  const [active, setActive] = useState(null)
  const [members, setMembers] = useState(null)
  const [email, setEmail] = useState('')
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
    if (!show) return
    const controller = new AbortController()
    setMembers(null)
    setError('')
    const load = async (path, update) => {
      const response = await request(path, { signal: controller.signal })
      const data = await response.json()
      if (!controller.signal.aborted) update(data)
    }
    Promise.all([load('', setFolders), ownerFolder && load(`/${ownerFolder}/members`, setMembers)])
      .catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [show, ownerFolder, token])

  const run = async operation => {
    if (busy) return
    setBusy(true)
    setError('')
    try { await operation() }
    catch (error) { setError(error.message) }
    finally { setBusy(false) }
  }

  return <section className="library-sharing" aria-label="Document folder sharing">
    <button type="button" aria-expanded={show} onClick={() => setShow(!show)}><Users size={16} aria-hidden="true"/> Shared folders</button>
    {show && <div className="library-sharing-panel">
      {ownerFolder && <section aria-label="Share selected folder">
        <h3>Share this folder</h3>
        <p>Members can download files in this folder. Share subfolders individually.</p>
        <form onSubmit={event => {
          event.preventDefault()
          run(async () => {
            const response = await request(`/${ownerFolder}/members`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
            })
            const member = await response.json()
            setMembers(previous => [...(previous || []).filter(item => item._id !== member._id), member])
            setEmail('')
          })
        }}>
          <label>Account email <input type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}/></label>
          <button type="submit" disabled={busy || members === null}>Grant view access</button>
        </form>
        {members?.length > 0 && <ul>{members.map(member => <li key={member._id}>
          <span>{member.username} ({member.email})</span>
          <button type="button" disabled={busy} aria-label={`Revoke access for ${member.email}`} onClick={() => run(async () => {
            await request(`/${ownerFolder}/members/${member._id}`, { method: 'DELETE' })
            setMembers(previous => previous?.filter(item => item._id !== member._id))
          })}>Revoke</button>
        </li>)}</ul>}
      </section>}
      <section aria-label="Folders shared with me">
        <h3>Shared with me</h3>
        {!folders.length && <p>No folders shared with you.</p>}
        <ul>{folders.map(folder => <li key={folder._id}><button type="button" disabled={busy} onClick={() => run(async () => {
          setActive(null)
          const response = await request(`/${folder._id}`)
          setActive({ ...await response.json(), id: folder._id })
        })}>{folder.name}</button></li>)}</ul>
        {active && <div>
          <h4>{active.name}</h4>
          {!active.files.length && <p>No available documents in this folder.</p>}
          <ul>{active.files.map(file => <li key={file._id}><span>{file.name}</span><button type="button" disabled={busy} onClick={() => run(async () => {
            const response = await request(`/${active.id}/files/${file._id}`)
            await downloadBlob(await response.blob(), file.originalName)
          })}><Download size={15} aria-hidden="true"/> Download</button></li>)}</ul>
        </div>}
      </section>
      {error && <p role="alert" className="library-error">{error}</p>}
    </div>}
  </section>
}
