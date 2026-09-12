import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, X, Loader2, FolderPlus, Folder, LogOut, Sparkles, Link2, ChevronDown, ChevronUp, Edit2, Save, User, Trophy, Target, Calendar } from 'lucide-react'
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

  useEffect(() => {
    if (isAuthenticated) {
      fetchTodos()
      fetchFolders()
    }
  }, [isAuthenticated])

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
        body: JSON.stringify({ text: input.trim(), folder: selectedFolder }),
      })
      if (!response.ok) throw new Error('Failed to add todo')
      const newTodo = await response.json()
      setTodos([...todos, newTodo])
      setInput('')
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
          links: linksArray
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

  const renderTaskCard = (todo, statusColor) => {
    const isExpanded = expandedTodos.has(todo._id)
    const isEditing = editingTodos.has(todo._id)
    const hasDetails = todo.description || (todo.links && todo.links.length > 0)

    return (
      <div
        key={todo._id}
        draggable
        onDragStart={(e) => handleDragStart(e, todo)}
        onDragEnd={handleDragEnd}
        className="group"
      >
        <div
          className={cn(
            "flex items-center gap-4 p-4 rounded-xl transition-all cursor-grab active:cursor-grabbing",
            statusColor.bg,
            statusColor.border,
            "hover:scale-105 hover:shadow-lg"
          )}
        >
          <button
            onClick={() => cycleTodoStatus(todo._id)}
            className={cn(
              "flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110",
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
                  className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              ) : (
                <span className={cn("text-lg transition-all truncate", statusColor.text)}>
                  {todo.text}
                </span>
              )}
              
              {hasDetails && !isEditing && (
                <button
                  onClick={() => toggleExpand(todo._id)}
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
                  onClick={() => saveEdit(todo._id)}
                  className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-all hover:scale-110"
                  title="Save"
                >
                  <Save size={18} />
                </button>
                <button
                  onClick={() => cancelEditing(todo._id)}
                  className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-all hover:scale-110"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => startEditing(todo)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all hover:scale-110"
                  title="Edit"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={() => deleteTodo(todo._id)}
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
          <div className="mt-2 ml-16 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
            {isEditing ? (
              <>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Description</label>
                  <textarea
                    value={editData[todo._id]?.description || ''}
                    onChange={(e) => setEditData({
                      ...editData,
                      [todo._id]: { ...editData[todo._id], description: e.target.value }
                    })}
                    placeholder="Add a description..."
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-sm mb-1">Links (one per line)</label>
                  <textarea
                    value={editData[todo._id]?.links || ''}
                    onChange={(e) => setEditData({
                      ...editData,
                      [todo._id]: { ...editData[todo._id], links: e.target.value }
                    })}
                    placeholder="https://example.com&#10;https://another-link.com"
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-sm"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                {todo.description && (
                  <p className="text-slate-300 text-sm leading-relaxed">{todo.description}</p>
                )}
                {todo.links && todo.links.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <Link2 size={14} />
                      <span>Links</span>
                    </div>
                    {todo.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary-400 hover:text-primary-300 text-sm transition-colors hover:underline"
                      >
                        <Link2 size={12} />
                        {link}
                      </a>
                    ))}
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
    } catch (err) {
      setError(err.message)
    }
  }

  const filteredTodos = selectedFolder
    ? todos.filter(t => t.folder === selectedFolder)
    : todos.filter(t => !t.folder)

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
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="text-center">
            <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
              Todo App
            </h1>
            <p className="text-slate-400 text-lg">
              Stay organized, get things done
            </p>
          </div>
          <div className="flex items-center gap-3">
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
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Folders Section */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Folders</h2>
            <button
              onClick={() => setShowFolderModal(true)}
              className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2"
            >
              <FolderPlus size={18} />
              New Folder
            </button>
          </div>

          {/* Horizontal Folders */}
          <div className="flex gap-3 overflow-x-auto pb-2">
            {/* All Tasks (Inbox) */}
            <button
              onClick={() => setSelectedFolder(null)}
              className={cn(
                "flex-shrink-0 px-6 py-3 rounded-xl transition-all flex items-center gap-3",
                selectedFolder === null
                  ? "bg-primary-600 text-white shadow-lg shadow-primary-500/30"
                  : "bg-white/5 text-slate-400 hover:bg-white/10"
              )}
            >
              <Folder size={20} />
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

            {/* Custom Folders */}
            {folders.map((folder) => (
              <button
                key={folder._id}
                onClick={() => setSelectedFolder(folder._id)}
                className={cn(
                  "flex-shrink-0 px-6 py-3 rounded-xl transition-all flex items-center gap-3 group",
                  selectedFolder === folder._id
                    ? "text-white shadow-lg"
                    : "bg-white/5 text-slate-400 hover:bg-white/10"
                )}
                style={{
                  backgroundColor: selectedFolder === folder._id ? folder.color : undefined,
                  boxShadow: selectedFolder === folder._id ? `0 10px 30px -10px ${folder.color}40` : undefined,
                }}
              >
                <Folder size={20} />
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
                  <X size={14} />
                </button>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={addTodo} className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Add task to ${selectedFolder ? folders.find(f => f._id === selectedFolder)?.name : 'Inbox'}...`}
              className="flex-1 px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all focus:scale-105"
            />
            <button
              type="submit"
              className="px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all hover:scale-110 active:scale-95 flex items-center gap-2 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50"
            >
              <Plus size={20} className="animate-pulse" />
              Add
            </button>
          </div>
        </form>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary-500" size={40} />
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-slate-400 text-lg">
              {selectedFolder ? 'No tasks in this folder yet' : 'No todos yet. Add one above!'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* Todo Tasks */}
            <div
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, 'todo')}
              className={cn(
                "transition-all duration-300 rounded-2xl p-4",
                draggedTodo?.status !== 'todo' && "bg-primary-500/10 border-2 border-dashed border-primary-500/30"
              )}
            >
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-pulse"></span>
                To Do ({filteredTodos.filter(t => t.status === 'todo').length})
              </h2>
              <div className="space-y-3">
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
                  <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
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
                "transition-all duration-300 rounded-2xl p-4",
                draggedTodo?.status !== 'in-progress' && "bg-yellow-500/10 border-2 border-dashed border-yellow-500/30"
              )}
            >
              <h2 className="text-xl font-semibold text-yellow-400 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                In Progress ({filteredTodos.filter(t => t.status === 'in-progress').length})
              </h2>
              <div className="space-y-3">
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
                  <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
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
                "transition-all duration-300 rounded-2xl p-4",
                draggedTodo?.status !== 'completed' && "bg-green-500/10 border-2 border-dashed border-green-500/30"
              )}
            >
              <h2 className="text-xl font-semibold text-green-400 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                Completed ({filteredTodos.filter(t => t.status === 'completed').length})
              </h2>
              <div className="space-y-3">
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
                  <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
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
      </div>
    </div>
  )
}

export default App
