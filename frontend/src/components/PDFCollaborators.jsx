import { Users, ChevronDown } from 'lucide-react'
import {useState} from 'react'
import { collaborationActivity } from '../lib/pdfCollaborationActivity'
import './PDFCollaborators.css'

export default function PDFCollaborators({ members, participants = [], self, connected, status, onRevoke }) {
  const [target,setTarget]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const owner=members.some(member=>member.peer===self&&member.role==='Owner')
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
          {owner&&onRevoke&&member.role!=='Owner'&&member.peer!==self&&<button className="pdf-collaborator-revoke" type="button" disabled={busy} onClick={()=>{setTarget(member);setError('');setNotice('')}} aria-label={`Revoke access for ${member.name}`}>Revoke</button>}
        </li>)}</ul>}
        {owner&&target&&<div className="pdf-collaborator-confirm"><p>Revoke access for <strong>{target.name}</strong>? Their active sessions will be disconnected.</p><div><button type="button" disabled={busy} onClick={()=>setTarget(null)}>Cancel</button><button type="button" disabled={busy} onClick={revoke}>{busy?'Revoking…':'Revoke access'}</button></div><p>Public-link visitors could return as a new anonymous guest. Revoke the share link to block everyone using it.</p></div>}
        {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
        <p className="pdf-collaborators-note">Each person appears once, even with multiple tabs open. Visitors without a signed-in account appear as guests.</p>
      </div>
    </details>
  </div>
}
