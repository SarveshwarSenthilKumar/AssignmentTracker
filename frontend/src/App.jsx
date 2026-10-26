import StudyPhoneSettings from './components/StudyPhoneSettings'
import StudyPhone from './components/StudyPhone'
import {FolderDescriptionInput} from './components/FolderDescription'
import TaskDisplaySettings from './components/TaskDisplaySettings'
import StudyPage from './components/StudyPage'
import AccountConnections from './components/AccountConnections'
import AccountAIAccess from './components/AccountAIAccess'
import ResumesPage from './components/ResumesPage'
import JobsPage from './components/JobsPage'
import CoverLettersPage from './components/CoverLettersPage'
import HomePage from './components/HomePage'
import AppNavigation from './components/AppNavigation'
import GlobalSearch from './components/GlobalSearch'
import {closeEditorForNavigation} from './lib/editorBridge'
import {folderTree} from './lib/folderHierarchy'
import FolderHierarchyControls from './components/FolderHierarchyControls'
import FolderParentSelect from './components/FolderParentSelect'
import TaskDeletionUndo, { notifyTaskDeletion } from './components/TaskDeletionUndo'
import TimeZoneSettings from './components/TimeZoneSettings'

import useTaskPointerDrag from './hooks/useTaskPointerDrag'
import ConfirmationSettings from './components/ConfirmationSettings'
import { readApiJson } from './lib/apiResponse'
import AccountAISettings from './components/AccountAISettings'
import WorkflowWorkspace from './components/WorkflowWorkspace'
import AssistantChat from './components/AssistantChat'
import { SHORTCUTS, matchesShortcut } from './lib/shortcuts'
import { localToInstant, zonedLocal } from './lib/timeZone'
import { taskDueLabel } from './lib/calendar'
import CalendarPage from './components/CalendarPage'
import TaskDependencies from './components/TaskDependencies'
import { dependencySummary } from './lib/taskDependencies'
import TaskVisualization from './components/TaskVisualization'
import AccountReset from './components/AccountReset'
import TaskAttachments, { TaskDescription } from './components/TaskAttachments'
import { documentTaskIds } from './lib/taskAttachments'
import useInlineConfirm from './hooks/useInlineConfirm'
import InlineConfirmation from './components/InlineConfirmation'
import useShortcuts from './hooks/useShortcuts'
import ShortcutsPage from './components/ShortcutsPage'
import './Navigation.css'
import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Check, X, Loader2, FolderPlus, Folder, LogOut, Sparkles, Link2, ChevronDown, ChevronUp, Edit2, Save, User, Trophy, Target, Calendar, ArrowUpDown, RefreshCw, Terminal, ChevronRight, FileText, Keyboard } from 'lucide-react'
import { cn } from './lib/utils'
import { useAuth } from './contexts/AuthContext'
import Auth from './components/Auth'
import DocumentLibrary from './components/DocumentLibrary'
import DocumentEditor from './components/DocumentEditor'
import PDFUploadModal from './components/PDFUploadModal'

