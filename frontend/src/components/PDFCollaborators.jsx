import { Users, ChevronDown } from 'lucide-react'
import {useEffect,useState} from 'react'
import { collaborationActivity } from '../lib/pdfCollaborationActivity'
import './PDFCollaborators.css'

export default function PDFCollaborators({ members, participants = [], self, connected, status, onRevoke,onManageAdmin,onLoadAdmins,documentId }) {
  const [target,setTarget]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const owner=members.some(member=>member.peer===self&&member.role==='Owner')
  const manager=members.some(member=>member.peer===self&&['Owner','Admin'].includes(member.role))
  const [username,setUsername]=useState(''),[admins,setAdmins]=useState([])
  useEffect(()=>{
    if(!owner||!onLoadAdmins)return
    let active=true
    onLoadAdmins().then(list=>{if(active)setAdmins(list)}).catch(error=>{if(active)setError(error.message)})
    return()=>{active=false}
  },[owner,documentId])
  const setAdmin=async(name,enabled)=>{
    if(busy||!name.trim())return
    setBusy(true);setError('');setNotice('')
    try{await onManageAdmin({username:name,enabled});setNotice(`${name} ${enabled?'is now a document admin.':'is no longer a document admin.'}`);setUsername('');setAdmins(await onLoadAdmins())}catch(error){setError(error.message)}finally{setBusy(false)}
  }
  const revoke=async()=>{
    if(!target||busy)return
    setBusy(true);setError('');setNotice('')
    try{await onRevoke(target);setNotice(`Revoked access for ${target.name}.`);setTarget(null)}catch(error){setError(error.message)}finally{setBusy(false)}
  }
  const ordered = [...members].sort((a,b) => Number(b.peer===self)-Number(a.peer===self) || a.name.localeCompare(b.name))
  const activities=new Map(participants.map(peer=>[peer.person,collaborationActivity(peer.data)]))
  return <div className="pdf-live-bar">
    <p className="pdf-live-status" role="status">{connected ? status : 'Live connection reconnecting…'}</p>
    <details className="pdf-collaborators">
      <summary><Users size={16} aria-hidden="true"/><span>{connected ? `${members.length} online` : 'Who’s here'}</span>
        <span className="pdf-collaborator-avatars" aria-hidden="true">{ordered.slice(0,3).map(member=><i key={member.peer} style={{background:member.color}} title={member.name}>{member.name.slice(0,1).toUpperCase()}</i>)}</span>
        <ChevronDown size={13} aria-hidden="true"/>
      </summary>
      <div className="pdf-collaborators-panel">
        <h3>In this PDF</h3>
        {!connected && <p>Reconnecting to the live collaborator list…</p>}
        {connected && <ul>{ordered.map(member=><li key={member.peer}>
          <i className="pdf-collaborator-avatar" style={{background:member.color}} aria-hidden="true">{member.name.slice(0,1).toUpperCase()}</i>
          <span><strong>{member.name}{member.peer===self?' (you)':''}</strong><small>{member.role}</small>{activities.has(member.peer)&&<small className="pdf-collaborator-activity">{activities.get(member.peer).label}{activities.get(member.peer).page?` · Page ${activities.get(member.peer).page}`:''}</small>}</span>
          <span className="pdf-collaborator-online">Online</span>
          <div className="pdf-collaborator-actions">
          {owner&&member.role!=='Owner'&&member.signedIn&&onManageAdmin&&<button type="button" disabled={busy} onClick={()=>setAdmin(member.name,member.role!=='Admin')}>{member.role==='Admin'?'Remove admin':'Make admin'}</button>}
          {manager&&onRevoke&&member.role!=='Owner'&&(owner||member.role!=='Admin')&&member.peer!==self&&<button className="pdf-collaborator-revoke" type="button" disabled={busy} onClick={()=>{setTarget(member);setError('');setNotice('')}} aria-label={`Revoke access for ${member.name}`}>Revoke</button>}
          </div>
        </li>)}</ul>}
        {manager&&target&&<div className="pdf-collaborator-confirm"><p>Revoke access for <strong>{target.name}</strong>? Their active sessions will be disconnected.</p><div><button type="button" disabled={busy} onClick={()=>setTarget(null)}>Cancel</button><button type="button" disabled={busy} onClick={revoke}>{busy?'Revoking…':'Revoke access'}</button></div><p>Public-link visitors could return as a new anonymous guest. Revoke the share link to block everyone using it.</p></div>}
        {owner&&onManageAdmin&&<section className="pdf-document-admins"><h3>Document admins</h3><p>Admins can manage sharing links and revoke editors. Only you can change admin roles. Share an Editor link with them to open this document.</p>
          {admins.length>0&&<ul>{admins.map(admin=><li key={admin._id}><span>{admin.username}</span><button type="button" disabled={busy} onClick={()=>setAdmin(admin.username,false)}>Remove admin</button></li>)}</ul>}
          <form onSubmit={event=>{event.preventDefault();setAdmin(username,true)}}><label>Grant admin by username<input value={username} onChange={event=>setUsername(event.target.value)} disabled={busy} placeholder="Username" autoComplete="off"/></label><button type="submit" disabled={busy||!username.trim()}>Grant admin</button></form><p>This role applies only to this document.</p>
        </section>}
        {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
        <p className="pdf-collaborators-note">Each person appears once, even with multiple tabs open. Visitors without a signed-in account appear as guests.</p>
      </div>
    </details>
  </div>
}
