import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, X, Loader2 } from 'lucide-react'
import { cn } from './lib/utils'

function App() {
  const [todos, setTodos] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchTodos()
  }, [])

  const fetchTodos = async () => {
    try {
      const response = await fetch('/api/todos')
      if (!response.ok) throw new Error('Failed to fetch todos')
      const data = await response.json()
      setTodos(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const addTodo = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    try {
      const response = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input.trim() }),
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
        headers: { 'Content-Type': 'application/json' },
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
      })
      if (!response.ok) throw new Error('Failed to delete todo')
      setTodos(todos.filter(t => t._id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2 tracking-tight">
            Todo App
          </h1>
          <p className="text-slate-400 text-lg">
            Stay organized, get things done
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={addTodo} className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What needs to be done?"
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
        ) : todos.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <p className="text-slate-400 text-lg">No todos yet. Add one above!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Tasks */}
            {todos.filter(t => !t.completed).length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                  Active Tasks ({todos.filter(t => !t.completed).length})
                </h2>
                <div className="space-y-3">
                  {todos.filter(t => !t.completed).map((todo) => (
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
                  ))}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {todos.filter(t => t.completed).length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-400 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Completed ({todos.filter(t => t.completed).length})
                </h2>
                <div className="space-y-3">
                  {todos.filter(t => t.completed).map((todo) => (
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
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {todos.length > 0 && (
          <div className="mt-6 text-center text-slate-400 text-sm">
            {todos.filter(t => t.completed).length} of {todos.length} completed
          </div>
        )}
      </div>
    </div>
  )
}

export default App
