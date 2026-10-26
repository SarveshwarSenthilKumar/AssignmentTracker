import {useEffect,useRef,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import './FolderDescription.css'

export function FolderDescriptionInput({value,onChange,disabled=false}){
  return <label className="folder-description-field">Description <small>(optional)</small><textarea rows={3} maxLength={2000} value={value} disabled={disabled} onChange={event=>onChange(event.target.value)} placeholder="What belongs in this folder? Add instructions, context or a reminder…"/><small>{value.length.toLocaleString()} / 2,000</small></label>
}

export default function FolderDescription({folder,token,base,onFoldersChange,disabled=false}){
  const [editing,setEditing]=useState(false),[value,setValue]=useState(folder.description||''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const lock=useRef(false)
  useEffect(()=>{setValue(folder.description||'');setEditing(false);setError('')},[folder._id,folder.description])
  const save=async event=>{
    event.preventDefault();if(lock.current||disabled)return
    lock.current=true;setBusy(true);setError('')
    try{
      const response=await fetch(`${base}/${folder._id}`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({description:value})}),data=await readApiJson(response)
      if(!response.ok||!data._id)throw new Error(data.message||'Could not save the description.')
      if(data.description!==value.trim())throw new Error('The description was not saved. Restart the updated backend, then try again.')
      onFoldersChange(previous=>previous.map(item=>item._id===data._id?data:item));setEditing(false)
    }catch(err){setError(err.message)}finally{lock.current=false;setBusy(false)}
  }
  return <div className="folder-description">{editing?<form onSubmit={save}><FolderDescriptionInput value={value} onChange={setValue} disabled={busy||disabled}/><div><button type="submit" disabled={busy||disabled||value===(folder.description||'')}>{busy?'Saving…':'Save description'}</button><button type="button" disabled={busy} onClick={()=>{setValue(folder.description||'');setEditing(false);setError('')}}>Cancel</button></div></form>:<><p className="folder-description-text">{folder.description||'Add a description to explain what belongs in this folder.'}</p><button type="button" disabled={disabled} onClick={()=>setEditing(true)}>{folder.description?'Edit description':'Add description'}</button></>}{error&&<p role="alert">{error}</p>}</div>
}
