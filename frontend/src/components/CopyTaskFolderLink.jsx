import {useRef,useState} from 'react'
import {Link2} from 'lucide-react'

export default function CopyTaskFolderLink({url}){
  const field=useRef(null)
  const [notice,setNotice]=useState('')
  const copy=async()=>{
    try{await navigator.clipboard.writeText(url);setNotice('Link copied.')}
    catch{field.current?.focus();field.current?.select();setNotice('Copy the selected link.')}
  }
  return <div className="task-folder-share-link">
    <label>Shareable link<input ref={field} type="url" value={url} readOnly onFocus={event=>event.target.select()}/></label>
    <button type="button" onClick={copy}><Link2 size={16} aria-hidden="true"/>Copy link</button>
    {notice&&<small role="status">{notice}</small>}
  </div>
}
