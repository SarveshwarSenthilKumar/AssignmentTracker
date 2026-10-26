import FolderDescription from './FolderDescription'
import {useEffect,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import FolderParentSelect from './FolderParentSelect'
import './FolderHierarchyControls.css'

export default function FolderHierarchyControls({folders,selected,token,base,onFoldersChange,onSelect,onCreate,documents=[],onDocumentsChange,onOpenDocument,disabled=false}){
  const folder=folders.find(item=>item._id===selected)
  const [parent,setParent]=useState(folder?.parentId||null),[busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{setParent(folder?.parentId||null);setError('')},[folder?._id,folder?.parentId])
  const ancestors=[],seen=new Set();let current=folder
  while(current&&!seen.has(current._id)){seen.add(current._id);ancestors.unshift(current);current=folders.find(item=>item._id===current.parentId)}
  const move=async event=>{
    event.preventDefault();if(busy||disabled)return
    setBusy(true);setError('')
    try{
      const response=await fetch(`${base}/${folder._id}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({parentId:parent})}),data=await readApiJson(response)
      if(!response.ok)throw new Error(data.message||'Could not move this folder.')
      onFoldersChange(previous=>previous.map(item=>item._id===data._id?data:item))
    }catch(error){setError(error.message)}finally{setBusy(false)}
  }
  return <section className="folder-hierarchy-controls" aria-label="Folder hierarchy"><nav aria-label="Folder path"><button type="button" disabled={busy||disabled} onClick={()=>onSelect('all')}>All {base==='/api/folders'?'tasks':'documents'}</button>{ancestors.map(item=><span key={item._id}><span aria-hidden> / </span><button type="button" disabled={busy||disabled} aria-current={item._id===selected?'page':undefined} onClick={()=>onSelect(item._id)}>{item.name}</button></span>)}</nav>
    {folder&&<><FolderDescription key={folder._id} folder={folder} token={token} base={base} onFoldersChange={onFoldersChange} documents={documents} onDocumentsChange={onDocumentsChange} onOpenDocument={onOpenDocument} disabled={busy||disabled}/><div className="folder-hierarchy-actions"><button type="button" disabled={busy||disabled} onClick={()=>onCreate(folder._id)}>New subfolder</button><small>New folders are created inside this folder. Removing a folder keeps its contents and moves them up one level.</small></div><form onSubmit={move}><FolderParentSelect folders={folders} value={parent} onChange={setParent} exclude={folder._id} disabled={busy||disabled}/><button type="submit" disabled={busy||disabled||(parent||null)===(folder.parentId||null)}>{busy?'Moving…':'Move folder'}</button></form></>}
    {error&&<p role="alert">{error}</p>}
  </section>
}
