import { useState, useEffect } from 'react'
import { X, Upload, FileText, Loader2, Tag, Folder } from 'lucide-react'
import { cn } from '../lib/utils'
import OneNoteImport from './OneNoteImport'

export default function PDFUploadModal({ onClose, token, onUploadSuccess, pdfFolders, initialFolder = '' }) {
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfName, setPdfName] = useState('')
  const [selectedFolder, setSelectedFolder] = useState(initialFolder)
  const [tags, setTags] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [oneNoteFile, setOneNoteFile] = useState(null)

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.size <= 10 * 1024 * 1024) {
      setPdfFile(file)
      setPdfName(file.name.replace(/\.[^.]+$/, ''))
      setError('')
      if (/\.(one|onepkg)$/i.test(file.name)) setOneNoteFile(file)
    } else {
      setPdfFile(null)
      setError('Choose a file smaller than 10 MB')
    }
  }

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!pdfFile) {
      setError('Please select a file')
      return
    }

    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('pdfFile', pdfFile)
      formData.append('name', pdfName)
      if (selectedFolder) {
        formData.append('pdfFolderId', selectedFolder)
      }
      if (tags) {
        formData.append('tags', JSON.stringify(tags.split(',').map(t => t.trim()).filter(t => t)))
      }

      const response = await fetch('/api/pdfs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to upload a document')
      }

      const data = await response.json()
      onUploadSuccess(data)
      onClose()
      setPdfFile(null)
      setPdfName('')
      setSelectedFolder('')
      setTags('')
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if(oneNoteFile) return <div className="app-inline-panel document-upload-panel">
    <label className="block text-slate-400 text-sm mb-2">Save notes in
      <select value={selectedFolder} onChange={event=>setSelectedFolder(event.target.value)} className="ml-3 rounded-lg bg-slate-800 p-2 text-white">
        <option value="">Unfiled</option>{pdfFolders.map(folder=><option key={folder._id} value={folder._id}>{folder.name}</option>)}
      </select>
    </label>
    <OneNoteImport initialFile={oneNoteFile} initialTags={tags.split(',').map(tag=>tag.trim()).filter(Boolean)} token={token} folderId={selectedFolder||null} onClose={()=>{setOneNoteFile(null);setPdfFile(null);setPdfName('')}} onCreated={document=>{onUploadSuccess(document);onClose()}}/>
  </div>

  return (
    <div className="app-inline-panel document-upload-panel">
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-bold text-white">Upload document</h3>
          <button
            onClick={onClose}
            aria-label="Close upload panel"
            className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          {/* File Upload */}
          <div>
            <label className="block text-slate-400 text-sm mb-2">Document file</label>
            <div className="relative">
              <input
                type="file"
                accept="*/*"
                onChange={handleFileChange}
                className="hidden"
                id="pdf-upload"
              />
              <label
                htmlFor="pdf-upload"
                className={cn(
                  "flex items-center justify-center gap-3 px-4 py-8 border-2 border-dashed rounded-xl cursor-pointer transition-all",
                  pdfFile ? "border-blue-500 bg-blue-500/10" : "border-slate-600 hover:border-slate-500 hover:bg-slate-800"
                )}
              >
                {pdfFile ? (
                  <>
                    <FileText size={32} className="text-blue-400" />
                    <div className="text-left">
                      <p className="text-white font-medium">{pdfFile.name}</p>
                      <p className="text-slate-400 text-sm">{(pdfFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-slate-400" />
                    <div className="text-center">
                      <p className="text-white font-medium">Click to upload a document</p>
                      <p className="text-slate-400 text-sm">PDF, OneNote (.one / .onepkg), images, DOCX, XLSX, text, code, CSV, and other files · up to 10 MB. OneNote files automatically open the notes importer.</p>
                    </div>
                  </>
                )}
              </label>
            </div>
          </div>

          <button type="button" disabled={uploading} onClick={() => { setPdfFile(new File([''], 'Untitled.txt', { type: 'text/plain' })); setPdfName('Untitled'); setError('') }} className="w-full rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">Create a blank text document</button>
          {/* Document name */}
          <div>
            <label htmlFor="upload-pdfName" className="block text-slate-400 text-sm mb-2">Document name</label>
            <input
              type="text"
              id="upload-pdfName" value={pdfName}
              onChange={(e) => setPdfName(e.target.value)}
              placeholder="My Document"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Folder Selection */}
          <div>
            <label htmlFor="upload-selectedFolder" className="block text-slate-400 text-sm mb-2">Folder (Optional)</label>
            <div className="relative">
              <select
                id="upload-selectedFolder" value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                <option value="">Unfiled</option>
                {pdfFolders.map((folder) => (
                  <option key={folder._id} value={folder._id}>{folder.name}</option>
                ))}
              </select>
              <Folder size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="upload-tags" className="block text-slate-400 text-sm mb-2">Tags (comma-separated)</label>
            <div className="relative">
              <input
                type="text"
                id="upload-tags" value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="homework, important, chapter1"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
              />
              <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div role="alert" className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !pdfFile}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Upload document
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
