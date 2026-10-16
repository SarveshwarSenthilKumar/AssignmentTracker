import { useEffect, useMemo, useState } from 'react'
import { Search, Plus, Check, ArrowUpRight, Play, Pause, RotateCcw, FileText, MessageSquare } from 'lucide-react'
import { CALENDAR_LABELS, taskDueLabel, calendarItems, calendarDay, calendarTime, dayLabel } from '../lib/calendar'
import { taskMetrics, taskStatus, STATUS_LABELS } from '../lib/taskVisualization'
import TaskVisualization from './TaskVisualization'
import AssistantMarkdown from './AssistantMarkdown'
import useInlineConfirm from '../hooks/useInlineConfirm'
import InlineConfirmation from './InlineConfirmation'
import SimilarEvents from './SimilarEvents'

function TaskPane({tasks,folders,token,onTasksChange,onOpenTask,onStatusChange}){
  const [query,setQuery]=useState(''),[folder,setFolder]=useState('all'),[status,setStatus]=useState('active'),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const visible=tasks.filter(task=>(status==='all'||(status==='active'?taskStatus(task)!=='completed':taskStatus(task)===status))&&(folder==='all'||String(task.folder||'')===folder)&&`${task.text} ${task.description||''}`.toLowerCase().includes(query.toLowerCase()))
  const metrics=taskMetrics(tasks)
  const create=async event=>{
    event.preventDefault();if(!text.trim()||busy)return
    setBusy(true);setError('')
    try{const response=await fetch('/api/todos',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({text:text.trim(),folder:folder==='all'||!folder?null:folder})});const data=await response.json();if(!response.ok)throw new Error(data.message||'Could not create task.');onTasksChange(previous=>[data,...previous]);setText('')}
    catch(error){setError(error.message)}finally{setBusy(false)}
  }
  const advance=async task=>{if(busy)return;setBusy(true);setError('');try{await onStatusChange(task._id,taskStatus(task)==='completed'?'todo':taskStatus(task)==='todo'?'in-progress':'completed')}catch(error){setError(error.message)}finally{setBusy(false)}}
  return <div className="workflow-tool"><div className="workflow-stats"><span><strong>{metrics.counts.todo}</strong>To do</span><span><strong>{metrics.counts['in-progress']}</strong>In progress</span><span><strong>{metrics.completion}%</strong>Complete</span></div><div className="workflow-tool-filters"><label className="workflow-search"><Search size={13}/><input aria-label="Search window tasks" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search tasks…"/></label><select aria-label="Task status filter" value={status} onChange={event=>setStatus(event.target.value)}><option value="active">Active</option><option value="all">All tasks</option>{Object.entries(STATUS_LABELS).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><select aria-label="Task folder filter" value={folder} onChange={event=>setFolder(event.target.value)}><option value="all">All folders</option><option value="">Inbox</option>{folders.map(folder=><option key={folder._id} value={folder._id}>{folder.name}</option>)}</select></div><form className="workflow-quick-add" onSubmit={create}><input aria-label="New task in this window" maxLength={1000} placeholder="Add a task…" value={text} disabled={busy} onChange={event=>setText(event.target.value)}/><button type="submit" disabled={busy||!text.trim()}><Plus size={14}/></button></form>{error&&<p role="alert" className="workflow-error">{error}</p>}<div className="workflow-task-list">{visible.map(task=><div key={task._id}><button type="button" className={`workflow-task-state state-${taskStatus(task)}`} disabled={busy} onClick={()=>advance(task)} title="Advance status" aria-label={`Advance ${task.text}: ${STATUS_LABELS[taskStatus(task)]}`}>{taskStatus(task)==='completed'?<Check size={13}/>:taskStatus(task)==='in-progress'?<span>◐</span>:<span>○</span>}</button><button type="button" onClick={()=>onOpenTask(task)}><strong>{task.text}</strong><small>{taskDueLabel(task,true)} · {STATUS_LABELS[taskStatus(task)]}</small></button><ArrowUpRight size={13}/></div>)}{!visible.length&&<p className="workflow-empty">No tasks match these filters.</p>}</div></div>
}
function AgendaPane({tasks,entries,calendarLoading,calendarError,onRefreshCalendar,onOpenTask,onOpenCalendarEntry,onNavigate,campus,onRefreshCampus,onCalendarVisibility,token}){
  const [query,setQuery]=useState(''),[past,setPast]=useState(false)
  const [limit,setLimit]=useState(100),[showTxst,setShowTxst]=useState(true)
  const [similarTarget,setSimilarTarget]=useState(null)
  const allItems=calendarItems(tasks,entries,campus?.events||[]).filter(item=>!(campus?.hiddenCalendarIds||[]).includes(item.id)&&!(campus?.hideTxstEvents&&item.source==='txst'))
  const confirmation=useInlineConfirm(),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('')
  const today=calendarDay(new Date()),items=calendarItems(tasks,entries,campus?.events||[]).filter(item=>!(campus?.hiddenCalendarIds||[]).includes(item.id)&&!(campus?.hideTxstEvents&&item.source==='txst')&&(showTxst||item.source!=='txst')&&(past||item.endDate>=today)&&`${item.title} ${item.location} ${item.context||''}`.toLowerCase().includes(query.toLowerCase()))
  const removeItem=async item=>{
    if(item.entry&&!await confirmation.ask(`Permanently delete “${item.title}”? This cannot be undone.`,'Delete event'))return
    setDeleting(true);setDeleteError('')
    try {
      if(item.entry){
        const response=await fetch(`/api/calendar-entries/${item.entry._id}`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`}})
        if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Could not delete event.')}
        await onRefreshCalendar()
      }else await onCalendarVisibility('hide',item.id)
    }catch(error){setDeleteError(error.message)}finally{setDeleting(false)}
  }
  const changeVisibility=async action=>{
    setDeleting(true);setDeleteError('')
    try{await onCalendarVisibility(action)}catch(error){setDeleteError(error.message)}finally{setDeleting(false)}
  }
  return <div className="workflow-tool">
    <div className="workflow-tool-filters"><label className="workflow-search"><Search size={13}/><input aria-label="Search agenda window" value={query} onChange={event=>{setQuery(event.target.value);setLimit(100)}} placeholder="Search agenda…"/></label><button type="button" disabled={calendarLoading} onClick={onRefreshCalendar}>Refresh</button><button type="button" disabled={campus?.syncing} onClick={onRefreshCampus}>Refresh TXST</button><button type="button" onClick={()=>onNavigate('calendar')}>Full calendar ↗</button></div>
    <label className="workflow-checkbox"><input type="checkbox" checked={past} onChange={event=>setPast(event.target.checked)}/>Include past entries</label>
    <label className="workflow-checkbox"><input type="checkbox" checked={showTxst} onChange={event=>setShowTxst(event.target.checked)}/>TXST events</label>
    <InlineConfirmation {...confirmation} reveal/>
    {similarTarget&&<SimilarEvents key={similarTarget.id} target={similarTarget} items={allItems} onClose={()=>setSimilarTarget(null)} onRemove={ids=>onCalendarVisibility('hide-many',ids)}/>}
    {deleteError&&<p role="alert" className="workflow-error">{deleteError}</p>}
    <div className="workflow-tool-filters"><button type="button" disabled={deleting||campus?.hideTxstEvents} onClick={()=>changeVisibility('hide-txst')}>Remove all TXST events</button>{(campus?.hideTxstEvents||campus?.hiddenCalendarIds?.length>0)&&<button type="button" disabled={deleting} onClick={()=>changeVisibility('restore')}>Restore removed events</button>}</div>
    {campus&&<p role={campus.warning?'alert':'status'} className={campus.warning?'workflow-error':''}>{campus.syncing?campus.progress||'Loading TXST events…':campus.warning||`${campus.hideTxstEvents?0:campus.events.filter(event=>!(campus.hiddenCalendarIds||[]).includes(`txst:${event.id}`)).length} TXST events in your calendar`}</p>}
    {calendarError&&<p role="alert" className="workflow-error">{calendarError}</p>}{calendarLoading&&<p role="status">Loading calendar…</p>}
    <div className="workflow-agenda">{items.slice(0,limit).map(item=><div className="workflow-calendar-row" key={item.id}><button type="button" onClick={()=>item.campusEvent?window.open(item.campusEvent.url,'_blank','noopener,noreferrer'):item.task?onOpenTask(item.task):onOpenCalendarEntry?onOpenCalendarEntry(item.entry):onNavigate('calendar')}><time>{dayLabel(item.startDate,{month:'short',day:'numeric'})}</time><span><strong>{item.title}</strong><small>{calendarTime(item)} · {CALENDAR_LABELS[item.source]}{item.done?' · Completed':''}</small>{item.location&&<small>{item.location}</small>}</span><ArrowUpRight size={12}/></button><button type="button" disabled={deleting} aria-label={`Remove ${item.title} from calendar`} onClick={()=>removeItem(item)}>Remove</button><button type="button" disabled={deleting} onClick={()=>setSimilarTarget(item)}>Remove similar</button></div>)}{!items.length&&!calendarLoading&&<p className="workflow-empty">{campus?.syncing?'Loading campus events…':'No matching upcoming entries.'}</p>}</div>
    {items.length>limit&&<button type="button" onClick={()=>setLimit(value=>value+100)}>Show more ({items.length-limit} remaining)</button>}
  </div>
}
function DocumentsPane({documents,documentFolders,onOpenDocument,onUpload,onNavigate}){
  const [query,setQuery]=useState(''),[folder,setFolder]=useState('all')
  const files=documents.filter(file=>!file.deletedAt&&(folder==='all'||String(file.pdfFolder||'')===folder)&&`${file.name} ${file.originalName||''}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="workflow-tool"><div className="workflow-tool-filters"><label className="workflow-search"><Search size={13}/><input aria-label="Search window files" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search documents…"/></label><select aria-label="Document window folder" value={folder} onChange={event=>setFolder(event.target.value)}><option value="all">All folders</option><option value="">Unfiled</option>{documentFolders.map(item=><option key={item._id} value={item._id}>{item.name}</option>)}</select><button type="button" onClick={onUpload}><Plus size={13}/>Upload</button></div><div className="workflow-file-list">{files.map(file=><button type="button" key={file._id} onClick={()=>onOpenDocument(file._id)}><FileText size={16}/><span><strong>{file.name}</strong><small>{file.mimeType||'Document'}</small></span><ArrowUpRight size={13}/></button>)}{!files.length&&<p className="workflow-empty">No matching files.</p>}</div><button type="button" onClick={()=>onNavigate('documents')}>Manage document library ↗</button></div>
}
function NotesPane({pane,onNoteChange}){
  const [preview,setPreview]=useState(false)
  return <div className="workflow-notes"><div><span>Workflow scratchpad · saved with layout</span><button type="button" onClick={()=>setPreview(value=>!value)} aria-pressed={preview}>{preview?'Edit notes':'Preview Markdown'}</button></div>{preview?<AssistantMarkdown content={pane.note||'*No notes yet.*'} onOpenSource={()=>{}}/>:<textarea aria-label="Workflow notes" maxLength={12000} placeholder="Capture ideas, draft a plan, or keep reference notes here. Markdown is supported…" value={pane.note} onChange={event=>onNoteChange(event.target.value)}/>}<small>{pane.note.length.toLocaleString()} / 12,000 characters</small></div>
}
function FocusPane({tasks,onOpenTask}){
  const [duration,setDuration]=useState(25),[remaining,setRemaining]=useState(1500),[deadline,setDeadline]=useState(null),[taskId,setTaskId]=useState(''),[done,setDone]=useState(false)
  useEffect(()=>{
    if(!deadline)return
    const tick=()=>{
      const left=Math.max(0,Math.ceil((deadline-Date.now())/1000))
      setRemaining(left)
      if(!left){setDeadline(null);setDone(true)}
    }
    tick()
    const timer=setInterval(tick,500)
    return()=>clearInterval(timer)
  },[deadline])
  const task=tasks.find(item=>item._id===taskId)
  const toggleTimer=()=>{
    if(deadline){
      setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)))
      setDeadline(null)
    }else{
      setDone(false)
      setDeadline(Date.now()+(remaining||duration*60)*1000)
    }
  }
  const resetTimer=()=>{setDeadline(null);setRemaining(duration*60);setDone(false)}
  return <div className="workflow-focus">
    <p className="workflow-eyebrow">FOCUS SESSION</p>
    <div className="workflow-timer" role="timer" aria-label="Remaining focus time">
      {String(Math.floor(remaining/60)).padStart(2,'0')}<span>:</span>{String(remaining%60).padStart(2,'0')}
    </div>
    <div className="workflow-focus-presets">
      {[15,25,50].map(minutes=><button type="button" key={minutes} disabled={!!deadline} aria-pressed={minutes===duration} onClick={()=>{setDuration(minutes);setRemaining(minutes*60);setDone(false)}}>{minutes} min</button>)}
    </div>
    <select aria-label="Task for focus session" value={taskId} onChange={event=>setTaskId(event.target.value)}>
      <option value="">Focus without a task</option>
      {tasks.filter(item=>taskStatus(item)!=='completed').map(item=><option key={item._id} value={item._id}>{item.text}</option>)}
    </select>
    <div className="workflow-focus-actions">
      <button type="button" onClick={toggleTimer}>
        {deadline?<Pause size={15}/>:<Play size={15}/>} {deadline?'Pause':remaining===duration*60?'Start':'Resume'}
      </button>
      <button type="button" onClick={resetTimer}><RotateCcw size={14}/>Reset</button>
    </div>
    {task&&<button type="button" onClick={()=>onOpenTask(task)}>Open focus task ↗</button>}
    {done&&<p role="status">Session complete. Take a break when you are ready.</p>}
    <small>The timer continues while you switch workflow tabs. Reloading resets this timer; task status stays unchanged.</small>
  </div>
}
export default function WorkflowTools({pane,onNoteChange,active,...props}){
  const mapTasks=useMemo(()=>props.tasks,[props.tasks])
  if(pane.type==='tasks')return <TaskPane {...props}/>
  if(pane.type==='calendar')return <AgendaPane {...props}/>
  if(pane.type==='documents')return <DocumentsPane {...props}/>
  if(pane.type==='notes')return <NotesPane pane={pane} onNoteChange={onNoteChange}/>
  if(pane.type==='focus')return <FocusPane {...props}/>
  if(pane.type==='graph')return <div className="workflow-graph"><TaskVisualization tasks={mapTasks} folders={props.folders} documents={props.documents} token={props.token} onTasksChange={props.onTasksChange} onOpenTask={props.onOpenTask} onEditTask={props.onOpenTask} onStatusChange={props.onStatusChange} onOpenDocument={props.onOpenDocument} keyboardEnabled={active&&props.keyboardEnabled}/></div>
  return <div className="workflow-ai-launch"><MessageSquare size={30}/><h3>Your AI workspace</h3><p>Ask about visible work, attached files, deadlines or any topic. The floating assistant can sit beside these windows.</p><button type="button" onClick={props.onOpenAssistant}>Open floating assistant · Alt + J</button><button type="button" onClick={()=>props.onNavigate('assistant')}>Go to full AI workspace ↗</button><small>Uses the API key saved to your account.</small></div>
}
