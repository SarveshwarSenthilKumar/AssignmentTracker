import { useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { X, Save, Download, Upload, Trash2, Pen, Highlighter, Eraser, ZoomIn, ZoomOut, RotateCw, Settings, Tag, Folder, Check, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export default function PDFEditor({ pdfId, onClose, token }) {
  const [pdfData, setPdfData] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [annotations, setAnnotations] = useState([])
  const [currentTool, setCurrentTool] = useState('pen')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [editTags, setEditTags] = useState('')
  const [editFolder, setEditFolder] = useState('')
  const [editName, setEditName] = useState('')
  const [pdfFolders, setPdfFolders] = useState([])
  const [savingMetadata, setSavingMetadata] = useState(false)
  const canvasRef = useRef(null)
  const annotationLayerRef = useRef(null)

  useEffect(() => {
    if (pdfId) {
      fetchPDF()
      fetchPDFFolders()
    }
  }, [pdfId])

  const fetchPDF = async () => {
    try {
      const response = await fetch(`/api/pdfs/${pdfId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setPdfData(data)
        setAnnotations(data.annotations || [])
        setEditName(data.name || '')
        setEditTags(data.tags?.join(', ') || '')
        setEditFolder(data.pdfFolder || '')
      }
    } catch (err) {
      console.error('Error fetching PDF:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPDFFolders = async () => {
    try {
      const response = await fetch('/api/pdf-folders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setPdfFolders(data)
      }
    } catch (err) {
      console.error('Error fetching PDF folders:', err)
    }
  }

  const handleSaveMetadata = async () => {
    setSavingMetadata(true)
    try {
      const response = await fetch(`/api/pdfs/${pdfId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          tags: editTags.split(',').map(t => t.trim()).filter(t => t),
          pdfFolder: editFolder
        })
      })
      if (response.ok) {
        const data = await response.json()
        setPdfData(data)
        setShowSettings(false)
      }
    } catch (err) {
      console.error('Error saving metadata:', err)
    } finally {
      setSavingMetadata(false)
    }
  }

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
  }

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3.0))
  }

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleSave = async () => {
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/annotations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ annotations })
      })
      if (response.ok) {
        alert('Annotations saved successfully!')
      }
    } catch (err) {
      console.error('Error saving annotations:', err)
      alert('Failed to save annotations')
    }
  }

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/pdfs/${pdfId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = pdfData?.originalName || 'document.pdf'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (err) {
      console.error('Error downloading PDF:', err)
      alert('Failed to download PDF')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this PDF?')) return
    
    try {
      const response = await fetch(`/api/pdfs/${pdfId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        onClose()
      }
    } catch (err) {
      console.error('Error deleting PDF:', err)
      alert('Failed to delete PDF')
    }
  }

  const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#000000']
  const tools = ['pen', 'highlighter', 'eraser']

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-slate-900 border border-white/10 rounded-2xl p-8">
          <div className="animate-spin text-primary-500 mx-auto">
            <Upload size={40} />
          </div>
          <p className="text-white mt-4 text-center">Loading PDF...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col z-50">
      {/* Header */}
      <div className="bg-slate-900 border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-white font-semibold">{pdfData?.name || 'PDF Editor'}</h2>
          <span className="text-slate-400 text-sm">
            Page {pageNumber} of {numPages}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-all"
            title="PDF Settings"
          >
            <Settings size={20} />
          </button>
          <button
            onClick={handleSave}
            className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-all"
            title="Save Annotations"
          >
            <Save size={20} />
          </button>
          <button
            onClick={handleDownload}
            className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
            title="Download PDF"
          >
            <Download size={20} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Delete PDF"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-all"
            title="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-slate-800 border-b border-white/10 px-4 py-3 flex items-center gap-4">
        {/* Tools */}
        <div className="flex items-center gap-2 bg-slate-700 rounded-lg p-1">
          {tools.map((tool) => (
            <button
              key={tool}
              onClick={() => setCurrentTool(tool)}
              className={cn(
                "p-2 rounded transition-all",
                currentTool === tool ? "bg-primary-600 text-white" : "text-slate-400 hover:text-white hover:bg-slate-600"
              )}
              title={tool.charAt(0).toUpperCase() + tool.slice(1)}
            >
              {tool === 'pen' && <Pen size={18} />}
              {tool === 'highlighter' && <Highlighter size={18} />}
              {tool === 'eraser' && <Eraser size={18} />}
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-2">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={cn(
                "w-6 h-6 rounded-full transition-all",
                currentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : 'hover:scale-110'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Stroke Width */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-sm">Size:</span>
          <input
            type="range"
            min="1"
            max="10"
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
            className="w-20"
          />
          <span className="text-white text-sm">{strokeWidth}px</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={handleZoomOut}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Zoom Out"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-white text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Zoom In"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleRotate}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
            title="Rotate"
          >
            <RotateCw size={18} />
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto bg-slate-950 p-8 flex items-start justify-center">
        {pdfData?.pdfData ? (
          <div className="relative">
            <Document
              file={`data:application/pdf;base64,${btoa(
                new Uint8Array(pdfData.pdfData).reduce((data, byte) => data + String.fromCharCode(byte), '')
              )}`}
              onLoadSuccess={onDocumentLoadSuccess}
              className="shadow-2xl"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotation={rotation}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="border border-white/10"
              />
            </Document>

            {/* Annotation Layer */}
            <div
              ref={annotationLayerRef}
              className="absolute inset-0 pointer-events-none"
              style={{ transform: `scale(${scale}) rotate(${rotation}deg)` }}
            >
              {annotations.map((annotation, idx) => (
                <div
                  key={idx}
                  className="absolute pointer-events-auto cursor-move"
                  style={{
                    left: annotation.x,
                    top: annotation.y,
                    width: annotation.width,
                    height: annotation.height,
                    backgroundColor: annotation.type === 'highlighter' ? `${annotation.color}40` : 'transparent',
                    borderBottom: annotation.type === 'pen' ? `${annotation.strokeWidth}px solid ${annotation.color}` : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-slate-400">No PDF data available</div>
        )}
      </div>

      {/* Page Navigation */}
      <div className="bg-slate-900 border-t border-white/10 px-4 py-3 flex items-center justify-center gap-4">
        <button
          onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
          disabled={pageNumber <= 1}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all"
        >
          Previous
        </button>
        <span className="text-white">
          {pageNumber} / {numPages}
        </span>
        <button
          onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages))}
          disabled={pageNumber >= numPages}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg transition-all"
        >
          Next
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">PDF Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* PDF Name */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">PDF Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Folder Selection */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Folder</label>
                <div className="relative">
                  <select
                    value={editFolder}
                    onChange={(e) => setEditFolder(e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                  >
                    <option value="">Uncategorized</option>
                    {pdfFolders.map((folder) => (
                      <option key={folder._id} value={folder._id}>{folder.name}</option>
                    ))}
                  </select>
                  <Folder size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Tags (comma-separated)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="homework, important, chapter1"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 pl-10"
                  />
                  <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                {pdfData?.tags && pdfData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pdfData.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded-full text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMetadata}
                  disabled={savingMetadata}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {savingMetadata ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
