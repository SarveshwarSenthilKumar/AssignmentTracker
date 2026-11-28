import { FriendInviteLink } from './FriendInvite'
import {useRef,useState} from 'react'
import useFriends,{friendRequest,refreshFriends} from '../hooks/useFriends'
import './FriendSharing.css'

const sections=[['incoming','Incoming requests'],['outgoing','Sent requests'],['friend','Accepted friends']]

export default function AccountFriends({token}){
  const {friends,loading,error}=useFriends(token)
  const [lookup, setLookup] = useState('email')
  const [identifier, setIdentifier] = useState('')
  const [requestNote, setRequestNote] = useState('')
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[actionError,setActionError]=useState('')
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
    const value=identifier.trim()
    if(!value)return
    run(async()=>{
      await friendRequest(token,'/api/friends',{method:'POST',body:JSON.stringify({[lookup]:value,message:requestNote.trim()})})
      setIdentifier('')
      setRequestNote('')
    },'Friend request sent.')
  }
  return <section className="account-card friend-sharing" aria-labelledby="account-friends-title">
    <h2 id="account-friends-title">Friends</h2>
    <p>Send a request using someone’s Assignment Tracker username or account email. Once they accept, you can share documents directly from the Share panel.</p>
    <form onSubmit={request} className="friend-sharing-form">
      <label>Find by<select value={lookup} disabled={busy} onChange={event => {
        setLookup(event.target.value); setIdentifier(''); setActionError(''); setMessage('')
      }}><option value="email">Account email</option><option value="username">Username</option></select></label>
      <label>{lookup === 'username' ? 'Exact username' : 'Account email'}
        <input type={lookup === 'username' ? 'text' : 'email'} required maxLength={lookup === 'username' ? 1024 : 254}
          value={identifier} disabled={busy} onChange={event => setIdentifier(event.target.value)}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off"/>
      </label>
      <label className="friend-message-field">Message (optional)
        <textarea value={requestNote} onChange={event => setRequestNote(event.target.value)} maxLength={300}
          disabled={busy} rows={2} placeholder="Say how you know each other"/>
        <small>{requestNote.length} / 300</small>
      </label>
      <button type="submit" disabled={busy||!identifier.trim()}>Send request</button>
    </form>
    <FriendInviteLink token={token}/>
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
          {friend.message && <p className="friend-request-note">{friend.message}</p>}
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
