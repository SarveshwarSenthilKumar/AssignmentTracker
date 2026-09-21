import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Check, X, Loader2, FolderPlus, Folder, LogOut, Sparkles, Link2, ChevronDown, ChevronUp, Edit2, Save, User, Trophy, Target, Calendar, ArrowUpDown, RefreshCw, Terminal } from 'lucide-react'
import { cn } from './lib/utils'
import { useAuth } from './contexts/AuthContext'
import Auth from './components/Auth'

function App() {
  const { isAuthenticated, token, logout, user, loading: authLoading } = useAuth()
  const [todos, setTodos] = useState([])
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState('#0ea5e9')
  const [draggedTodo, setDraggedTodo] = useState(null)
  const [celebration, setCelebration] = useState(null)
  const [expandedTodos, setExpandedTodos] = useState(new Set())
  const [editingTodos, setEditingTodos] = useState(new Set())
  const [editData, setEditData] = useState({})
  const editRefs = useRef({})
  const [selectedTask, setSelectedTask] = useState(null)
  const inputRef = useRef(null)
  const commandInputRef = useRef(null)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')
  const [editingFolder, setEditingFolder] = useState(null)
  const [editFolderName, setEditFolderName] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [canvasUrl, setCanvasUrl] = useState('')
  const [canvasToken, setCanvasToken] = useState('')
  const [canvasStatus, setCanvasStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [icsFile, setIcsFile] = useState(null)
  const [dueDate, setDueDate] = useState('')
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const [commandInput, setCommandInput] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      fetchTodos()
      fetchFolders()
      fetchCanvasStatus()
    }
  }, [isAuthenticated])

  // Tab key listener for command menu
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault()
        setShowCommandMenu(true)
        setTimeout(() => commandInputRef.current?.focus(), 0)
      }
      if (e.key === 'Escape' && showCommandMenu) {
        setShowCommandMenu(false)
        setCommandInput('')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showCommandMenu])

  // Click outside to save edit
  useEffect(() => {
    const handleClickOutside = (event) => {
      editingTodos.forEach((id) => {
        const ref = editRefs.current[id]
        if (ref && !ref.contains(event.target)) {
          // Call saveEdit directly here to avoid dependency issues
          const data = editData[id]
          if (data) {
            const linksArray = data.links.split('\n').filter(link => link.trim()).map(link => link.trim())
            
            fetch(`/api/todos/${id}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                text: data.text,
                description: data.description,
                links: linksArray
              }),
            })
            .then(res => {
              if (!res.ok) throw new Error('Failed to update todo')
              return res.json()
            })
            .then(updatedTodo => {
              setTodos(todos.map(t => t._id === id ? updatedTodo : t))
              const newEditing = new Set(editingTodos)
              newEditing.delete(id)
              setEditingTodos(newEditing)
              const newEditData = { ...editData }
              delete newEditData[id]
              setEditData(newEditData)
            })
            .catch(err => setError(err.message))
          }
        }
      })
    }

    if (editingTodos.size > 0) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingTodos, editData, token, todos])

  // Click outside to close task detail modal
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectedTask && event.target.closest('.task-detail-modal') === null) {
        setSelectedTask(null)
      }
    }

    if (selectedTask) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedTask])

  // Click outside to close context menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (contextMenu && !event.target.closest('.context-menu')) {
        setContextMenu(null)
      }
    }

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu])

  // Keyboard shortcut for "/" to focus input
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
        const activeElement = document.activeElement
        const isInputFocused = activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA'
        
        if (!isInputFocused && inputRef.current) {
          event.preventDefault()
          inputRef.current.focus()
          setInput('')
        }
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [])

  const fetchTodos = async () => {
    try {
      const response = await fetch('/api/todos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch todos')
      const data = await response.json()
      setTodos(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchFolders = async () => {
    try {
      const response = await fetch('/api/folders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to fetch folders')
      const data = await response.json()
      setFolders(data)
    } catch (err) {
      setError(err.message)
    }
  }

  const addTodo = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          text: input.trim(), 
          folder: selectedFolder === 'all' ? null : selectedFolder,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null
        }),
      })
      if (!response.ok) throw new Error('Failed to add todo')
      const newTodo = await response.json()
      setTodos([...todos, newTodo])
      setInput('')
      setDueDate('')
    } catch (err) {
      setError(err.message)
    }
  }

  const updateTodoStatus = async (id, newStatus) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!response.ok) throw new Error('Failed to update todo')
      const updatedTodo = await response.json()
      setTodos(todos.map(t => t._id === id ? updatedTodo : t))
      
      // Celebration when completing a task
      if (newStatus === 'completed') {
        triggerCelebration()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const cycleTodoStatus = async (id) => {
    const todo = todos.find(t => t._id === id)
    const statusOrder = ['todo', 'in-progress', 'completed']
    const currentIndex = statusOrder.indexOf(todo.status)
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]
    await updateTodoStatus(id, nextStatus)
  }

  const triggerCelebration = () => {
    const celebrations = ['🎉', '✨', '🌟', '💫', '🎊']
    const randomCelebration = celebrations[Math.floor(Math.random() * celebrations.length)]
    setCelebration(randomCelebration)
    setTimeout(() => setCelebration(null), 1500)
  }

  const handleDragStart = (e, todo) => {
    setDraggedTodo(todo)
    e.dataTransfer.effectAllowed = 'move'
    e.target.style.opacity = '0.5'
  }

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1'
    setDraggedTodo(null)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, newStatus) => {
    e.preventDefault()
    if (draggedTodo && draggedTodo.status !== newStatus) {
      await updateTodoStatus(draggedTodo._id, newStatus)
    }
  }

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedTodos)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedTodos(newExpanded)
  }

  const startEditing = (todo) => {
    setEditingTodos(new Set([...editingTodos, todo._id]))
    setEditData({
      ...editData,
      [todo._id]: {
        text: todo.text,
        description: todo.description || '',
        links: todo.links?.join('\n') || ''
      }
    })
  }

  const cancelEditing = (id) => {
    const newEditing = new Set(editingTodos)
    newEditing.delete(id)
    setEditingTodos(newEditing)
    const newEditData = { ...editData }
    delete newEditData[id]
    setEditData(newEditData)
  }

  const saveEdit = async (id) => {
    const data = editData[id]
    const linksArray = data.links.split('\n').filter(link => link.trim()).map(link => link.trim())
    
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          text: data.text,
          description: data.description,
          links: linksArray,
          dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null
        }),
      })
      if (!response.ok) throw new Error('Failed to update todo')
      const updatedTodo = await response.json()
      setTodos(todos.map(t => t._id === id ? updatedTodo : t))
      cancelEditing(id)
    } catch (err) {
      setError(err.message)
    }
  }

  const getUserStats = () => {
    const total = todos.length
    const completed = todos.filter(t => t.status === 'completed').length
    const inProgress = todos.filter(t => t.status === 'in-progress').length
    const todoCount = todos.filter(t => t.status === 'todo').length
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return { total, completed, inProgress, todoCount, completionRate }
  }

  const openTaskDetail = (todo) => {
    setSelectedTask(todo)
  }

  const getSortedTodos = (todosToSort) => {
    const sorted = [...todosToSort]
    sorted.sort((a, b) => {
      let comparison = 0
      
      if (sortBy === 'createdAt') {
        comparison = new Date(a.createdAt) - new Date(b.createdAt)
      } else if (sortBy === 'dueDate') {
        const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity
        const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity
        comparison = aDue - bDue
      } else if (sortBy === 'completedAt') {
        const aCompleted = a.completedAt ? new Date(a.completedAt).getTime() : 0
        const bCompleted = b.completedAt ? new Date(b.completedAt).getTime() : 0
        comparison = aCompleted - bCompleted
      } else if (sortBy === 'text') {
        comparison = a.text.localeCompare(b.text)
      } else if (sortBy === 'status') {
        const statusOrder = { 'todo': 0, 'in-progress': 1, 'completed': 2 }
        comparison = statusOrder[a.status] - statusOrder[b.status]
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return sorted
  }

  const executeCommand = (cmd) => {
    const parts = cmd.trim().split(' ')
    const command = parts[0].toLowerCase()
    const args = parts.slice(1)
    
    switch (command) {
      case 'help':
        setError('Available commands: help, clear, sort [date/due/name/status], folder [name], all, inbox, del [x]')
        break
      case 'clear':
        setError(null)
        break
      case 'sort':
        if (args[0]) {
          const sortMap = { 'date': 'createdAt', 'due': 'dueDate', 'name': 'text', 'status': 'status' }
          if (sortMap[args[0]]) {
            setSortBy(sortMap[args[0]])
            setError(`Sorted by ${args[0]}`)
          } else {
            setError('Invalid sort option. Use: date, due, name, status')
          }
        }
        break
      case 'folder':
        if (args[0]) {
          const folder = folders.find(f => f.name.toLowerCase() === args[0].toLowerCase())
          if (folder) {
            setSelectedFolder(folder._id)
            setError(`Switched to folder: ${folder.name}`)
          } else {
            setError('Folder not found')
          }
        }
        break
      case 'all':
        setSelectedFolder('all')
        setError('Showing all tasks')
        break
      case 'inbox':
        setSelectedFolder(null)
        setError('Showing inbox')
        break
      case 'del':
        if (args[0] && !isNaN(args[0])) {
          const count = parseInt(args[0])
          if (count > 0) {
            const currentTodos = getSortedTodos(
              selectedFolder === 'all'
                ? todos
                : selectedFolder
                  ? todos.filter(t => t.folder === selectedFolder)
                  : todos.filter(t => !t.folder)
            )
            const toDelete = currentTodos.slice(0, count)
            if (toDelete.length > 0) {
              // Delete all tasks
              Promise.all(toDelete.map(todo => fetch(`/api/todos/${todo._id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
              }))).then(() => {
                fetchTodos()
                setError(`Deleted ${toDelete.length} task(s)`)
              }).catch(err => {
                setError('Error deleting tasks')
              })
            } else {
              setError('No tasks to delete')
            }
          } else {
            setError('Please enter a positive number')
          }
        } else {
          setError('Please specify a number. Usage: del [x]')
        }
        break
      default:
        setError('Unknown command. Type "help" for available commands.')
    }
    
    setShowCommandMenu(false)
    setCommandInput('')
  }

  const handleCommandSubmit = (e) => {
    e.preventDefault()
    if (commandInput.trim()) {
      executeCommand(commandInput)
    }
  }

  const renderTaskCard = (todo, statusColor) => {
    const isExpanded = expandedTodos.has(todo._id)
    const isEditing = editingTodos.has(todo._id)
    const hasDetails = todo.description || (todo.links && todo.links.length > 0)
    const folder = todo.folder ? folders.find(f => f._id === todo.folder) : null

    return (
      <div
        key={todo._id}
        draggable
        onDragStart={(e) => handleDragStart(e, todo)}
        onDragEnd={handleDragEnd}
        className="group"
        ref={(el) => { if (isEditing) editRefs.current[todo._id] = el }}
      >
        <div
          onClick={() => !isEditing && openTaskDetail(todo)}
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl transition-all cursor-grab active:cursor-grabbing",
            statusColor.bg,
            statusColor.border,
            "hover:scale-105 hover:shadow-lg"
          )}
        >
          <button
            onClick={(e) => { e.stopPropagation(); cycleTodoStatus(todo._id) }}
            className={cn(
              "flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
              statusColor.button
            )}
            title="Click to change status"
          >
            {statusColor.icon}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isEditing ? (
                <input
                  type="text"
                  value={editData[todo._id]?.text || todo.text}
                  onChange={(e) => setEditData({
                    ...editData,
                    [todo._id]: { ...editData[todo._id], text: e.target.value }
                  })}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              ) : (
                <span className={cn("text-base transition-all truncate", statusColor.text)}>
                  {todo.text}
                </span>
              )}
              
              {selectedFolder === 'all' && !isEditing && (
                <span
                  className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: folder ? folder.color + '40' : 'rgba(255,255,255,0.1)',
                    color: folder ? folder.color : 'rgba(255,255,255,0.6)',
                    border: folder ? `1px solid ${folder.color}60` : '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  {folder ? folder.name : 'Inbox'}
                </span>
              )}
              
              {hasDetails && !isEditing && (
                <button
                  onClick={(e) => { e.stopPropagation(); toggleExpand(todo._id) }}
                  className="flex-shrink-0 p-1 text-slate-400 hover:text-white transition-all"
                >
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); saveEdit(todo._id) }}
                  className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-all hover:scale-110"
                  title="Save"
                >
                  <Save size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); cancelEditing(todo._id) }}
                  className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-all hover:scale-110"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); startEditing(todo) }}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all hover:scale-110"
                  title="Edit"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTodo(todo._id) }}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all hover:scale-110"
                  title="Delete"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Expanded Details */}
        {(isExpanded || isEditing) && (
          <div className="mt-2 ml-12 p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
            {isEditing ? (
              <>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Description</label>
                  <textarea
                    value={editData[todo._id]?.description || ''}
                    onChange={(e) => setEditData({
                      ...editData,
                      [todo._id]: { ...editData[todo._id], description: e.target.value }
                    })}
                    placeholder="Add a description..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none text-sm"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Links (one per line)</label>
                  <textarea
                    value={editData[todo._id]?.links || ''}
                    onChange={(e) => setEditData({
                      ...editData,
                      [todo._id]: { ...editData[todo._id], links: e.target.value }
                    })}
                    placeholder="https://example.com&#10;https://another-link.com"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-xs"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={editData[todo._id]?.dueDate || ''}
                    onChange={(e) => setEditData({
                      ...editData,
                      [todo._id]: { ...editData[todo._id], dueDate: e.target.value }
                    })}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </>
            ) : (
              <>
                {todo.description && (
                  <p className="text-slate-300 text-xs leading-relaxed">{todo.description}</p>
                )}
                {todo.links && todo.links.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-slate-400 text-xs">
                      <Link2 size={12} />
                      <span>Links</span>
                    </div>
                    {todo.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary-400 hover:text-primary-300 text-xs transition-colors hover:underline"
                      >
                        <Link2 size={10} />
                        {link}
                      </a>
                    ))}
                  </div>
                )}
                {todo.dueDate && (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Calendar size={12} />
                    <span>Due: {new Date(todo.dueDate).toLocaleDateString()}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  const deleteTodo = async (id) => {
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to delete todo')
      setTodos(todos.filter(t => t._id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  const createFolder = async (e) => {
    e.preventDefault()
    if (!newFolderName.trim()) return

    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newFolderName.trim(), color: newFolderColor }),
      })
      if (!response.ok) throw new Error('Failed to create folder')
      const newFolder = await response.json()
      setFolders([...folders, newFolder])
      setNewFolderName('')
      setShowFolderModal(false)
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteFolder = async (id) => {
    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) throw new Error('Failed to delete folder')
      setFolders(folders.filter(f => f._id !== id))
      setTodos(todos.filter(t => t.folder !== id))
      if (selectedFolder === id) setSelectedFolder(null)
      setContextMenu(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const updateFolder = async (id) => {
    try {
      const response = await fetch(`/api/folders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: editFolderName.trim() })
      })
      if (!response.ok) throw new Error('Failed to update folder')
      const updatedFolder = await response.json()
      setFolders(folders.map(f => f._id === id ? updatedFolder : f))
      setEditingFolder(null)
      setEditFolderName('')
    } catch (err) {
      setError(err.message)
    }
  }

  const handleContextMenu = (e, folder, isInbox = false) => {
    e.preventDefault()
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      folder,
      isInbox
    })
  }

  const startEditingFolder = (folder) => {
    setEditingFolder(folder._id)
    setEditFolderName(folder.name)
    setContextMenu(null)
  }

  const clearInbox = async () => {
    try {
      const inboxTodos = todos.filter(t => !t.folder)
      await Promise.all(
        inboxTodos.map(todo =>
          fetch(`/api/todos/${todo._id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        )
      )
      setTodos(todos.filter(t => t.folder))
      setContextMenu(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const fetchCanvasStatus = async () => {
    try {
      const response = await fetch('/api/user/canvas', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        setCanvasStatus(data)
        setCanvasUrl(data.canvasUrl || '')
      }
    } catch (err) {
      console.error('Error fetching Canvas status:', err)
    }
  }

  const saveCanvasCredentials = async (e) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/user/canvas', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ canvasUrl, canvasToken })
      })
      if (!response.ok) throw new Error('Failed to save Canvas credentials')
      await fetchCanvasStatus()
      setShowCanvasModal(false)
      setCanvasToken('')
    } catch (err) {
      setError(err.message)
    }
  }

  const syncCanvas = async () => {
    setSyncing(true)
    try {
      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to sync Canvas')
      }
      const data = await response.json()
      await fetchTodos()
      await fetchCanvasStatus()
      setError(null)
      
      // Show success message
      if (data.errors && data.errors.length > 0) {
        setError(`Synced ${data.syncedCount} items with ${data.errors.length} errors: ${data.errors.join(', ')}`)
      } else {
        setError(`Successfully synced ${data.syncedCount} items from Canvas`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const testCanvasConnection = async () => {
    if (!canvasUrl || !canvasToken) {
      setError('Please enter Canvas URL and token first')
      return
    }
    
    setTesting(true)
    try {
      const response = await fetch('/api/canvas/test', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ canvasUrl, canvasToken })
      })
      const data = await response.json()
      if (data.success) {
        setError(`Canvas connection successful: ${data.response}`)
      } else {
        setError(`Canvas connection failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      setError(`Test failed: ${err.message}`)
    } finally {
      setTesting(false)
    }
  }

  const importCalendar = async (e) => {
    e.preventDefault()
    if (!icsFile) {
      setError('Please select an ICS file')
      return
    }

    setSyncing(true)
    try {
      const formData = new FormData()
      formData.append('icsFile', icsFile)

      const response = await fetch('/api/calendar/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to import calendar')
      }

      const data = await response.json()
      await fetchTodos()
      await fetchFolders()
      setError(`Successfully imported ${data.importedCount} events from calendar`)
      setIcsFile(null)
      setShowCanvasModal(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const filteredTodos = getSortedTodos(
    selectedFolder === 'all'
      ? todos
      : selectedFolder
        ? todos.filter(t => t.folder === selectedFolder)
        : todos.filter(t => !t.folder)
  )

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary-500" size={40} />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Auth />
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="w-[95%] mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
              Todo App
            </h1>
            <p className="text-slate-400 text-sm">
              Stay organized, get things done
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCommandMenu(true)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg"
              title="Command Menu (Press Tab)"
            >
              <Terminal size={18} />
              <span className="hidden sm:inline">Commands</span>
            </button>
            <button
              onClick={() => setShowCanvasModal(true)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-purple-500/30 hover:scale-105"
              title="Canvas Integration"
            >
              <RefreshCw size={18} />
              <span className="hidden sm:inline">Canvas</span>
            </button>
            <button
              onClick={() => setShowProfileModal(true)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-primary-500/30 hover:scale-105"
            >
              <User size={18} />
              <span className="hidden sm:inline">Profile</span>
            </button>
            <button
              onClick={logout}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2"
            >
              <LogOut size={18} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center justify-between">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-all"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Folders Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-white">Folders</h2>
            <button
              onClick={() => setShowFolderModal(true)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2 text-sm"
            >
              <FolderPlus size={16} />
              New Folder
            </button>
          </div>

          {/* Horizontal Folders */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {/* All Tasks */}
            <button
              onClick={() => setSelectedFolder('all')}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-xl transition-all flex items-center gap-2 group text-sm",
                selectedFolder === 'all'
                  ? "bg-gradient-to-r from-primary-600 to-purple-600 text-white shadow-lg"
                  : "bg-white/10 text-slate-400 hover:bg-white/20"
              )}
            >
              <Sparkles size={16} />
              <span className="font-medium">All Tasks</span>
              <span className={cn(
                "px-2 py-0.5 rounded-full text-xs",
                selectedFolder === 'all'
                  ? "bg-white/20 text-white"
                  : "bg-white/10 text-slate-400"
              )}>
                {todos.length}
              </span>
            </button>

            {/* Inbox */}
            <div
              onContextMenu={(e) => handleContextMenu(e, null, true)}
              className="flex-shrink-0"
            >
              <button
                onClick={() => setSelectedFolder(null)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-xl transition-all flex items-center gap-2 group text-sm",
                  selectedFolder === null
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-slate-400"
                )}
              >
                <Folder size={16} />
                <span className="font-medium">Inbox</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs",
                  selectedFolder === null
                    ? "bg-white/20 text-white"
                    : "bg-white/10 text-slate-400"
                )}>
                  {todos.filter(t => !t.folder).length}
                </span>
              </button>
            </div>

            {/* Custom Folders */}
            {folders.map((folder) => (
              <div
                key={folder._id}
                onContextMenu={(e) => handleContextMenu(e, folder)}
                className="flex-shrink-0"
              >
                {editingFolder === folder._id ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10">
                    <Folder size={16} className="text-slate-400" />
                    <input
                      type="text"
                      value={editFolderName}
                      onChange={(e) => setEditFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') updateFolder(folder._id)
                        if (e.key === 'Escape') {
                          setEditingFolder(null)
                          setEditFolderName('')
                        }
                      }}
                      onBlur={() => updateFolder(folder._id)}
                      className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => setSelectedFolder(folder._id)}
                    className={cn(
                      "flex-shrink-0 px-4 py-2 rounded-xl transition-all flex items-center gap-2 group text-sm",
                      selectedFolder === folder._id
                        ? "text-white shadow-lg"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    )}
                    style={{
                      backgroundColor: selectedFolder === folder._id ? folder.color : undefined,
                      boxShadow: selectedFolder === folder._id ? `0 10px 30px -10px ${folder.color}40` : undefined,
                    }}
                  >
                    <Folder size={16} />
                    <span className="font-medium">{folder.name}</span>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs",
                      selectedFolder === folder._id
                        ? "bg-white/20 text-white"
                        : "bg-white/10 text-slate-400"
                    )}>
                      {todos.filter(t => t.folder === folder._id).length}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteFolder(folder._id)
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded transition-all"
                    >
                      <X size={12} />
                    </button>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={addTodo} className="mb-6">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Add task to ${selectedFolder === 'all' ? 'Inbox' : selectedFolder ? folders.find(f => f._id === selectedFolder)?.name : 'Inbox'}...`}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all focus:scale-105 text-sm"
            />
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all hover:scale-110 active:scale-95 flex items-center gap-2 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 text-sm"
            >
              <Plus size={16} className="animate-pulse" />
              Add
            </button>
          </div>
        </form>

        {/* Sort Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown size={16} className="text-slate-400" />
            <span className="text-slate-400 text-sm">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="createdAt">Date Created</option>
              <option value="dueDate">Due Date</option>
              <option value="completedAt">Date Completed</option>
              <option value="text">Name</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-slate-400 hover:text-white"
              title="Toggle sort order"
            >
              {sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary-500" size={40} />
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-slate-400 text-lg">
              {selectedFolder === 'all' ? 'No tasks yet. Add one above!' : selectedFolder ? 'No tasks in this folder yet' : 'No todos yet. Add one above!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Todo Tasks */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'todo')}
              className={cn(
                "transition-all duration-300 rounded-2xl p-3 min-h-[150px]",
                draggedTodo?.status !== 'todo' && "bg-primary-500/10 border-2 border-dashed border-primary-500/30"
              )}
            >
              <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></span>
                To Do ({filteredTodos.filter(t => t.status === 'todo').length})
              </h2>
              <div className="space-y-2">
                {filteredTodos.filter(t => t.status === 'todo').length > 0 ? (
                  filteredTodos.filter(t => t.status === 'todo').map((todo) => 
                    renderTaskCard(todo, {
                      bg: 'bg-white/10',
                      border: 'border border-white/10 hover:bg-white/15',
                      button: 'border-slate-400 hover:border-primary-500',
                      icon: null,
                      text: 'text-white'
                    })
                  )
                ) : (
                  <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl text-sm">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>

            {/* In Progress Tasks */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'in-progress')}
              className={cn(
                "transition-all duration-300 rounded-2xl p-3 min-h-[150px]",
                draggedTodo?.status !== 'in-progress' && "bg-yellow-500/10 border-2 border-dashed border-yellow-500/30"
              )}
            >
              <h2 className="text-base font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                In Progress ({filteredTodos.filter(t => t.status === 'in-progress').length})
              </h2>
              <div className="space-y-2">
                {filteredTodos.filter(t => t.status === 'in-progress').length > 0 ? (
                  filteredTodos.filter(t => t.status === 'in-progress').map((todo) => 
                    renderTaskCard(todo, {
                      bg: 'bg-yellow-500/10',
                      border: 'border border-yellow-500/20 hover:bg-yellow-500/15',
                      button: 'border-yellow-500 hover:border-yellow-400',
                      icon: <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse" />,
                      text: 'text-white'
                    })
                  )
                ) : (
                  <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl text-sm">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>

            {/* Completed Tasks */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'completed')}
              className={cn(
                "transition-all duration-300 rounded-2xl p-3 min-h-[150px]",
                draggedTodo?.status !== 'completed' && "bg-green-500/10 border-2 border-dashed border-green-500/30"
              )}
            >
              <h2 className="text-base font-semibold text-green-400 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Completed ({filteredTodos.filter(t => t.status === 'completed').length})
              </h2>
              <div className="space-y-2">
                {filteredTodos.filter(t => t.status === 'completed').length > 0 ? (
                  filteredTodos.filter(t => t.status === 'completed').map((todo) => 
                    renderTaskCard(todo, {
                      bg: 'bg-green-500/10',
                      border: 'border border-green-500/20 hover:bg-green-500/15',
                      button: 'bg-green-500 border-green-500 text-white hover:bg-green-600',
                      icon: <Check size={16} />,
                      text: 'text-slate-400 line-through'
                    })
                  )
                ) : (
                  <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl text-sm">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {filteredTodos.length > 0 && (
          <div className="mt-6 text-center text-slate-400 text-sm">
            {filteredTodos.filter(t => t.status === 'completed').length} of {filteredTodos.length} completed
          </div>
        )}

        {/* Celebration Overlay */}
        {celebration && (
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
            <div className="text-9xl animate-bounce">{celebration}</div>
          </div>
        )}

        {/* Folder Modal */}
        {showFolderModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-2xl font-bold text-white mb-4">Create New Folder</h3>
              <form onSubmit={createFolder}>
                <div className="mb-4">
                  <label className="block text-slate-400 mb-2 text-sm">Folder Name</label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="My Awesome Folder"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>
                <div className="mb-6">
                  <label className="block text-slate-400 mb-2 text-sm">Folder Color</label>
                  <div className="flex gap-3">
                    {['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewFolderColor(color)}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all",
                          newFolderColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : 'hover:scale-110'
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowFolderModal(false)}
                    className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all"
                  >
                    Create Folder
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Profile Modal */}
        {showProfileModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Your Profile</h3>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-xl">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">{user?.username}</h4>
                  <p className="text-slate-400 text-sm">{user?.email}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-1">
                    <Target size={16} />
                    <span>Total Tasks</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{getUserStats().total}</p>
                </div>
                <div className="p-4 bg-green-500/10 rounded-xl border border-green-500/20">
                  <div className="flex items-center gap-2 text-green-400 text-sm mb-1">
                    <Trophy size={16} />
                    <span>Completed</span>
                  </div>
                  <p className="text-3xl font-bold text-green-400">{getUserStats().completed}</p>
                </div>
                <div className="p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                  <div className="flex items-center gap-2 text-yellow-400 text-sm mb-1">
                    <Sparkles size={16} />
                    <span>In Progress</span>
                  </div>
                  <p className="text-3xl font-bold text-yellow-400">{getUserStats().inProgress}</p>
                </div>
                <div className="p-4 bg-primary-500/10 rounded-xl border border-primary-500/20">
                  <div className="flex items-center gap-2 text-primary-400 text-sm mb-1">
                    <Calendar size={16} />
                    <span>To Do</span>
                  </div>
                  <p className="text-3xl font-bold text-primary-400">{getUserStats().todoCount}</p>
                </div>
              </div>

              {/* Completion Rate */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-400 text-sm">Completion Rate</span>
                  <span className="text-white font-bold">{getUserStats().completionRate}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-primary-500 to-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${getUserStats().completionRate}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => setShowProfileModal(false)}
                className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Canvas Integration Modal */}
        {showCanvasModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Import Calendar</h3>
                <button
                  onClick={() => setShowCanvasModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={importCalendar} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">ICS Calendar File</label>
                  <input
                    type="file"
                    accept=".ics"
                    onChange={(e) => setIcsFile(e.target.files[0])}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                  <p className="text-slate-500 text-xs mt-1">
                    Export your Canvas calendar as an ICS file from Canvas → Calendar → Export
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={syncing}
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-xl transition-all font-medium flex items-center justify-center gap-2"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Importing...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={18} />
                      Import Calendar
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-slate-400 text-xs text-center">
                  To export your Canvas calendar: Go to Canvas → Calendar → Export Calendar
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Command Menu */}
        {showCommandMenu && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Command Menu</h3>
                <button
                  onClick={() => setShowCommandMenu(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCommandSubmit} className="space-y-4">
                <div>
                  <label className="block text-slate-400 text-sm mb-2">Enter Command</label>
                  <input
                    ref={commandInputRef}
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    placeholder="Type 'help' for available commands"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    autoComplete="off"
                  />
                </div>

                <div className="bg-white/5 rounded-xl p-4">
                  <p className="text-slate-400 text-xs mb-2 font-medium">Available Commands:</p>
                  <ul className="text-slate-300 text-xs space-y-1">
                    <li><code className="text-purple-400">help</code> - Show all commands</li>
                    <li><code className="text-purple-400">clear</code> - Clear error messages</li>
                    <li><code className="text-purple-400">sort [date/due/name/status]</code> - Sort tasks</li>
                    <li><code className="text-purple-400">folder [name]</code> - Switch to folder</li>
                    <li><code className="text-purple-400">all</code> - Show all tasks</li>
                    <li><code className="text-purple-400">inbox</code> - Show inbox</li>
                    <li><code className="text-purple-400">del [x]</code> - Delete last x tasks</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl transition-all font-medium"
                >
                  Execute
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Task Detail Modal */}
        {selectedTask && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="task-detail-modal bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Task Details</h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Task Title */}
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Task Name</label>
                <p className="text-xl text-white font-medium">{selectedTask.text}</p>
              </div>

              {/* Status */}
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Status</label>
                <div className="flex gap-2">
                  {['todo', 'in-progress', 'completed'].map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        updateTodoStatus(selectedTask._id, status)
                        setSelectedTask({ ...selectedTask, status })
                      }}
                      className={cn(
                        "px-4 py-2 rounded-lg transition-all text-sm font-medium",
                        selectedTask.status === status
                          ? status === 'todo' && 'bg-primary-600 text-white'
                          || status === 'in-progress' && 'bg-yellow-500 text-white'
                          || status === 'completed' && 'bg-green-500 text-white'
                          : 'bg-white/10 text-slate-400 hover:bg-white/20'
                      )}
                    >
                      {status === 'todo' && 'To Do'}
                      {status === 'in-progress' && 'In Progress'}
                      {status === 'completed' && 'Completed'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Description</label>
                <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                  {selectedTask.description || 'No description'}
                </p>
              </div>

              {/* Due Date */}
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Due Date</label>
                <p className="text-slate-300 text-sm">
                  {selectedTask.dueDate 
                    ? new Date(selectedTask.dueDate).toLocaleDateString() + ' at ' + new Date(selectedTask.dueDate).toLocaleTimeString()
                    : 'No due date'}
                </p>
              </div>

              {/* Links */}
              {selectedTask.links && selectedTask.links.length > 0 && (
                <div className="mb-6">
                  <label className="block text-slate-400 text-sm mb-2">Links</label>
                  <div className="space-y-2">
                    {selectedTask.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm transition-colors hover:underline"
                      >
                        <Link2 size={14} />
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Created Date */}
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Created</label>
                <p className="text-slate-300 text-sm">
                  {new Date(selectedTask.createdAt).toLocaleDateString()} at {new Date(selectedTask.createdAt).toLocaleTimeString()}
                </p>
              </div>

              {/* Completed Date */}
              {selectedTask.completedAt && (
                <div className="mb-6">
                  <label className="block text-slate-400 text-sm mb-2">Completed</label>
                  <p className="text-green-400 text-sm">
                    {new Date(selectedTask.completedAt).toLocaleDateString()} at {new Date(selectedTask.completedAt).toLocaleTimeString()}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedTask(null)
                    startEditing(selectedTask)
                  }}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Edit2 size={18} />
                  Edit
                </button>
                <button
                  onClick={() => {
                    deleteTodo(selectedTask._id)
                    setSelectedTask(null)
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="context-menu fixed bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 py-1 min-w-[150px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y
            }}
          >
            {contextMenu.isInbox ? (
              <button
                onClick={clearInbox}
                className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
              >
                <Trash2 size={14} />
                Clear Inbox
              </button>
            ) : (
              <>
                <button
                  onClick={() => startEditingFolder(contextMenu.folder)}
                  className="w-full px-4 py-2 text-left text-sm text-white hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Edit2 size={14} />
                  Rename
                </button>
                <button
                  onClick={() => deleteFolder(contextMenu.folder._id)}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

export default App
