import { useState } from 'react'
import { folderTree } from '../lib/folderHierarchy'
import './DocumentFolderNavigation.css'

export default function DocumentFolderNavigation({ documentId, documents, folders, disabled, onOpenDocument, onOpenFolder }) {
  const [navigating, setNavigating] = useState(false)
  const locations = folderTree(folders)
  const document = documents.find(file => file._id === documentId)
  const folder = locations.find(location => location._id === document?.pdfFolder)
  const siblings = document ? documents
    .filter(file => file._id !== documentId && !file.deletedAt && (file.pdfFolder || null) === (document.pdfFolder || null))
    .sort((a, b) => a.name.localeCompare(b.name)) : []

  const navigate = async (open, id) => {
    setNavigating(true)
    try {
      await open(id)
    } finally {
      setNavigating(false)
    }
  }

  return (
    <nav className="document-folder-navigation" aria-label="Document folder navigation">
      <label>
        Folder
        <select value="" disabled={disabled || navigating} onChange={event => {
          const id = event.target.value
          if (id) navigate(onOpenFolder, id === 'unfiled' ? null : id)
        }}>
          <option value="" disabled>{folder?.path || (document ? 'Unfiled' : 'Browse folders')}</option>
          <option value="all">All documents</option>
          <option value="unfiled">Unfiled</option>
          {locations.map(location => <option key={location._id} value={location._id}>{location.path}</option>)}
        </select>
      </label>
      {siblings.length > 0 && (
        <label>
          Open another document
          <select value="" disabled={disabled || navigating} onChange={event => {
            if (event.target.value) navigate(onOpenDocument, event.target.value)
          }}>
            <option value="" disabled>Choose a file in this folder</option>
            {siblings.map(file => <option key={file._id} value={file._id}>{file.name}</option>)}
          </select>
        </label>
      )}
    </nav>
  )
}
