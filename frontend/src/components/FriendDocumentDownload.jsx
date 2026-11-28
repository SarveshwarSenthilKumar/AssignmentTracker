import {useRef,useState} from 'react'
import {Download} from 'lucide-react'
import {downloadBlob} from '../lib/documentFormats'

export async function downloadFriendDocument(file, token) {
  const response=await fetch('/api/friend-shares/'+file._id+'/download',{
    cache:'no-store',headers:{Authorization:'Bearer '+token}
  })
  if(!response.ok){
    const data=await response.json().catch(()=>({}))
    throw new Error(data.message||'Could not download the shared document.')
  }
  downloadBlob(await response.blob(),file.originalName||file.name)
}

export default function FriendDocumentDownload({file,token}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  const pending=useRef(false)
  const download=async()=>{
    if(pending.current)return
    pending.current=true;setBusy(true);setError('')
    try{
      await downloadFriendDocument(file, token)
    }catch(error){setError(error.message)}
    finally{pending.current=false;setBusy(false)}
  }
  return <div className="friend-document-download">
    <button type="button" disabled={busy} onClick={download}><Download size={15} aria-hidden="true"/>{busy?'Downloading…':'Download private share'}</button>
    {error&&<small role="alert">{error}</small>}
  </div>
}
