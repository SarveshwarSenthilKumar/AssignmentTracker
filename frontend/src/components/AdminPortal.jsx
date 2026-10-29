import {useEffect,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'
import BugReportsPage from './BugReportsPage'
import FeatureSuggestionsPage from './FeatureSuggestionsPage'
import './AdminPortal.css'

export default function AdminPortal({token,user}){
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),[active,setActive]=useState(''),[visited,setVisited]=useState([])
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('')
    fetch('/api/admin/overview',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'}).then(async response=>{
      const result=await readApiJson(response);if(!response.ok){const failure=new Error(result.message||'Could not open the admin portal.');failure.status=response.status;throw failure}
      if(!result.capabilities||(!result.capabilities.bugs&&!result.capabilities.features))throw new Error('No review permissions were returned.')
      if(!controller.signal.aborted){setData(result);setActive(previous=>result.capabilities[previous]?previous:result.capabilities.bugs?'bugs':'features')}
    }).catch(reason=>{if(!controller.signal.aborted){setError(reason.message);if(reason.status===403||reason.status===401){setData(null);setVisited([])}}}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,revision])
  useEffect(()=>{if(active)setVisited(previous=>previous.includes(active)?previous:[...previous,active])},[active])
  if(!data)return <section className="admin-portal"><h2>Feedback administration</h2>{loading?<p role="status">Checking review permissions…</p>:<><p role="alert" className="admin-feedback">{error}</p><p>This portal is available to configured bug-report and feature-suggestion reviewers. Ordinary accounts can track their own submissions on the reporting pages.</p><div className="admin-actions"><button onClick={()=>setRevision(value=>value+1)}>Retry access check</button><a href="#/report-bug">My bug reports</a><a href="#/suggest-feature">My suggestions</a></div></>}</section>
  const count=(summary,...keys)=>keys.reduce((sum,key)=>sum+(summary?.statuses.find(item=>item._id===key)?.count||0),0)
  const select=id=>setActive(id)
  return <section className="admin-portal" aria-label="Feedback admin portal"><header><div><p className="admin-eyebrow">ADMIN PORTAL</p><h2>Reports & suggestions</h2><p>Review submissions from users, update their status and leave responses visible to the submitter.</p><small>Summary updated {new Date(data.generatedAt).toLocaleString()}</small></div><button disabled={loading} onClick={()=>setRevision(value=>value+1)}>{loading?'Refreshing…':'Refresh summary'}</button></header>{error&&<p role="alert" className="admin-feedback">{error}</p>}
    <div className="admin-metrics">{data.bugs&&<><button onClick={()=>select('bugs')}><span>Bug reports</span><strong>{data.bugs.total}</strong><small>{count(data.bugs,'open')} open · {count(data.bugs,'in-review')} in review</small></button><button onClick={()=>select('bugs')}><span>Urgent active bugs</span><strong>{data.bugs.urgent}</strong><small>Major or blocking · open / in review</small></button><button onClick={()=>select('bugs')}><span>New bugs this week</span><strong>{data.bugs.recent}</strong><small>Submitted in the last 7 days</small></button></>}{data.features&&<><button onClick={()=>select('features')}><span>Feature suggestions</span><strong>{data.features.total}</strong><small>{count(data.features,'submitted','reviewing')} awaiting a decision</small></button><button onClick={()=>select('features')}><span>Important pending ideas</span><strong>{data.features.urgent}</strong><small>Important or essential priority</small></button><button onClick={()=>select('features')}><span>New ideas this week</span><strong>{data.features.recent}</strong><small>Submitted in the last 7 days</small></button></>}</div>
    <nav className="admin-tabs" aria-label="Feedback inboxes">{data.capabilities.bugs&&<button aria-pressed={active==='bugs'} aria-controls="admin-bugs" onClick={()=>select('bugs')}>Bug reports ({data.bugs.total})</button>}{data.capabilities.features&&<button aria-pressed={active==='features'} aria-controls="admin-features" onClick={()=>select('features')}>Feature suggestions ({data.features.total})</button>}</nav><p>Inbox filters and refresh controls are separate from the summary. Switching inboxes keeps unsaved review text in place. Only saved responses are sent back to the user.</p>
    {visited.includes('bugs')&&data.capabilities.bugs&&<section id="admin-bugs" hidden={active!=='bugs'} aria-label="All bug reports"><BugReportsPage token={token} user={user} reviewOnly onReviewed={()=>setRevision(value=>value+1)}/></section>}
    {visited.includes('features')&&data.capabilities.features&&<section id="admin-features" hidden={active!=='features'} aria-label="All feature suggestions"><FeatureSuggestionsPage token={token} user={user} reviewOnly onReviewed={()=>setRevision(value=>value+1)}/></section>}
    <p className="admin-footnote">Reports and suggestions are private. Reviewer responses appear in users’ submission histories; this portal does not send email. Publishing a separate roadmap summary also requires roadmap editor access.</p>
  </section>
}
