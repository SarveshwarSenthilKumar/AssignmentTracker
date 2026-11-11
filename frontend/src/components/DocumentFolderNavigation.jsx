import { useId, useState } from 'react'
import { ChevronDown, EyeOff, FilePlus, FileText, Folder, FolderOpen, Library } from 'lucide-react'
import { folderTree } from '../lib/folderHierarchy'
import './DocumentFolderNavigation.css'

const visibilityKey = 'document-folder-navigation-hidden'

export default function DocumentFolderNavigation({ documentId, documents, folders, disabled, onOpenDocument, onOpenFolder, onCreateFile }) {
  const [navigating, setNavigating] = useState(false)
  const menuGroup = useId()
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

  const navigate = async (open, id) => {
    setNavigating(true)
    try {
      await open(id)
    } finally {
      setNavigating(false)
    }
  }

  const unavailable = disabled || navigating
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
          <button type="button" className="document-folder-control" disabled={unavailable} onClick={() => navigate(onOpenFolder, 'all')}>
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
              <button type="button" disabled={unavailable} onClick={() => navigate(onOpenFolder, null)}>
                <Folder size={16} aria-hidden="true" /> Unfiled
              </button>
              {locations.map(location => (
                <button key={location._id} type="button" disabled={unavailable} onClick={() => navigate(onOpenFolder, location._id)}>
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
                  <button key={file._id} type="button" disabled={unavailable} onClick={() => navigate(onOpenDocument, file._id)}>
                    <FileText size={16} aria-hidden="true" /> {file.name}
                  </button>
                ))}
              </div>
            </details>
          )}
          <button type="button" className="document-folder-control document-folder-create" disabled={unavailable || !document} onClick={() => navigate(onCreateFile, folder?._id ?? null)}>
            <FilePlus size={16} aria-hidden="true" /> New file
          </button>
          <button type="button" className="document-folder-control document-folder-hide" aria-label="Hide folder navigation" title="Hide folder navigation" aria-expanded={true} onClick={toggleVisibility}>
            <EyeOff size={16} aria-hidden="true" />
          </button>
        </>
      )}
    </nav>
  )
}