function App() {
  const { isAuthenticated, token, logout, user, loading: authLoading } = useAuth()
  const showInProgressColumn=user?.showInProgressColumn!==false
  const taskConfirmation = useInlineConfirm('tasks')
  const deletingTaskIds=useRef(new Set())
  const readPage = () => {
    const route = window.location.hash.replace(/^#\/?/, '').split('/')[0]
    return ['home','study','tasks','calendar','documents','visualization','canvas','account','shortcuts','assistant','workspace','resumes','jobs','cover-letters'].includes(route) ? route : 'home'
  }
  const pendingLibraryTask = useRef(null)
  const [page, setPage] = useState(readPage)
  const [editorAssistantHost,setEditorAssistantHost]=useState(null)
  const [assistantRouteId,setAssistantRouteId]=useState(()=>window.location.hash.match(/^#\/assistant\/([a-f\d]{24})$/i)?.[1]||null)
  const navigate = next => { if(next==='assistant')setAssistantRouteId(null); window.location.hash = `/${next}`; setPage(next); setShowCommandMenu(false); window.scrollTo({top:0}) }
  useEffect(() => { const change = () => { setPage(readPage()); setAssistantRouteId(window.location.hash.match(/^#\/assistant\/([a-f\d]{24})$/i)?.[1]||null); setShowCommandMenu(false); setContextMenu(null); setSelectedTask(pendingLibraryTask.current); pendingLibraryTask.current = null; setShowFolderModal(false); window.scrollTo({top:0}) }; window.addEventListener('hashchange',change); return () => window.removeEventListener('hashchange',change) }, [])
  const [todos, setTodos] = useState([])
  const [selectedTaskIds,setSelectedTaskIds]=useState(new Set())
  const [bulkDeleting,setBulkDeleting]=useState(false)
  const bulkDeleteLock=useRef(false)
  const toggleTaskSelection=id=>setSelectedTaskIds(previous=>{const next=new Set(previous);next.has(id)?next.delete(id):next.add(id);return next})
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null)
  useEffect(()=>{setSelectedTaskIds(new Set())},[selectedFolder,token])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showFolderModal, setShowFolderModal] = useState(false)
  useEffect(()=>{if(showFolderModal)setNewFolderParent(selectedFolder&&selectedFolder!=='all'?selectedFolder:null)},[showFolderModal,selectedFolder])
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderDescription,setNewFolderDescription]=useState('')
  useEffect(()=>{if(showFolderModal)setNewFolderDescription('')},[showFolderModal])
  const [newFolderParent,setNewFolderParent]=useState(null)
  const [newFolderColor, setNewFolderColor] = useState('#64788b')


  const [expandedTodos, setExpandedTodos] = useState(new Set())
  const [editingTodos, setEditingTodos] = useState(new Set())
  const [editData, setEditData] = useState({})
  const editRefs = useRef({})
  const [selectedTask, setSelectedTask] = useState(null)
  const [searchJobId,setSearchJobId]=useState(null),[searchCategoryId,setSearchCategoryId]=useState(null),[searchShortcutsQuery,setSearchShortcutsQuery]=useState('')
  const [searchLibraryTarget,setSearchLibraryTarget]=useState(null)
  const inputRef = useRef(null)
  const commandInputRef = useRef(null)
  const [sortBy, setSortBy] = useState('manual')
  const [showFullTaskTitles,setShowFullTaskTitles]=useState(()=>{try{return localStorage.getItem('tasks-show-full-titles')==='true'}catch{return false}})
  useEffect(()=>{try{localStorage.setItem('tasks-show-full-titles',String(showFullTaskTitles))}catch{}},[showFullTaskTitles])
  const [reordering,setReordering]=useState(false)
  const reorderLock=useRef(false)
  const [sortOrder, setSortOrder] = useState('desc')
  const [editingFolder, setEditingFolder] = useState(null)
  const [editFolderName, setEditFolderName] = useState('')
  const [contextMenu, setContextMenu] = useState(null)
  const [showCanvasModal, setShowCanvasModal] = useState(false)
  const [canvasUrl, setCanvasUrl] = useState('')
  const [canvasToken, setCanvasToken] = useState('')
  const [canvasStatus, setCanvasStatus] = useState(null)
  const [canvasNotice, setCanvasNotice] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [icsFile, setIcsFile] = useState(null)
  const [dueDate, setDueDate] = useState('')
  const [showCommandMenu, setShowCommandMenu] = useState(false)
  const [commandInput, setCommandInput] = useState('')
  const [errorDetails, setErrorDetails] = useState(null)
  const [showErrorDetails, setShowErrorDetails] = useState(false)
  const [showPDFUploadModal, setShowPDFUploadModal] = useState(false)
  const [selectedPDF, setSelectedPDF] = useState(null)
  const [pdfs, setPdfs] = useState([])
  const [pdfFolders, setPdfFolders] = useState([])
  const [selectedPDFFolder, setSelectedPDFFolder] = useState('all')
  const [assistantOpen,setAssistantOpen]=useState(false),[assistantGeneration,setAssistantGeneration]=useState(0),[assistantCalendarId,setAssistantCalendarId]=useState(null)
  useEffect(()=>{
    if(!isAuthenticated){setAssistantOpen(false);return}
    const shortcut=SHORTCUTS.find(item=>item.id==='assistant-toggle')
    const listener=event=>{
      if(event.repeat||event.isComposing)return
      if(matchesShortcut(event,SHORTCUTS.find(item=>item.id==='nav-workspace'))){event.preventDefault();event.stopImmediatePropagation();setAssistantOpen(false);navigate('workspace');return}
      if(matchesShortcut(event,SHORTCUTS.find(item=>item.id==='nav-assistant'))){event.preventDefault();event.stopImmediatePropagation();setAssistantOpen(false);navigate('assistant');return}
      if(matchesShortcut(event,shortcut)){event.preventDefault();event.stopImmediatePropagation();if(page==='assistant'&&!selectedPDF)document.getElementById('assistant-question')?.focus();else setAssistantOpen(previous=>!previous)}
    }
    window.addEventListener('keydown',listener,true);return()=>window.removeEventListener('keydown',listener,true)
  },[isAuthenticated,page,selectedPDF])
  const openAssistantSource=source=>{
    if(selectedPDF && !(source.type==='document'&&source.id===selectedPDF))return false
    if(source.type==='document'){setSelectedPDF(source.id);return true}
    if(source.type==='task'){
      const task=todos.find(task=>task._id===source.id);if(!task)return false
      setSelectedFolder('all');if(page==='tasks')setSelectedTask(task);else {pendingLibraryTask.current=task;navigate('tasks')}
      return true
    }
    if(source.type==='calendar'){setAssistantCalendarId(source.id);navigate('calendar');return true}
    return false
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchTodos()
      fetchFolders()
      fetchCanvasStatus()
      fetchPDFs()
      fetchPDFFolders()
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!(showFolderModal || showProfileModal || showCanvasModal || showPDFUploadModal || showCommandMenu || selectedTask || contextMenu)) return
    const panels = document.querySelectorAll('.app-inline-panel')
    const panel = panels[panels.length - 1]
    panel?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [showFolderModal, showProfileModal, showCanvasModal, showPDFUploadModal, showCommandMenu, selectedTask, contextMenu])

  useShortcuts('Platform', {
    'nav-tasks': () => navigate('tasks'), 'nav-documents': () => navigate('documents'),
    'nav-calendar': () => navigate('calendar'), 'nav-canvas': () => navigate('canvas'), 'nav-account': () => navigate('account'),
    'nav-visualization': () => navigate('visualization'), 'nav-shortcuts': () => navigate('shortcuts'), help: () => navigate('shortcuts'),
    dismiss: () => { if(!showCommandMenu&&!showFolderModal&&!showPDFUploadModal&&!selectedTask&&!contextMenu)return false; setShowCommandMenu(false); setShowFolderModal(false); setShowPDFUploadModal(false); setSelectedTask(null); setContextMenu(null) },
    commands: () => { setShowCommandMenu(true); setTimeout(() => commandInputRef.current?.focus(),0) },
    search: () => { const field = page === 'documents' ? document.querySelector('[aria-label="Search documents"]') : page === 'shortcuts' ? document.querySelector('[aria-label="Search keyboard shortcuts"]') : page === 'tasks' ? inputRef.current : null; if(!field)return false; field.focus() },
  }, isAuthenticated && !assistantOpen && !selectedPDF && !taskConfirmation.pending)
  useShortcuts('Tasks', { 'new-task': () => inputRef.current?.focus(), 'task-folder': () => setShowFolderModal(true),
    'save-task': () => {if(editingFolder)updateFolder(editingFolder);else [...editingTodos].forEach(id=>saveEdit(id))},
    'edit-task': () => {const id=document.activeElement?.closest('[data-task-id]')?.dataset.taskId; const task=todos.find(task=>task._id===id); if(task)startEditing(task)},
    'advance-task': () => {const id=document.activeElement?.closest('[data-task-id]')?.dataset.taskId; if(id)cycleTodoStatus(id)},
    'delete-task': () => {const id=document.activeElement?.closest('[data-task-id]')?.dataset.taskId; if(id)deleteTodo(id)},
  }, isAuthenticated && !assistantOpen && page === 'tasks' && !selectedPDF && !taskConfirmation.pending)

  useShortcuts('Canvas', {
    'calendar-file': () => document.querySelector('[data-canvas-import] input[type="file"]')?.click(),
    'calendar-import': () => { if(icsFile) document.querySelector('[data-canvas-import] form')?.requestSubmit(); else setError('Choose an ICS calendar file first.') },
  }, isAuthenticated && !assistantOpen && page === 'canvas' && !selectedPDF && !syncing)

  // Click outside to save edit
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (event.target.closest('[data-assistant-ui]')) return
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
              return readApiJson(res)
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
      if (event.target.closest('[data-assistant-ui]')) return
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
      if (event.target.closest('[data-assistant-ui]')) return
      if (contextMenu && !event.target.closest('.context-menu')) {
        setContextMenu(null)
      }
    }

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [contextMenu])

  const fetchTodos = async (reportErrors=true) => {
    try {
      const response = await fetch('/api/todos', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to fetch todos'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const data = await readApiJson(response)
      if(!Array.isArray(data))throw new Error('The task API returned an invalid task list. Existing tasks have been kept.');
      setTodos(data)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else if(reportErrors) {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to fetch folders'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const data = await readApiJson(response)
      setFolders(data)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
    }
  }

  const fetchPDFs = async () => {
    try {
      const response = await fetch('/api/pdfs?includeTrash=1', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to fetch PDFs'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const data = await readApiJson(response)
      setPdfs(data)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message || 'Could not load application data. Please retry.')
      }
    }
  }

  const handlePDFUploadSuccess = (uploadedPDF) => {
    setPdfs([uploadedPDF, ...pdfs])
    setSelectedPDF(uploadedPDF._id)
  }

  const fetchPDFFolders = async () => {
    try {
      const response = await fetch('/api/pdf-folders', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to fetch PDF folders'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const data = await readApiJson(response)
      setPdfFolders(data)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message || 'Could not load application data. Please retry.')
      }
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
          dueDate: dueDate ? localToInstant(dueDate) : null
        }),
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to add todo'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const newTodo = await readApiJson(response)
      setTodos([...todos, newTodo])
      setInput('')
      setDueDate('')
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to update todo'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const updatedTodo = await readApiJson(response)
      setTodos(todos.map(t => t._id === id ? updatedTodo : t))

    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
    }
  }

  const cycleTodoStatus = async (id) => {
    const todo = todos.find(t => t._id === id)
    const statusOrder = ['todo', 'in-progress', 'completed']
    const currentIndex = statusOrder.indexOf(todo.status)
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]
    await updateTodoStatus(id, nextStatus)
  }

  const beginTaskPointerDrag=useTaskPointerDrag({
    enabled:page==='tasks'&&!bulkDeleting&&!reordering,
    onDrop:(moving,destination)=>reorderTasks(moving,todos.find(task=>task._id===destination.id)||null,destination.status,destination.position),

  })
  const reorderTasks=async(moving,target,status,position)=>{
    if(reorderLock.current||moving._id===target?._id)return
    reorderLock.current=true;setReordering(true)
    const ordered=getSortedTodos(todos).filter(task=>task._id!==moving._id)
    let index=target?ordered.findIndex(task=>task._id===target._id):ordered.reduce((last,task,i)=>task.status===status?i+1:last,ordered.length)
    if(target&&position==='after')index++
    ordered.splice(Math.max(0,index),0,moving)
    const ids=ordered.map(task=>task._id)
    const previousSort=sortBy
    const previousOrder=new Map(todos.map(task=>[task._id,{manualOrder:task.manualOrder,status:task.status,completedAt:task.completedAt}]))
    const optimisticRanks=new Map(ids.map((id,index)=>[id,index]))
    setSortBy('manual')
    setTodos(previous=>previous.map(task=>({...task,manualOrder:optimisticRanks.get(task._id)??task.manualOrder,...(task._id===moving._id&&task.status!==status?{status,completedAt:status==='completed'?new Date().toISOString():null}:{})})))
    try{
      const response=await fetch('/api/todos/reorder',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({ids,movedId:moving._id,status})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not save task order. Restart the updated backend.')
      if(!Array.isArray(data.ids)||!data.task)throw new Error('Unexpected task order response. Refresh your tasks.')
      const ranks=new Map(data.ids.map((id,index)=>[id,index]))
      setTodos(previous=>previous.map(task=>({...task,...(task._id===data.task._id?data.task:{}),...(ranks.has(task._id)?{manualOrder:ranks.get(task._id)}:{})})))
      setSortBy('manual')
    }catch(error){
      setTodos(previous=>previous.map(task=>({...task,...(previousOrder.get(task._id)||{})})))
      setSortBy(previousSort);setError(error.message)
    }finally{reorderLock.current=false;setReordering(false)}
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
        dueDate: zonedLocal(todo.dueDate),
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
          dueDate: data.dueDate ? localToInstant(data.dueDate) : null
        }),
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to update todo'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const updatedTodo = await readApiJson(response)
      setTodos(todos.map(t => t._id === id ? updatedTodo : t))
      cancelEditing(id)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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
      if(sortBy==='manual')return (a.manualOrder??Infinity)-(b.manualOrder??Infinity)||new Date(b.createdAt)-new Date(a.createdAt)||a._id.localeCompare(b._id)
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
        setShowErrorDetails(false)
        break
      case 'clear':
        setError(null)
        setErrorDetails(null)
        setShowErrorDetails(false)
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
        setShowErrorDetails(false)
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
        setShowErrorDetails(false)
        break
      case 'all':
        setSelectedFolder('all')
        setError('Showing all tasks')
        setShowErrorDetails(false)
        break
      case 'inbox':
        setSelectedFolder(null)
        setError('Showing inbox')
        setShowErrorDetails(false)
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
        setShowErrorDetails(false)
        break
      default:
        setError('Unknown command. Type "help" for available commands.')
        setShowErrorDetails(false)
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
    const connections = dependencySummary(todo._id, todos)
    const hasDetails = connections.prerequisites.length || connections.following.length || todo.description || (todo.links && todo.links.length > 0) || pdfs.some(file => !file.deletedAt && documentTaskIds(file).includes(todo._id))
    const folder = todo.folder ? folders.find(f => f._id === todo.folder) : null

    return (
      <div
        key={todo._id}
        data-task-id={todo._id}
        tabIndex={0}
        role="article"
        aria-label={todo.text}
        draggable={false}
        onDragStart={event=>event.preventDefault()}
        onPointerDown={event=>{if(!isEditing)beginTaskPointerDrag(event,todo)}}
        className={cn("group task-selectable",selectedTaskIds.has(todo._id)&&"is-bulk-selected")}
        ref={(el) => { if (isEditing) editRefs.current[todo._id] = el }}
      >
        <div
          onClick={() => !isEditing && openTaskDetail(todo)}
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl transition-all cursor-grab active:cursor-grabbing",
            statusColor.bg,
            statusColor.border,
            " hover:shadow-lg"
          )}
        >
          <input type="checkbox" checked={selectedTaskIds.has(todo._id)} disabled={bulkDeleting} aria-label={`Select ${todo.text} for bulk deletion`} onClick={event=>event.stopPropagation()} onChange={()=>toggleTaskSelection(todo._id)} className="task-select-checkbox"/>
          <button
            onClick={(e) => { e.stopPropagation(); cycleTodoStatus(todo._id) }}
            className={cn(
              "flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ",
              statusColor.button
            )}
            title="Click to change status"
          >
            {statusColor.icon}
          </button>

          <div className="flex-1 min-w-0">
            <div className={cn("task-title-row flex items-center gap-2",showFullTaskTitles&&"show-full-titles")}>
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
                <span title={todo.text} className={cn("task-card-title text-base transition-all", statusColor.text)}>
                  {todo.text}
                </span>
              )}

              {selectedFolder === 'all' && !isEditing && (
                <span
                  className="flex-shrink-0 px-2 py-0.5 rounded-full text-xs"
                  style={{
                    backgroundColor: '#242c37',
                    color: '#b1bdc9',
                    border: '1px solid #354253'
                  }}
                >
                  {folder ? folder.name : 'Inbox'}
                </span>
              )}

              {!isEditing && connections.prerequisites.length > 0 && <span className="text-xs text-slate-400 flex-shrink-0" title="Advisory prerequisite completion">{connections.completed}/{connections.prerequisites.length} before</span>}
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
                  className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-all "
                  title="Save"
                >
                  <Save size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); cancelEditing(todo._id) }}
                  className="p-2 text-slate-400 hover:bg-white/10 rounded-lg transition-all "
                  title="Cancel"
                >
                  <X size={18} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); startEditing(todo) }}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all "
                  title="Edit"
                >
                  <Edit2 size={18} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteTodo(todo._id) }}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all "
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
                    id={`task-description-${todo._id}`}
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
                  <TaskDescription text={todo.description} documents={pdfs} onOpen={setSelectedPDF} />
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
                    <span>Due: {taskDueLabel(todo)}</span>
                  </div>
                )}
              </>
            )}
            <TaskDependencies taskId={todo._id} tasks={todos} token={token} onTasksChange={setTodos} onOpenTask={setSelectedTask} />
            <TaskAttachments taskId={todo._id} documents={pdfs} folders={pdfFolders} token={token} onDocumentsChange={setPdfs} onOpen={setSelectedPDF} onLibrary={() => { setSelectedPDFFolder('all'); navigate('documents') }} onInsert={isEditing ? reference => {
              const field = document.getElementById(`task-description-${todo._id}`)
              const current = editData[todo._id]?.description || ''
              const start = field?.selectionStart ?? current.length, end = field?.selectionEnd ?? start
              setEditData(prev => ({ ...prev, [todo._id]: { ...prev[todo._id], description: current.slice(0, start) + reference + current.slice(end) } }))
              requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + reference.length, start + reference.length) })
            } : undefined} />
          </div>
        )}
      </div>
    )
  }

  const deleteTodo = async (id) => {
    if(deletingTaskIds.current.has(id))return
    const task=todos.find(task=>task._id===id)
    if(!task)return
    if (!await taskConfirmation.ask(`Delete “${task?.text || 'this task'}”? You can restore deleted tasks with Undo.`, 'Delete task')) return
    if(deletingTaskIds.current.has(id))return
    deletingTaskIds.current.add(id)
    try {
      const response = await fetch(`/api/todos/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to delete todo'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      notifyTaskDeletion()
      setTodos(previous=>previous.filter(item=>item._id!==id).map(item=>({...item,dependsOn:(item.dependsOn||[]).filter(dependency=>String(dependency?._id||dependency)!==String(id))})))
      setSelectedTask(previous=>previous?._id===id?null:previous)
      setExpandedTodos(previous=>{const next=new Set(previous);next.delete(id);return next})
      setEditingTodos(previous=>{const next=new Set(previous);next.delete(id);return next})
      setEditData(previous=>{const next={...previous};delete next[id];return next})
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
    } finally {deletingTaskIds.current.delete(id)}
  }

  const deleteSelectedTasks=async()=>{
    if(bulkDeleteLock.current)return
    const visible=new Set(filteredTodos.map(task=>task._id))
    const ids=[...selectedTaskIds].filter(id=>visible.has(id))
    if(!ids.length)return
    bulkDeleteLock.current=true
    try{
      if(!await taskConfirmation.ask(`Delete ${ids.length} selected ${ids.length===1?'task':'tasks'}? Unselected tasks will stay. You can restore deleted tasks with Undo.`,'Delete selected tasks'))return
      setBulkDeleting(true)
      const response=await fetch('/api/todos/bulk-delete',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({ids})})
      const data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not delete selected tasks. Restart the updated backend if this action is unavailable.')
      if(!Array.isArray(data.deletedIds))throw new Error('Unexpected deletion response. Refresh the task list.')
      notifyTaskDeletion()
      const removed=new Set(data.deletedIds)
      setTodos(previous=>previous.filter(task=>!removed.has(task._id)).map(task=>({...task,dependsOn:(task.dependsOn||[]).filter(id=>!removed.has(String(id?._id||id)))})))
      setSelectedTaskIds(new Set())
      setSelectedTask(previous=>removed.has(previous?._id)?null:previous)
      setExpandedTodos(previous=>new Set([...previous].filter(id=>!removed.has(id))))
      setEditingTodos(previous=>new Set([...previous].filter(id=>!removed.has(id))))
      setEditData(previous=>Object.fromEntries(Object.entries(previous).filter(([id])=>!removed.has(id))))
    }catch(error){setError(error.message);await fetchTodos(false)}
    finally{bulkDeleteLock.current=false;setBulkDeleting(false)}
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
        body: JSON.stringify({ name: newFolderName.trim(), color: newFolderColor,parentId:newFolderParent,description:newFolderDescription }),
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to create folder'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const newFolder = await readApiJson(response)
      setFolders(previous=>[...previous, newFolder]);setSelectedFolder(newFolder._id);setNewFolderParent(null)
      setNewFolderName('')
      setShowFolderModal(false)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to delete folder'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const result=await readApiJson(response),parentId=result.parentId||null
      setFolders(previous=>previous.filter(f => f._id !== id).map(folder=>folder.parentId===id?{...folder,parentId}:folder))
      setTodos(previous=>previous.map(task=>task.folder===id?{...task,folder:parentId}:task))
      if (selectedFolder === id) setSelectedFolder(parentId)
      setContextMenu(null)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
    }
  }

  const deleteAllTasksInFolder = async (folderId, status = null) => {
    try {
      const url = status
        ? `/api/todos/folder/${folderId}?status=${status}`
        : `/api/todos/folder/${folderId}`

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to delete folder tasks'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const data = await readApiJson(response)
      await fetchTodos()
      notifyTaskDeletion()
      setError(null)
      setContextMenu(null)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to update folder'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const updatedFolder = await readApiJson(response)
      setFolders(folders.map(f => f._id === id ? updatedFolder : f))
      setEditingFolder(null)
      setEditFolderName('')
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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

  const clearInbox = async (status = null) => {
    try {
      const url = status
        ? `/api/todos/clear-inbox?status=${status}`
        : '/api/todos/clear-inbox'

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to clear inbox'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const data = await readApiJson(response)
      await fetchTodos()
      notifyTaskDeletion()
      setError(null)
      setContextMenu(null)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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
        const data = await readApiJson(response)
        setCanvasStatus(data)
        setCanvasUrl(data.canvasUrl || '')
      }
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message || 'Could not load application data. Please retry.')
      }
    }
  }

  const saveCanvasCredentials = async (e) => {
    e.preventDefault()
    if (!canvasUrl || !canvasToken) {
      setError('Please enter both Canvas URL and token')
      return
    }

    setSyncing(true)
    try {
      const response = await fetch('/api/user/canvas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ canvasUrl, canvasToken })
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to save Canvas credentials'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      await fetchCanvasStatus()
      setShowCanvasModal(false)
      setCanvasToken('')
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
    }
  }

  const syncCanvas = async () => {
    setCanvasNotice(''); setSyncing(true)
    try {
      const response = await fetch('/api/canvas/sync', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (!response.ok) {
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to sync Canvas'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }
      const data = await readApiJson(response)
      await fetchTodos()
      await fetchCanvasStatus()
      setError(null)

      // Show success message
      if (data.errors && data.errors.length > 0) {
        setCanvasNotice(`Canvas synced ${data.syncedCount} items. Some sources could not refresh: ${data.errors.join('; ')}`)
      } else {
        setCanvasNotice(`Canvas synced ${data.syncedCount} items. Their dates are now reflected in Calendar.`)
      }
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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
      const data = await readApiJson(response)
      if (data.success) {
        setError(`Canvas connection successful: ${data.response}`)
      } else {
        setError(`Canvas connection failed: ${data.error || 'Unknown error'}`)
      }
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(`Test failed: ${err.message}`)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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
        const errorData = await readApiJson(response).catch(() => ({}))
        const errorMessage = errorData.message || errorData.error || 'Failed to import calendar'
        if (errorMessage === 'Invalid or expired token') {
          logout()
          return
        }
        throw new Error(errorMessage)
      }

      const data = await readApiJson(response)
      await fetchTodos()
      await fetchFolders()
      setError(null); setCanvasNotice(`Imported ${data.importedCount} calendar items. Their dates are now available in Calendar.`)
      setIcsFile(null)
      setShowCanvasModal(false)
    } catch (err) {
      if (err.message === 'Invalid or expired token') {
        logout()
      } else {
        setError(err.message)
        setErrorDetails(err.stack || err.toString())
        setShowErrorDetails(false)
      }
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

  const openSearchResult=async result=>{
    if(result.type==='campus'){
      const url=new URL(result.url)
      if(!['http:','https:'].includes(url.protocol))throw new Error('The event link is unavailable. Open it from Calendar instead.')
      window.open(url.href,'_blank','noopener,noreferrer');return
    }
    if(selectedPDF&&!(result.type==='documents'&&result.id===selectedPDF&&!result.trashed)){
      const closed=await closeEditorForNavigation(selectedPDF);if(!closed)return
    }
    setAssistantOpen(false);setSelectedTask(null)
    if(result.type==='tasks'){
      const response=await fetch(`/api/search/tasks/${result.id}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store'}),task=await readApiJson(response)
      if(!response.ok)throw new Error(task.message||'Could not open this task.')
      setSelectedFolder('all');pendingLibraryTask.current=page==='tasks'?null:task;navigate('tasks');setSelectedTask(task)
    }else if(result.type==='documents'){
      if(result.trashed){setSelectedPDFFolder('trash');setSearchLibraryTarget({fileId:result.id});navigate('documents')}else setSelectedPDF(result.id)
    }else if(result.type==='events'){setAssistantCalendarId(result.id);setSearchCategoryId(null);navigate('calendar')}
    else if(result.type==='jobs'){setSearchJobId(result.id);navigate('jobs')}
    else if(result.type==='taskFolders'){setSelectedFolder(result.id);navigate('tasks')}
    else if(result.type==='documentFolders'){setSelectedPDFFolder(result.id);setSearchLibraryTarget({folderId:result.id});navigate('documents')}
    else if(result.type==='categories'){setAssistantCalendarId(null);setSearchCategoryId(result.id);navigate('calendar')}
    else if(result.type==='study'){window.location.hash=`/study/${result.id}`;setPage('study')}
    else if(result.type==='chats'){setAssistantRouteId(result.id);window.location.hash=`/assistant/${result.id}`;setPage('assistant');window.scrollTo({top:0})}
    else if(result.type==='shortcuts'){setSearchShortcutsQuery(result.title);navigate('shortcuts')}
    else {if(result.route==='shortcuts')setSearchShortcutsQuery('');navigate(result.route||'home')}
  }

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
      <div className="app-shell w-full max-w-[1440px] mx-auto">
        <AppNavigation page={page} user={user} onSignOut={logout}/>
        <GlobalSearch token={token} onChoose={openSearchResult}/>
        {page!=='home'&&<div className="platform-page-title"><h1>{page==='study'?'Study stars':page==='workspace'?'Workspace':page==='tasks'?'Tasks':page==='calendar'?'Calendar':page==='documents'?'Document library':page==='jobs'?'Jobs':page==='cover-letters'?'Cover letters':page==='resumes'?'Resumes':page==='visualization'?'Task visualization':page==='canvas'?'Canvas integration':page==='account'?'Account':page==='assistant'?'AI assistant':'Keyboard shortcuts'}</h1><p>{page==='study'?'Save questions and topics, review answers, and track what you have studied.':page==='cover-letters'?'Store cover letters for your applications and keep versions ready to edit or download.':page==='jobs'?'Save job links and details alongside your resumes.':page==='resumes'?'Upload and keep your resumes ready for your next opportunity.':page==='workspace'?'Build a personal workflow with tabs, tools, and movable windows.':page==='tasks'?'Plan your work and track progress.':page==='calendar'?'Plan deadlines, assignments, and personal events in one place.':page==='documents'?'Organize and edit your files.':page==='visualization'?'Explore relationships, deadlines, and progress across your workspace.':page==='canvas'?'Manage your course connection and imports.':page==='account'?'Review your profile and workspace activity.':page==='assistant'?'Think, write, learn, and work with your files in a dedicated conversation workspace.':'A searchable reference for navigation and actions.'}</p></div>}
        <InlineConfirmation {...taskConfirmation} reveal />
        <TaskDeletionUndo token={token} onRestored={()=>fetchTodos(false)}/>
        {page==='home'&&<HomePage user={user} token={token} tasks={todos} documents={pdfs} folders={folders} loading={loading} canvasStatus={canvasStatus} onNavigate={navigate} onOpenTask={task=>setSelectedTask(task)} onOpenDocument={setSelectedPDF} onOpenCalendar={entry=>{setAssistantCalendarId(entry._id);navigate('calendar')}} onNewTask={()=>{setSelectedFolder('all');navigate('tasks');setTimeout(()=>inputRef.current?.focus(),0)}} onUpload={()=>{setSelectedPDFFolder('all');setShowPDFUploadModal(true)}} onRefresh={()=>Promise.all([fetchTodos(false),fetchPDFs()])}/>}
        <WorkflowWorkspace key={'workspace:'+user?.id+':'+assistantGeneration} open={page==='workspace'} token={token} userId={user?.id} tasks={todos} folders={folders} documents={pdfs} documentFolders={pdfFolders} onTasksChange={setTodos} onOpenTask={task=>setSelectedTask(task)} onStatusChange={updateTodoStatus} onOpenDocument={setSelectedPDF} onUpload={()=>{setSelectedPDFFolder('all');setShowPDFUploadModal(true)}} onNavigate={navigate} onOpenCalendarEntry={entry=>{setAssistantCalendarId(entry._id);navigate('calendar')}} onOpenAssistant={()=>setAssistantOpen(true)} keyboardEnabled={!selectedPDF&&!assistantOpen&&!selectedTask&&!showPDFUploadModal&&!showCommandMenu}/>
        {page==='calendar' && <CalendarPage focusCategoryId={searchCategoryId} onCategoryFocused={()=>setSearchCategoryId(null)} focusEntryId={assistantCalendarId} onEntryFocused={()=>setAssistantCalendarId(null)} documents={pdfs} documentFolders={pdfFolders} onDocumentsChange={setPdfs} onOpenDocument={setSelectedPDF} tasks={todos} token={token} keyboardEnabled={!selectedPDF&&!assistantOpen} onOpenTask={task=>{pendingLibraryTask.current=task;setSelectedFolder('all');navigate('tasks')}} onRefreshTasks={fetchTodos} onSyncCanvas={syncCanvas} onCanvasSettings={()=>navigate('canvas')} canvasStatus={canvasStatus} syncing={syncing} />}
        {canvasNotice && <div role="status" className="calendar-feedback">{canvasNotice}<button onClick={()=>setCanvasNotice('')} aria-label="Dismiss Canvas sync notice"><X size={15}/></button></div>}
        {page==='cover-letters' && <CoverLettersPage token={token} documents={pdfs} onDocumentsChange={setPdfs} onOpen={setSelectedPDF}/>}
        {page==='jobs' && <JobsPage token={token} focusJobId={searchJobId} onJobFocused={()=>setSearchJobId(null)}/>}
        {page==='resumes' && <ResumesPage token={token} documents={pdfs} onDocumentsChange={setPdfs} onOpen={setSelectedPDF}/>}
        {page==='study' && <StudyPage token={token}/>}
        {page==='shortcuts' && <ShortcutsPage initialQuery={searchShortcutsQuery}/>}
        {page==='visualization' && <TaskVisualization token={token} onTasksChange={setTodos} onOpenTask={task => { pendingLibraryTask.current = task; setSelectedFolder('all'); navigate('tasks') }} loading={loading} keyboardEnabled={!selectedPDF&&!assistantOpen} tasks={todos} folders={folders} documents={pdfs} onOpenDocument={setSelectedPDF} onStatusChange={updateTodoStatus} onEditTask={task=>{setSelectedFolder('all');navigate('tasks');startEditing(task)}} />}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center justify-between">
              <p className="text-red-400 text-sm flex-1">{error}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowErrorDetails(!showErrorDetails)}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-all"
                  title="Toggle error details"
                >
                  <ChevronRight size={16} className={cn("transition-transform", showErrorDetails && "rotate-90")} />
                </button>
                <button
                  onClick={() => { setError(null); setErrorDetails(null); setShowErrorDetails(false); }}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {showErrorDetails && errorDetails && (
              <pre className="mt-3 text-red-300 text-xs bg-red-500/5 p-3 rounded overflow-auto max-h-40 font-mono">
                {errorDetails}
              </pre>
            )}
          </div>
        )}

        {page === 'documents' && <DocumentLibrary navigationTarget={searchLibraryTarget} onNavigationHandled={()=>setSearchLibraryTarget(null)} tasks={todos} onOpenTask={task => { setSelectedFolder('all'); if (page === 'tasks') setSelectedTask(task); else { pendingLibraryTask.current = task; navigate('tasks') } }} keyboardEnabled={!selectedPDF&&!assistantOpen} documents={pdfs} folders={pdfFolders} token={token} onOpen={setSelectedPDF} onUpload={() => setShowPDFUploadModal(true)} onDocumentsChange={setPdfs} onFoldersChange={setPdfFolders} selectedFolder={selectedPDFFolder} onSelectFolder={setSelectedPDFFolder} />}

        {page === 'tasks' && <>
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
                  ? "bg-slate-800   text-white shadow-lg"
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
            {folderTree(folders).map((folder) => (
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
                      backgroundColor: selectedFolder === folder._id ? '#354253' : undefined,
                      boxShadow: 'none',
                    }}
                  >
                    <Folder size={16} />
                    <span className="font-medium" title={folder.path}>{folder.path}</span>
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

        <FolderHierarchyControls folders={folders} selected={selectedFolder} token={token} base="/api/folders" documents={pdfs} onDocumentsChange={setPdfs} onOpenDocument={setSelectedPDF} onFoldersChange={setFolders} onSelect={setSelectedFolder} onCreate={id=>{setNewFolderParent(id);setNewFolderName('');setShowFolderModal(true)}} disabled={loading}/>
        <form onSubmit={addTodo} className="mb-6">
          <div className="flex gap-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Add task to ${selectedFolder === 'all' ? 'Inbox' : selectedFolder ? folders.find(f => f._id === selectedFolder)?.name : 'Inbox'}...`}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all focus: text-sm"
            />
            <input
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
            <button
              type="submit"
              className="px-5 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium transition-all   flex items-center gap-2 shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 text-sm"
            >
              <Plus size={16} className="" />
              Add
            </button>
          </div>
        </form>

        {/* Sort Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown size={16} className="text-slate-400" />
            <span className="text-slate-400 text-sm">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="manual">Custom order · drag to arrange</option>
              <option value="createdAt">Date Created</option>
              <option value="dueDate">Due Date</option>
              <option value="completedAt">Date Completed</option>
              <option value="text">Name</option>
              <option value="status">Status</option>
            </select>
            <button
              disabled={sortBy==='manual'}
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-slate-400 hover:text-white"
              title="Toggle sort order"
            >
              {sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          <label className="task-title-toggle"><input type="checkbox" checked={showFullTaskTitles} onChange={event=>setShowFullTaskTitles(event.target.checked)}/>Show full titles</label>
        </div>

        <p className="task-reorder-hint" role="status">{reordering?'Saving task order…':'Drag a task above or below another to arrange it. Scroll with your mouse wheel or trackpad, or hold near the top or bottom for automatic scrolling. Drop into another column to change its status.'}</p>
        {!loading&&filteredTodos.length>0&&<div className={cn("task-bulk-actions",filteredTodos.some(task=>selectedTaskIds.has(task._id))&&"has-selection")} role="group" aria-label="Bulk task actions"><label><input type="checkbox" disabled={bulkDeleting} checked={filteredTodos.every(task=>selectedTaskIds.has(task._id))} ref={element=>{if(element)element.indeterminate=filteredTodos.some(task=>selectedTaskIds.has(task._id))&&!filteredTodos.every(task=>selectedTaskIds.has(task._id))}} onChange={event=>setSelectedTaskIds(event.target.checked?new Set(filteredTodos.map(task=>task._id)):new Set())}/>Select all</label><span className="task-selection-count" aria-live="polite">{filteredTodos.filter(task=>selectedTaskIds.has(task._id)).length} selected</span><div className="task-selection-actions"><button className="task-selection-delete" type="button" disabled={bulkDeleting||!filteredTodos.some(task=>selectedTaskIds.has(task._id))} onClick={deleteSelectedTasks}><Trash2 size={15}/>{bulkDeleting?'Deleting…':'Delete selected'}</button><button className="task-selection-clear" type="button" disabled={bulkDeleting||!selectedTaskIds.size} onClick={()=>setSelectedTaskIds(new Set())}><X size={14}/>Clear</button></div></div>}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary-500" size={40} />
          </div>
        ) : filteredTodos.length === 0 ? (
          <div className="text-center py-12">
            <FileText size={34} className="mx-auto mb-4 text-slate-400"/>
            <p className="text-slate-400 text-lg">
              {selectedFolder === 'all' ? 'No tasks yet. Add one above!' : selectedFolder ? 'No tasks in this folder yet' : 'No todos yet. Add one above!'}
            </p>
          </div>
        ) : (
          <div className={cn("grid grid-cols-1 gap-4",showInProgressColumn?"md:grid-cols-3":"md:grid-cols-2")}>
            {/* Todo Tasks */}
            <div
              data-task-status="todo"
              className={cn(
                "rounded-2xl p-3 min-h-[150px]"
              )}
            >
              <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary-500 rounded-full "></span>
                {showInProgressColumn?'To Do':'To Do & In Progress'} ({filteredTodos.filter(t => t.status === 'todo'||(!showInProgressColumn&&t.status === 'in-progress')).length})
              </h2>
              <div className="space-y-2">
                {filteredTodos.filter(t => t.status === 'todo'||(!showInProgressColumn&&t.status === 'in-progress')).length > 0 ? (
                  filteredTodos.filter(t => t.status === 'todo'||(!showInProgressColumn&&t.status === 'in-progress')).map((todo) =>
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
            {showInProgressColumn&&<div
              data-task-status="in-progress"
              className={cn(
                "rounded-2xl p-3 min-h-[150px]"
              )}
            >
              <h2 className="text-base font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-500 rounded-full "></span>
                In Progress ({filteredTodos.filter(t => t.status === 'in-progress').length})
              </h2>
              <div className="space-y-2">
                {filteredTodos.filter(t => t.status === 'in-progress').length > 0 ? (
                  filteredTodos.filter(t => t.status === 'in-progress').map((todo) =>
                    renderTaskCard(todo, {
                      bg: 'bg-yellow-500/10',
                      border: 'border border-yellow-500/20 hover:bg-yellow-500/15',
                      button: 'border-yellow-500 hover:border-yellow-400',
                      icon: <div className="w-3 h-3 bg-yellow-500 rounded-full " />,
                      text: 'text-white'
                    })
                  )
                ) : (
                  <div className="text-center py-6 text-slate-500 border-2 border-dashed border-slate-700 rounded-xl text-sm">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>}

            {/* Completed Tasks */}
            <div
              data-task-status="completed"
              className={cn(
                "rounded-2xl p-3 min-h-[150px]"
              )}
            >
              <h2 className="text-base font-semibold text-green-400 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full "></span>
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

        </>}
        {/* Folder Modal */}
        {showFolderModal && (
          <div className="app-inline-panel">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <h3 className="text-2xl font-bold text-white mb-4">Create New Folder</h3>
              <form onSubmit={createFolder}>
                <div className="mb-4"><FolderParentSelect folders={folders} value={newFolderParent} onChange={setNewFolderParent}/></div>
                <div className="mb-4">
                  <label className="block text-slate-400 mb-2 text-sm">Folder Name</label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    autoFocus
                  />
                </div>
                <FolderDescriptionInput value={newFolderDescription} onChange={setNewFolderDescription}/>
                <div className="mb-6">
                  <label className="block text-slate-400 mb-2 text-sm">Folder Color</label>
                  <div className="flex gap-3">
                    {['#64788b', '#78808b', '#7c8980', '#978975', '#8d7c7c', '#6d7d80'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewFolderColor(color)}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all",
                          newFolderColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''
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
        {page === 'account' && (
          <div className="app-inline-panel">
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Your Profile</h3>
                <button
                  onClick={() => navigate('tasks')}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              {/* User Info */}
              <div className="flex items-center gap-4 mb-6 p-4 bg-slate-800   rounded-xl">
                <div className="w-16 h-16 bg-slate-800   rounded-full flex items-center justify-center text-white text-2xl font-bold">
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
                    className="bg-slate-800   h-3 rounded-full transition-all duration-500"
                    style={{ width: `${getUserStats().completionRate}%` }}
                  />
                </div>
              </div>

              <AccountConnections token={token}/>
              <TimeZoneSettings /><StudyPhoneSettings/>
              <TaskDisplaySettings />
              <ConfirmationSettings />
              <AccountAISettings token={token}/>
              <AccountAIAccess token={token}/>
              <AccountReset token={token} disabled={syncing || testing || !!selectedPDF} onReset={() => {
                window.dispatchEvent(new CustomEvent('workspace-reset',{detail:user?.id}));setAssistantOpen(false);setAssistantGeneration(previous=>previous+1);setAssistantCalendarId(null)
                try { pdfs.forEach(file => sessionStorage.removeItem(`document-draft:${file._id}`)) } catch { /* Storage may be unavailable. */ }
                setTodos([]); setFolders([]); setPdfs([]); setPdfFolders([])
                setSelectedFolder(null); setSelectedPDFFolder('all'); setSelectedTask(null); setSelectedPDF(null)
                setExpandedTodos(new Set()); setEditingTodos(new Set()); setEditData({}); editRefs.current = {}
                setInput(''); setDueDate(''); setSortBy('createdAt'); setSortOrder('desc')
                setCanvasNotice(''); setCanvasUrl(''); setCanvasToken(''); setCanvasStatus({ hasCredentials: false, canvasUrl: null, lastCanvasSync: null }); setIcsFile(null)
                setContextMenu(null); setError(null); setErrorDetails(null); setShowErrorDetails(false); setShowPDFUploadModal(false)
                setShowFolderModal(false); setEditingFolder(null); setEditFolderName(''); setNewFolderName(''); setNewFolderColor('#64788b')
                setCommandInput(''); setShowCommandMenu(false); pendingLibraryTask.current = null
              }} />

              <button
                onClick={() => navigate('tasks')}
                className="w-full px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl transition-all font-medium"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Canvas Integration Modal */}
        {page === 'canvas' && (
          <div className="app-inline-panel" data-canvas-import>
            <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">Import Calendar</h3>
                <button
                  onClick={() => navigate('tasks')}
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
          <div className="app-inline-panel">
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
          <div className="app-inline-panel">
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
                <TaskDescription text={selectedTask.description || 'No description'} documents={pdfs} onOpen={setSelectedPDF} />
                <TaskDependencies key={`dependencies:${selectedTask._id}`} taskId={selectedTask._id} tasks={todos} token={token} onTasksChange={setTodos} onOpenTask={setSelectedTask} />
                <TaskAttachments key={selectedTask._id} taskId={selectedTask._id} documents={pdfs} folders={pdfFolders} token={token} onDocumentsChange={setPdfs} onOpen={setSelectedPDF} onLibrary={() => { setSelectedPDFFolder('all'); navigate('documents') }} />
              </div>

              {/* Due Date */}
              <div className="mb-6">
                <label className="block text-slate-400 text-sm mb-2">Due Date</label>
                <p className="text-slate-300 text-sm">
                  {selectedTask.dueDate
                    ? taskDueLabel(selectedTask,true)
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
            className="context-menu app-inline-panel bg-slate-800 border border-white/10 rounded-lg shadow-xl z-50 py-1 min-w-[150px]"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
          >
            {contextMenu.isInbox ? (
              <>
                <button
                  onClick={() => clearInbox(null)}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear All
                </button>
                <button
                  onClick={() => clearInbox('todo')}
                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear To Do
                </button>
                <button
                  onClick={() => clearInbox('in-progress')}
                  className="w-full px-4 py-2 text-left text-sm text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear In Progress
                </button>
                <button
                  onClick={() => clearInbox('completed')}
                  className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-green-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear Completed
                </button>
              </>
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
                  onClick={() => deleteAllTasksInFolder(contextMenu.folder._id, null)}
                  className="w-full px-4 py-2 text-left text-sm text-orange-400 hover:bg-orange-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear All
                </button>
                <button
                  onClick={() => deleteAllTasksInFolder(contextMenu.folder._id, 'todo')}
                  className="w-full px-4 py-2 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear To Do
                </button>
                <button
                  onClick={() => deleteAllTasksInFolder(contextMenu.folder._id, 'in-progress')}
                  className="w-full px-4 py-2 text-left text-sm text-yellow-400 hover:bg-yellow-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear In Progress
                </button>
                <button
                  onClick={() => deleteAllTasksInFolder(contextMenu.folder._id, 'completed')}
                  className="w-full px-4 py-2 text-left text-sm text-green-400 hover:bg-green-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Clear Completed
                </button>
                <button
                  onClick={() => deleteFolder(contextMenu.folder._id)}
                  className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Folder
                </button>
              </>
            )}
          </div>
        )}

        {/* PDF Upload Modal */}
        {showPDFUploadModal && (
          <PDFUploadModal
            onClose={() => setShowPDFUploadModal(false)}
            token={token}
            onUploadSuccess={handlePDFUploadSuccess}
            initialFolder={typeof selectedPDFFolder === 'string' && selectedPDFFolder !== 'all' && selectedPDFFolder !== 'trash' ? selectedPDFFolder : ''}
            pdfFolders={pdfFolders}
            onFolderCreated={folder=>setPdfFolders(previous=>previous.some(item=>item._id===folder._id)?previous:[...previous,folder])}
          />
        )}

        {!selectedPDF&&!assistantOpen&&page!=='assistant'&&<button data-assistant-ui type="button" className="assistant-launcher" onClick={()=>setAssistantOpen(true)} aria-expanded={false} aria-label="Open workspace assistant"><span>Ask assistant</span><kbd>Alt + J</kbd></button>}
        <AssistantChat portalTarget={editorAssistantHost} key={`${user?.id}:${assistantGeneration}`} open={assistantOpen||(page==='assistant'&&!selectedPDF)} mode={page==='assistant'&&!selectedPDF?'page':'panel'} routeConversationId={assistantRouteId} onConversationChange={id=>{if(page!=='assistant')return;const hash=id?'#/assistant/'+id:'#/assistant';window.history.replaceState(null,'',hash);setAssistantRouteId(id)}} onOpenPage={()=>{setAssistantOpen(false);navigate('assistant')}} documents={pdfs} onDocumentsChange={setPdfs} onClose={()=>setAssistantOpen(false)} token={token} section={page} documentId={selectedPDF} documentName={pdfs.find(file=>file._id===selectedPDF)?.name} onOpenSource={openAssistantSource}/>

        <StudyPhone key={'phone:'+user?.id+':'+assistantGeneration} userId={user?.id} token={token} tasks={todos} enabled={user?.studyPhoneEnabled!==false}/>
        {/* PDF Editor */}
        {selectedPDF && (
          <DocumentEditor
            assistantOpen={assistantOpen}
            onToggleAssistant={()=>setAssistantOpen(previous=>!previous)}
            onAssistantHost={setEditorAssistantHost}
            key={selectedPDF}
            onCleanCopy={copy=>{setPdfs(previous=>[copy,...previous]);setSelectedPDF(copy._id)}}
            pdfId={selectedPDF}
            onClose={() => { setSelectedPDF(null); fetchPDFs() }}
            token={token}
          />
        )}

      </div>
    </div>
  )
}

export default App
