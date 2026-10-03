import { useState, useRef, useEffect } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { X, Save, Download, Upload, Trash2, Pen, Highlighter, Eraser, ZoomIn, ZoomOut, RotateCw, Settings, Tag, Folder, Check, Loader2, Undo, Type, Move } from 'lucide-react'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { cn } from '../lib/utils'

// Set up PDF.js worker for react-pdf v7
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`

export default function PDFEditor({ pdfId, onClose, token }) {
  const [pdfData, setPdfData] = useState(null)
  const [pdfFile, setPdfFile] = useState(null)
  const [numPages, setNumPages] = useState(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [annotations, setAnnotations] = useState([])
  const [currentTool, setCurrentTool] = useState('pen')
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState('#ef4444')
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [fontSize, setFontSize] = useState(16)
  const [activeTextId, setActiveTextId] = useState(null)
  const [draggingTextId, setDraggingTextId] = useState(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [editTags, setEditTags] = useState('')
  const [editFolder, setEditFolder] = useState('')
  const [editName, setEditName] = useState('')
  const [pdfFolders, setPdfFolders] = useState([])
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [pdfError, setPdfError] = useState(null)
  const [drawingPaths, setDrawingPaths] = useState([])
  const [currentPath, setCurrentPath] = useState([])
  const [pageDimensions, setPageDimensions] = useState({ width: 0, height: 0 })
  const [autoSaving, setAutoSaving] = useState(false)
  const [usePressure, setUsePressure] = useState(true)
  const canvasRef = useRef(null)
  const annotationLayerRef = useRef(null)
  const textareaRef = useRef(null)
  const lastBlurTimeRef = useRef(0)

  useEffect(() => {
    if (pdfId) {
      fetchPDF()
      fetchPDFFolders()
    }
  }, [pdfId])

  // Focus textarea when a text box becomes active
  useEffect(() => {
    if (activeTextId && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [activeTextId])

  // Clean up active text editing when switching away from text tool
  useEffect(() => {
    if (currentTool !== 'text' && activeTextId) {
      handleTextBlur(activeTextId)
    }
  }, [currentTool])

  // Autosave annotations whenever drawingPaths changes
  useEffect(() => {
    const autoSaveTimer = setTimeout(async () => {
      if (drawingPaths.length > 0) {
        setAutoSaving(true)
        try {
          const response = await fetch(`/api/pdfs/${pdfId}/annotations`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ annotations: drawingPaths }),
          })
          if (response.ok) {
            console.log('Annotations auto-saved')
          }
        } catch (err) {
          console.error('Error auto-saving annotations:', err)
        } finally {
          setAutoSaving(false)
        }
      }
    }, 1000) // Wait 1 second after last change before saving

    return () => {
      clearTimeout(autoSaveTimer)
      setAutoSaving(false)
    }
  }, [drawingPaths, pdfId, token])

  const fetchPDF = async () => {
    try {
      console.log('Fetching PDF with ID:', pdfId)
      const response = await fetch(`/api/pdfs/${pdfId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      console.log('Response status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('PDF data received:', { 
          hasData: !!data.pdfData, 
          dataLength: data.pdfData?.length,
          name: data.name 
        })
        setPdfData(data)
        
        // Convert base64 to blob for react-pdf
        if (data.pdfData) {
          try {
            const byteCharacters = atob(data.pdfData)
            const byteNumbers = new Array(byteCharacters.length)
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i)
            }
            const byteArray = new Uint8Array(byteNumbers)
            const blob = new Blob([byteArray], { type: 'application/pdf' })
            const file = new File([blob], data.name || 'document.pdf', { type: 'application/pdf' })
            setPdfFile(file)
            console.log('PDF file created successfully')
          } catch (err) {
            console.error('Error converting base64 to file:', err)
            setPdfError('Failed to process PDF data')
          }
        }
        
        setAnnotations(data.annotations || [])
        setDrawingPaths(data.annotations || [])
        setEditName(data.name || '')
        setEditTags(data.tags?.join(', ') || '')
        setEditFolder(data.pdfFolder || '')
        setPdfError(null)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setPdfError(errorData.message || 'Failed to fetch PDF')
        console.error('PDF fetch error:', errorData)
      }
    } catch (err) {
      console.error('Error fetching PDF:', err)
      setPdfError(err.message || 'Failed to fetch PDF')
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
    console.log('PDF loaded successfully, pages:', numPages)
    setNumPages(numPages)
  }

  const onDocumentLoadError = (error) => {
    console.error('PDF load error:', error)
    setPdfError(`Failed to load PDF: ${error.message || 'Unknown error'}`)
  }

  const onPageLoadSuccess = (page) => {
    console.log('Page loaded successfully', page.width, page.height)
    setPageDimensions({
      width: page.width,
      height: page.height
    })
  }

  const onPageLoadError = (error) => {
    console.error('Page load error:', error)
  }

  const handleColorChange = (color) => {
    setCurrentColor(color)
    if (activeTextId) {
      setDrawingPaths(prev => prev.map(item => 
        item.id === activeTextId ? { ...item, color } : item
      ))
    }
  }

  const handleFontSizeChange = (size) => {
    setFontSize(size)
    if (activeTextId) {
      setDrawingPaths(prev => prev.map(item => 
        item.id === activeTextId ? { ...item, fontSize: size } : item
      ))
    }
  }

  const handleCanvasMouseDown = (e) => {
    if (currentTool === 'eraser') return
    const rect = annotationLayerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (currentTool === 'text') {
      if (e.target.closest('.text-annotation-box')) return

      // If a text box was just blurred within the last 250ms (from clicking outside),
      // ignore this pointerdown so we don't immediately spawn a new text box on the same click.
      if (Date.now() - lastBlurTimeRef.current < 250) {
        return
      }

      if (activeTextId) {
        handleTextBlur(activeTextId)
        return
      }

      const newText = {
        id: Date.now().toString(),
        tool: 'text',
        x,
        y,
        text: '',
        color: currentColor,
        fontSize: fontSize,
        page: pageNumber
      }
      setDrawingPaths(prev => [...prev, newText])
      setActiveTextId(newText.id)
      return
    }

    setIsDrawing(true)
    const pressure = e.pressure || 0.5
    setCurrentPath([{ x, y, pressure }])
  }

  const handleTextChange = (id, text) => {
    setDrawingPaths(prev => prev.map(item => 
      item.id === id ? { ...item, text } : item
    ))
  }

  const handleTextBlur = (id) => {
    lastBlurTimeRef.current = Date.now()
    setDrawingPaths(prev => prev.filter(item => {
      if (item.id === id && item.tool === 'text') {
        return item.text && item.text.trim() !== ''
      }
      return true
    }))
    if (activeTextId === id) {
      setActiveTextId(null)
    }
  }

  const handleDeleteText = (id) => {
    setDrawingPaths(prev => prev.filter(item => item.id !== id))
    if (activeTextId === id) setActiveTextId(null)
  }

  const handleTextDragStart = (e, id) => {
    e.stopPropagation()
    setDraggingTextId(id)
    const rect = annotationLayerRef.current.getBoundingClientRect()
    const targetItem = drawingPaths.find(item => item.id === id)
    if (targetItem) {
      setDragOffset({
        x: e.clientX - rect.left - targetItem.x,
        y: e.clientY - rect.top - targetItem.y
      })
    }
  }

  const handleCanvasMouseMove = (e) => {
    const rect = annotationLayerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (draggingTextId) {
      const newX = Math.max(0, x - dragOffset.x)
      const newY = Math.max(0, y - dragOffset.y)
      setDrawingPaths(prev => prev.map(item => 
        item.id === draggingTextId ? { ...item, x: newX, y: newY } : item
      ))
      return
    }

    if (!isDrawing) return
    const pressure = e.pressure || 0.5
    setCurrentPath(prev => [...prev, { x, y, pressure }])
  }

  const handleCanvasMouseUp = () => {
    if (draggingTextId) {
      setDraggingTextId(null)
    }
    if (!isDrawing) return
    setIsDrawing(false)
    if (currentPath.length > 0) {
      const newPath = {
        points: currentPath,
        color: currentColor,
        strokeWidth: currentTool === 'highlighter' ? strokeWidth * 3 : strokeWidth,
        tool: currentTool,
        page: pageNumber
      }
      setDrawingPaths(prev => [...prev, newPath])
      setCurrentPath([])
    }
  }

  const handleClearCanvas = () => {
    setDrawingPaths([])
    setCurrentPath([])
    setActiveTextId(null)
  }

  const handleDeleteLastPath = () => {
    setDrawingPaths(prev => prev.slice(0, -1))
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
        body: JSON.stringify({ annotations: drawingPaths }),
      })
      if (response.ok) {
        alert('Annotations saved successfully!')
      } else {
        throw new Error('Failed to save annotations')
      }
    } catch (err) {
      console.error('Error saving annotations:', err)
      alert('Failed to save annotations')
    }
  }

  const handleDownload = async () => {
    try {
      // Fetch the original PDF
      const response = await fetch(`/api/pdfs/${pdfId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        throw new Error('Failed to fetch PDF')
      }
      
      const pdfBytes = await response.arrayBuffer()
      
      // If there are annotations, try to burn them in
      if (drawingPaths.length > 0) {
        try {
          const pdfDoc = await PDFDocument.load(pdfBytes)
          const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
          const pages = pdfDoc.getPages()
          
          // Group annotations by page
          const annotationsByPage = {}
          drawingPaths.forEach(path => {
            if (!annotationsByPage[path.page]) {
              annotationsByPage[path.page] = []
            }
            annotationsByPage[path.page].push(path)
          })
          
          // Draw annotations on each page
          for (const [pageNum, paths] of Object.entries(annotationsByPage)) {
            const pageIndex = parseInt(pageNum) - 1
            if (pageIndex >= 0 && pageIndex < pages.length) {
              const page = pages[pageIndex]
              const { width, height } = page.getSize()
              
              // Convert hex color to rgb
              const hexToRgb = (hex) => {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
                return result ? {
                  r: parseInt(result[1], 16) / 255,
                  g: parseInt(result[2], 16) / 255,
                  b: parseInt(result[3], 16) / 255
                } : { r: 0, g: 0, b: 0 }
              }
              
              // Draw each path
              for (const path of paths) {
                if (path.tool === 'text') {
                  if (!path.text || !path.text.trim()) continue
                  const color = hexToRgb(path.color)
                  const fSize = path.fontSize || 16
                  const lines = path.text.split('\n')
                  
                  lines.forEach((lineText, lineIdx) => {
                    if (!lineText) return
                    const textY = height - path.y - fSize - (lineIdx * fSize * 1.2)
                    page.drawText(lineText, {
                      x: path.x,
                      y: textY,
                      size: fSize,
                      font: helveticaFont,
                      color: rgb(color.r, color.g, color.b)
                    })
                  })
                } else if (path.points && path.points.length >= 2) {
                  const color = hexToRgb(path.color)
                  const strokeWidth = path.strokeWidth
                  
                  // Draw the path using line segments
                  for (let i = 0; i < path.points.length - 1; i++) {
                    const start = path.points[i]
                    const end = path.points[i + 1]
                    
                    page.drawLine({
                      start: { x: start.x, y: height - start.y },
                      end: { x: end.x, y: height - end.y },
                      thickness: strokeWidth,
                      color: rgb(color.r, color.g, color.b),
                      opacity: path.tool === 'highlighter' ? 0.3 : 1,
                    })
                  }
                }
              }
            }
          }
          
          // Save the modified PDF
          const pdfBytesModified = await pdfDoc.save()
          const blob = new Blob([pdfBytesModified], { type: 'application/pdf' })
          const url = window.URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = pdfData?.originalName || 'document.pdf'
          document.body.appendChild(a)
          a.click()
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
          console.log('Downloaded PDF with annotations')
          return
        } catch (pdfLibError) {
          console.error('Error burning annotations into PDF:', pdfLibError)
          console.log('Falling back to original PDF download')
        }
      }
      
      // Fallback: download original PDF without annotations
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfData?.originalName || 'document.pdf'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      console.log('Downloaded original PDF')
      
    } catch (err) {
      console.error('Error downloading PDF:', err)
      alert('Failed to download PDF: ' + err.message)
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
  const tools = ['pen', 'highlighter', 'text', 'eraser']

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
          {autoSaving && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <Loader2 className="animate-spin" size={14} />
              <span>Auto-saving...</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDeleteLastPath}
            className="p-2 text-orange-400 hover:bg-orange-500/10 rounded-lg transition-all"
            title="Undo Last Stroke"
          >
            <Undo size={20} />
          </button>
          <button
            onClick={handleClearCanvas}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
            title="Clear All Annotations"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={() => setUsePressure(!usePressure)}
            className={cn(
              "p-2 rounded-lg transition-all",
              usePressure ? "text-green-400 bg-green-500/10" : "text-slate-400 hover:bg-white/10"
            )}
            title="Toggle Pressure Sensitivity"
          >
            <Pen size={20} />
          </button>
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
              {tool === 'text' && <Type size={18} />}
              {tool === 'eraser' && <Eraser size={18} />}
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-2">
          {colors.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={cn(
                "w-6 h-6 rounded-full transition-all",
                currentColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : 'hover:scale-110'
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>

        {/* Stroke / Font Size */}
        {currentTool === 'text' ? (
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-sm">Font Size:</span>
            <input
              type="range"
              min="10"
              max="48"
              value={fontSize}
              onChange={(e) => handleFontSizeChange(parseInt(e.target.value))}
              className="w-20"
            />
            <span className="text-white text-sm">{fontSize}px</span>
          </div>
        ) : (
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
        )}

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
        {pdfError ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-red-400 text-lg">{pdfError}</p>
            <p className="text-slate-400 text-sm mt-2">Please check the console for more details</p>
          </div>
        ) : pdfFile ? (
          <div className="relative">
            <Document
              file={pdfFile}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={<div className="text-white">Loading PDF...</div>}
              error={<div className="text-red-400">Failed to load PDF document</div>}
              className="shadow-2xl"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                rotation={rotation}
                onLoadSuccess={onPageLoadSuccess}
                onLoadError={onPageLoadError}
                loading={<div className="text-white">Loading page...</div>}
                error={<div className="text-red-400">Failed to load page</div>}
                className="border border-white/10"
              />
            </Document>

            {/* Drawing & Text Canvas Overlay */}
            <div
              ref={annotationLayerRef}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'auto',
                cursor: currentTool === 'pen' || currentTool === 'highlighter' ? 'crosshair' : currentTool === 'text' ? 'text' : 'default',
                zIndex: 10,
                touchAction: 'none'
              }}
              onPointerDown={handleCanvasMouseDown}
              onPointerMove={handleCanvasMouseMove}
              onPointerUp={handleCanvasMouseUp}
              onPointerLeave={handleCanvasMouseUp}
            >
              <svg
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none'
                }}
              >
                {drawingPaths
                  .filter(path => path.page === pageNumber && path.points)
                  .map((path, pathIdx) => (
                    <g key={pathIdx}>
                      {path.points.map((p, i) => {
                        if (i === 0) return null
                        const prev = path.points[i - 1]
                        const pointPressure = p.pressure || 0.5
                        const prevPressure = prev.pressure || 0.5
                        const avgPressure = (pointPressure + prevPressure) / 2
                        const dynamicStrokeWidth = usePressure 
                          ? (path.strokeWidth * avgPressure)
                          : path.strokeWidth
                        return (
                          <line
                            key={`${pathIdx}-${i}`}
                            x1={prev.x}
                            y1={prev.y}
                            x2={p.x}
                            y2={p.y}
                            stroke={path.color}
                            strokeWidth={dynamicStrokeWidth}
                            strokeLinecap="round"
                            style={{
                              opacity: path.tool === 'highlighter' ? 0.3 : 1
                            }}
                          />
                        )
                      })}
                    </g>
                  ))}
                {currentPath.length > 0 && (
                  <g>
                    {currentPath.map((p, i) => {
                      if (i === 0) return null
                      const prev = currentPath[i - 1]
                      const pointPressure = p.pressure || 0.5
                      const prevPressure = prev.pressure || 0.5
                      const avgPressure = (pointPressure + prevPressure) / 2
                      const dynamicStrokeWidth = usePressure 
                        ? ((currentTool === 'highlighter' ? strokeWidth * 3 : strokeWidth) * avgPressure)
                        : (currentTool === 'highlighter' ? strokeWidth * 3 : strokeWidth)
                      return (
                        <line
                          key={`current-${i}`}
                          x1={prev.x}
                          y1={prev.y}
                          x2={p.x}
                          y2={p.y}
                          stroke={currentColor}
                          strokeWidth={dynamicStrokeWidth}
                          strokeLinecap="round"
                          style={{
                            opacity: currentTool === 'highlighter' ? 0.3 : 1
                          }}
                        />
                      )
                    })}
                  </g>
                )}
              </svg>

              {/* Text Annotations */}
              {drawingPaths
                .filter(path => path.page === pageNumber && path.tool === 'text')
                .map((path) => {
                  const isActive = activeTextId === path.id
                  return (
                    <div
                      key={path.id || `${path.x}-${path.y}`}
                      style={{
                        position: 'absolute',
                        left: path.x,
                        top: path.y,
                        zIndex: 20
                      }}
                      className="text-annotation-box group"
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {isActive ? (
                        <div className="relative flex flex-col bg-slate-900/90 border border-blue-500 rounded-lg p-1.5 shadow-xl min-w-[150px]">
                          <div
                            className="flex items-center justify-between gap-2 mb-1 cursor-move select-none border-b border-white/10 pb-1"
                            onPointerDown={(e) => handleTextDragStart(e, path.id)}
                          >
                            <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                              <Move size={10} /> Text
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleTextBlur(path.id)
                                }}
                                className="p-0.5 text-green-400 hover:text-green-300 hover:bg-green-500/20 rounded transition-all"
                                title="Done Editing"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteText(path.id)
                                }}
                                className="p-0.5 text-slate-400 hover:text-red-400 rounded transition-all"
                                title="Delete Text"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                          <textarea
                            ref={isActive ? textareaRef : null}
                            value={path.text}
                            onChange={(e) => handleTextChange(path.id, e.target.value)}
                            onBlur={() => handleTextBlur(path.id)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') {
                                handleTextBlur(path.id)
                              } else if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                handleTextBlur(path.id)
                              }
                            }}
                            placeholder="Type text here..."
                            style={{
                              color: path.color,
                              fontSize: `${path.fontSize || 16}px`,
                              lineHeight: 1.2
                            }}
                            className="bg-transparent border-none outline-none text-white w-full resize-none p-0"
                            rows={Math.max(1, (path.text || '').split('\n').length)}
                          />
                        </div>
                      ) : (
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            if (currentTool === 'eraser') {
                              handleDeleteText(path.id)
                            } else if (currentTool === 'text') {
                              setActiveTextId(path.id)
                            }
                          }}
                          style={{
                            color: path.color,
                            fontSize: `${path.fontSize || 16}px`,
                            lineHeight: 1.2
                          }}
                          className={cn(
                            "p-1 rounded whitespace-pre select-none transition-all min-w-[20px]",
                            currentTool === 'text' && "hover:outline hover:outline-1 hover:outline-blue-400 hover:bg-blue-500/10 cursor-pointer",
                            currentTool === 'eraser' && "hover:outline hover:outline-1 hover:outline-red-400 hover:bg-red-500/20 hover:line-through cursor-pointer",
                            currentTool !== 'text' && currentTool !== 'eraser' && "cursor-default"
                          )}
                        >
                          {path.text || <span className="italic opacity-50">Empty text</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
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
