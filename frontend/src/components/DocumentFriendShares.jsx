import {useEffect,useRef,useState} from 'react'
import useFriends,{friendRequest} from '../hooks/useFriends'
import './FriendSharing.css'

export default function DocumentFriendShares({file,token,onClose}){
  const {friends,loading:loadingFriends,error:friendsError}=useFriends(token)
  const [shareNote, setShareNote] = useState('')
  const [recipient,setRecipient]=useState(''),[shared,setShared]=useState(null)
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('')
  const lock=useRef(false)
  const endpoint='/api/friend-shares/'+file._id
  useEffect(()=>{
    const controller=new AbortController()
    friendRequest(token,endpoint,{signal:controller.signal}).then(data=>{
      if(!controller.signal.aborted)setShared(data)
    }).catch(error=>{if(!controller.signal.aborted)setError(error.message)})
    return()=>controller.abort()
  },[token,endpoint])
  const accepted=friends.filter(friend=>friend.status==='friend')
  const available=accepted.filter(friend=>!shared?.includes(friend.accountId))
  const canShare=available.some(friend=>friend.accountId===recipient)
  const update=async (friend,revoke)=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setMessage('')
    try{
      await friendRequest(token,revoke?endpoint+'/'+friend:endpoint,revoke?{method:'DELETE'}:
        {method:'POST',body:JSON.stringify({recipient:friend,message:shareNote.trim()})})
      setShared(previous=>revoke?previous.filter(id=>id!==friend):[...new Set([...previous,friend])])
      setMessage(revoke?'Private access revoked.':'Shared privately. Your friend can find it in Shared with me.')
      if(!revoke){setRecipient('');setShareNote('')}
    }catch(error){setError(error.message)}
    finally{lock.current=false;setBusy(false)}
  }
  return <section className="friend-sharing document-friend-sharing" aria-label="Share privately with friends">
    <h4>Share with friends</h4>
    <p>Friends you choose can download the saved file from Shared with me.</p>
    <a href="#/account" onClick={onClose}>Manage friends in Account</a>
    {loadingFriends&&<p role="status">Loading friends…</p>}
    {(error||friendsError)&&<p role="alert">{error||friendsError}</p>}
    {message&&<p role="status">{message}</p>}
    {shared&&available.length>0&&<div className="friend-sharing-form">
      <label>Friend<select value={canShare?recipient:''} onChange={event=>setRecipient(event.target.value)} disabled={busy}>
        <option value="">Choose a friend</option>
        {available.map(friend=><option key={friend.id} value={friend.accountId}>{friend.username}</option>)}
      </select></label>
      <label className="friend-message-field">Private message (optional)
        <textarea rows={2} maxLength={300} value={shareNote} disabled={busy}
          onChange={event => setShareNote(event.target.value)} placeholder="Tell your friend why you’re sharing this file"/>
        <small>{shareNote.length} / 300</small>
      </label>
      <button type="button" disabled={busy||!canShare} onClick={()=>update(recipient,false)}>Share privately</button>
    </div>}
    {!loadingFriends&&!friendsError&&!accepted.length&&<p>Send or accept a friend request in Account to share privately.</p>}
    {shared&&accepted.some(friend=>shared.includes(friend.accountId))&&<ul>{accepted.filter(friend=>shared.includes(friend.accountId)).map(friend=><li key={friend.id}>
      <strong>{friend.username}</strong><span>Viewer</span>
      <button type="button" disabled={busy} aria-label={'Revoke private access for '+friend.username} onClick={()=>update(friend.accountId,true)}>Revoke access</button>
    </li>)}</ul>}
  </section>
}
