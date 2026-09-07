import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, X, Loader2, FolderPlus, Folder, LogOut } from 'lucide-react'
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
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState('#0ea5e9')

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

  const toggleTodo = async (id) => {
    try {
      const todo = todos.find(t => t._id === id)
      const response = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ completed: !todo.completed }),
      })
      if (!response.ok) throw new Error('Failed to update todo')
      const updatedTodo = await response.json()
      setTodos(todos.map(t => t._id === id ? updatedTodo : t))
    } catch (err) {
      setError(err.message)
    }
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
          <button
            onClick={logout}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-2"
          >
            <LogOut size={18} />
            <span className="hidden sm:inline">Logout</span>
          </button>
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
              className="flex-1 px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
            <button
              type="submit"
              className="px-6 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Plus size={20} />
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
          <div className="grid grid-cols-2 gap-6">
            {/* Active Tasks */}
            <div>
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                Active Tasks ({filteredTodos.filter(t => !t.completed).length})
              </h2>
              <div className="space-y-3">
                {filteredTodos.filter(t => !t.completed).length > 0 ? (
                  filteredTodos.filter(t => !t.completed).map((todo) => (
                    <div
                      key={todo._id}
                      className="group flex items-center gap-4 p-4 rounded-xl transition-all bg-white/10 border border-white/10 hover:bg-white/15"
                    >
                      <button
                        onClick={() => toggleTodo(todo._id)}
                        className="flex-shrink-0 w-8 h-8 rounded-full border-2 border-slate-400 hover:border-primary-500 flex items-center justify-center transition-all"
                      >
                      </button>

                      <span className="flex-1 text-lg text-white transition-all">
                        {todo.text}
                      </span>

                      <button
                        onClick={() => deleteTodo(todo._id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No active tasks
                  </div>
                )}
              </div>
            </div>

            {/* Completed Tasks */}
            <div>
              <h2 className="text-xl font-semibold text-slate-400 mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Completed ({filteredTodos.filter(t => t.completed).length})
              </h2>
              <div className="space-y-3">
                {filteredTodos.filter(t => t.completed).length > 0 ? (
                  filteredTodos.filter(t => t.completed).map((todo) => (
                    <div
                      key={todo._id}
                      className="group flex items-center gap-4 p-4 rounded-xl transition-all bg-white/5 border border-white/5"
                    >
                      <button
                        onClick={() => toggleTodo(todo._id)}
                        className="flex-shrink-0 w-8 h-8 rounded-full border-2 bg-green-500 border-green-500 text-white flex items-center justify-center transition-all"
                      >
                        <Check size={16} />
                      </button>

                      <span className="flex-1 text-lg text-slate-500 line-through transition-all">
                        {todo.text}
                      </span>

                      <button
                        onClick={() => deleteTodo(todo._id)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    No completed tasks
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {filteredTodos.length > 0 && (
          <div className="mt-6 text-center text-slate-400 text-sm">
            {filteredTodos.filter(t => t.completed).length} of {filteredTodos.length} completed
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
                    placeholder="e.g., Work, Personal, Shopping"
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
      </div>
    </div>
  )
}

export default App
