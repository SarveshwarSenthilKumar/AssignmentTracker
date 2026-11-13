import { useId, useRef, useState } from 'react'
import { ChevronDown, EyeOff, FilePlus, FileText, Folder, FolderOpen, Library } from 'lucide-react'
import { folderTree } from '../lib/folderHierarchy'
import { createDocument } from '../lib/createDocument'
import { NOTE_TEMPLATES } from '../lib/noteTemplates'
import './DocumentFolderNavigation.css'

const visibilityKey = 'document-folder-navigation-hidden'

export default function DocumentFolderNavigation({ documentId, documents, folders, disabled, onOpenDocument, onOpenFolder, token, onFileCreated }) {
  const [navigating, setNavigating] = useState(false)
  const menuGroup = useId()
  const dialog = useRef(null)
  const creating = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(visibilityKey) === 'true'
    } catch {
      return false
    }
  })

  const toggleVisibility = () => {
    const next = !hidden
    setHidden(next)
    try {
      localStorage.setItem(visibilityKey, String(next))
    } catch {
      // The toggle remains usable when storage is unavailable.
    }
  }

  const locations = folderTree(folders)
  const document = documents.find(file => file._id === documentId)
  const folder = locations.find(location => location._id === document?.pdfFolder)
  const siblings = document ? documents
    .filter(file => !file.deletedAt && (file.pdfFolder || null) === (document.pdfFolder || null))
    .sort((a, b) => a.name.localeCompare(b.name)) : []

  const navigate = async (open, id, event) => {
    setNavigating(true)
    try {
      await open(id, event)
    } finally {
      setNavigating(false)
    }
  }

  const unavailable = disabled || navigating
  const submitFile = async event => {
    event.preventDefault()
    if (creating.current) return
    const fields = new FormData(event.currentTarget)
    const name = fields.get('name').trim()
    if (!name) {
      setError('Enter a file name.')
      return
    }
    const template = NOTE_TEMPLATES.find(item => item.id === fields.get('template')) || NOTE_TEMPLATES[0]
    creating.current = true
    setSaving(true)
    setError('')
    try {
      const file = await createDocument({
        token, name, folderId: folder?._id, content: template.content(name),
        mime: 'text/plain', extension: 'md', tags: ['notes'],
      })
      onFileCreated(file)
      setCreated(file)
      dialog.current?.close()
    } catch (err) {
      setError(err.message)
    } finally {
      creating.current = false
      setSaving(false)
    }
  }
  const closeOnEscape = event => {
    if (event.key !== 'Escape' || !event.currentTarget.open) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.open = false
    event.currentTarget.querySelector('summary').focus()
  }

  return (
    <nav className="document-folder-navigation" aria-label="Document folder navigation">
      {hidden ? (
        <button type="button" className="document-folder-control" aria-expanded={false} onClick={toggleVisibility}>
          <FolderOpen size={16} aria-hidden="true" /> Show folders
        </button>
      ) : (
        <>
          <button type="button" className="document-folder-control" disabled={unavailable} onClick={event => navigate(onOpenFolder, 'all', event)}>
            <Library size={16} aria-hidden="true" /> Documents
          </button>
          <span className="document-folder-divider" aria-hidden="true">/</span>
          <details name={menuGroup} className="document-folder-menu" onKeyDown={closeOnEscape}>
            <summary className="document-folder-control" title={folder?.path}>
              <FolderOpen size={16} aria-hidden="true" />
              <span>{folder?.path || (document ? 'Unfiled' : 'Browse folders')}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </summary>
            <div className="document-folder-options" aria-label="Folders">
              <button type="button" disabled={unavailable} onClick={event => navigate(onOpenFolder, null, event)}>
                <Folder size={16} aria-hidden="true" /> Unfiled
              </button>
              {locations.map(location => (
                <button key={location._id} type="button" disabled={unavailable} onClick={event => navigate(onOpenFolder, location._id, event)}>
                  <Folder size={16} aria-hidden="true" /> {location.path}
                </button>
              ))}
            </div>
          </details>
          {siblings.length > 0 && (
            <details name={menuGroup} className="document-folder-menu document-folder-files" onKeyDown={closeOnEscape}>
              <summary className="document-folder-control">
                <FileText size={16} aria-hidden="true" /> Files in folder <ChevronDown size={14} aria-hidden="true" />
              </summary>
              <div className="document-folder-options" aria-label="Files in folder">
                {siblings.map(file => file._id === documentId ? (
                  <span key={file._id} aria-current="page"><FileText size={16} aria-hidden="true" /> {file.name}</span>
                ) : (
                  <button key={file._id} type="button" disabled={unavailable} onClick={event => navigate(onOpenDocument, file._id, event)}>
                    <FileText size={16} aria-hidden="true" /> {file.name}
                  </button>
                ))}
              </div>
            </details>
          )}
          <button type="button" className="document-folder-control document-folder-create" disabled={unavailable || !document} onClick={() => {
            setError('')
            setCreated(null)
            dialog.current.querySelector('form').reset()
            dialog.current.showModal()
          }}>
            <FilePlus size={16} aria-hidden="true" /> New file
          </button>
          <button type="button" className="document-folder-control document-folder-hide" aria-label="Hide folder navigation" title="Hide folder navigation" aria-expanded={true} onClick={toggleVisibility}>
            <EyeOff size={16} aria-hidden="true" />
          </button>
        </>
      )}
      {created && !hidden && <div className="document-folder-created">
        <span role="status">Created {created.name}</span>
        <button type="button" className="document-folder-control" disabled={unavailable} onClick={event => navigate(onOpenDocument, created._id, event)}>Open file</button>
        <button type="button" className="document-folder-control" onClick={() => setCreated(null)}>Dismiss</button>
      </div>}
      <dialog ref={dialog} className="document-file-dialog" aria-labelledby={`${menuGroup}-create-title`}
        onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }}
        onCancel={event => { if (creating.current) event.preventDefault() }}>
        <form onSubmit={submitFile}>
          <h2 id={`${menuGroup}-create-title`}>New file</h2>
          <p><Folder size={16} aria-hidden="true" /> {folder?.path || 'Unfiled'}</p>
          <label>File name<input name="name" required maxLength={120} autoFocus disabled={saving} /></label>
          <label>Notes template<select name="template" disabled={saving}>
            {NOTE_TEMPLATES.map(template => <option key={template.id} value={template.id}>{template.name}</option>)}
          </select></label>
          {error && <p role="alert">{error}</p>}
          <footer>
            <button type="button" disabled={saving} onClick={() => dialog.current.close()}>Cancel</button>
            <button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create file'}</button>
          </footer>
        </form>
      </dialog>
    </nav>
  )
}
