import {useEffect,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import {taskDueLabel} from '../lib/calendar'
import {STATUS_LABELS} from '../lib/taskVisualization'
import CopyTaskFolderLink from './CopyTaskFolderLink'
import './TaskFolderSharing.css'

export default function PublicTaskFolder({token}){
  const [folder,setFolder]=useState(null),[error,setError]=useState(''),[version,setVersion]=useState(0)
  useEffect(()=>{
    if(!token){setError('This task folder link is unavailable.');return}
    const controller=new AbortController()
    setError('');setFolder(null)
    fetch('/api/shared-task-folder/'+token,{signal:controller.signal,cache:'no-store',referrerPolicy:'no-referrer'})
      .then(async response=>{
        const data=await readApiJson(response)
        if(!response.ok)throw new Error(data.message||'Could not open the shared folder.')
        if(!controller.signal.aborted)setFolder(data)
      })
      .catch(error=>{if(!controller.signal.aborted)setError(error.message)})
    return()=>controller.abort()
  },[token,version])
  return <main className="public-task-folder">
    <a href="#/tasks">Assignment Tracker</a>
    <h1>{folder?.name||'Shared task folder'}</h1>
    {error&&<p role="alert">{error}</p>}
    {!folder&&!error&&<p role="status">Loading shared tasks…</p>}
    {folder&&<>
      <p>Read-only task list. Forward the link to share the original folder.</p>
      <CopyTaskFolderLink url={window.location.href}/>
      <button type="button" onClick={()=>setVersion(value=>value+1)}>Refresh tasks</button>
      <ul>{folder.tasks.map(task=><li key={task._id}>
        <strong>{task.text}</strong><span>{STATUS_LABELS[task.status]||STATUS_LABELS.todo} · {taskDueLabel(task,true)}</span>
      </li>)}</ul>
      {!folder.tasks.length&&<p>This folder has no tasks.</p>}
    </>}
  </main>
}
