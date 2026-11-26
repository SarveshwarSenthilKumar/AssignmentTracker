import {useRef,useState} from 'react'
import useFriends,{friendRequest,refreshFriends} from '../hooks/useFriends'
import './FriendSharing.css'

const sections=[['incoming','Incoming requests'],['outgoing','Sent requests'],['friend','Accepted friends']]

export default function AccountFriends({token}){
  const {friends,loading,error}=useFriends(token)
  const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[actionError,setActionError]=useState('')
  const lock=useRef(false)
  const run=async (operation,notice)=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setActionError('');setMessage('')
    try{await operation();refreshFriends();setMessage(notice)}
    catch(error){setActionError(error.message)}
    finally{lock.current=false;setBusy(false)}
  }
  const request=event=>{
    event.preventDefault()
    const address=email.trim()
    if(!address)return
    run(async()=>{
      await friendRequest(token,'/api/friends',{method:'POST',body:JSON.stringify({email:address})})
      setEmail('')
    },'Friend list updated.')
  }
  return <section className="account-card friend-sharing" aria-labelledby="account-friends-title">
    <h2 id="account-friends-title">Friends</h2>
    <p>Send a request using someone’s Assignment Tracker account email. Once they accept, you can share documents directly from the Share panel.</p>
    <form onSubmit={request} className="friend-sharing-form">
      <label>Account email<input type="email" required maxLength={254} value={email} disabled={busy} onChange={event=>setEmail(event.target.value)}/></label>
      <button type="submit" disabled={busy||!email.trim()}>Send request</button>
    </form>
    <button type="button" disabled={loading} onClick={refreshFriends}>Refresh friends</button>
    {loading&&<p role="status">Loading friends…</p>}
    {(actionError||error)&&<p role="alert">{actionError||error}</p>}
    {message&&<p role="status">{message}</p>}
    {sections.map(([status,title])=>{
      const entries=friends.filter(friend=>friend.status===status)
      return <section key={status}>
        <h3>{title}</h3>
        {!entries.length&&!loading&&!error&&<p>None yet.</p>}
        {entries.length>0&&<ul>{entries.map(friend=><li key={friend.id}>
          <strong>{friend.username}</strong>
          {status==='incoming'&&<button type="button" disabled={busy} onClick={()=>run(
            ()=>friendRequest(token,'/api/friends/'+friend.id+'/accept',{method:'POST'}),'Friend request accepted.'
          )}>Accept</button>}
          <button type="button" disabled={busy} aria-label={(status==='friend'?'Remove ':status==='incoming'?'Decline request from ':'Cancel request to ')+friend.username}
            onClick={()=>run(()=>friendRequest(token,'/api/friends/'+friend.id,{method:'DELETE'}),
              status==='friend'?'Friend removed. Private shares between you were revoked.':'Request removed.')}>
            {status==='friend'?'Remove':status==='incoming'?'Decline':'Cancel request'}
          </button>
        </li>)}</ul>}
      </section>
    })}
  </section>
}
