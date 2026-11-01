import {useEffect,useState} from 'react'
import {readApiJson} from '../lib/apiResponse'

const number=value=>new Intl.NumberFormat().format(value||0)
const bytes=value=>{if(!value)return '0 B';const unit=Math.min(Math.floor(Math.log(value)/Math.log(1024)),4);return `${(value/1024**unit).toFixed(unit?1:0)} ${['B','KiB','MiB','GiB','TiB'][unit]}`}
const percent=(value,total)=>total?`${(100*value/total).toFixed(1)}%`:'—'

export default function AdminStats({token}){
  const [days,setDays]=useState(30),[revision,setRevision]=useState(0),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('');setData(null)
    fetch(`/api/admin/stats?days=${days}`,{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}).then(async response=>{
      const result=await readApiJson(response);if(!response.ok)throw new Error(result.message||'Could not load statistics.');if(!controller.signal.aborted)setData(result)
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,days,revision])
  const accounts=data?.accounts||{},collections=data?.collections||[],tasks=collections.find(item=>item.name==='Todo'),chat=collections.find(item=>item.name==='AssistantConversation'),documents=collections.find(item=>item.name==='PDF')
  const completed=tasks?.statuses.find(item=>item._id==='completed')?.count||0,totalTasks=tasks?.statuses.reduce((sum,item)=>sum+item.count,0)||0
  const trend=data?Array.from({length:days},(_,index)=>{
    const date=new Date(data.since);date.setUTCDate(date.getUTCDate()+index);const day=date.toISOString().slice(0,10)
    return {day,signups:data.signups.find(item=>item._id===day)?.count||0,records:collections.reduce((sum,item)=>sum+(item.daily.find(row=>row._id===day)?.count||0),0)}
  }):[]
  const newRecords=trend.reduce((sum,item)=>sum+item.records,0)
  return <section className="admin-stats" aria-labelledby="admin-stats-title">
    <header className="admin-stats-toolbar"><div><h3 id="admin-stats-title">Advanced statistics</h3><p>Platform aggregates · Full administrators only</p></div><div><label>Reporting window <select value={days} onChange={event=>setDays(Number(event.target.value))}>{[7,30,90].map(value=><option key={value} value={value}>Last {value} days</option>)}</select></label><button disabled={loading} onClick={()=>setRevision(value=>value+1)}>Refresh statistics</button></div></header>
    {loading&&<p role="status">Calculating platform statistics…</p>}
    {error&&<p className="admin-feedback" role="alert">{error}</p>}
    {data&&<>
      <p className="admin-stats-note">Updated {new Date(data.generatedAt).toLocaleString()}. Reporting days use UTC and include the current partial day. Counts reflect records still stored, including trash and recovery where applicable. They are not traffic, login, retention or historical usage measurements.</p>
      <div className="admin-stats-cards">{[
        ['Accounts',number(accounts.count),'Current registered accounts'],
        ['New accounts',number(trend.reduce((sum,item)=>sum+item.signups,0)),`Created in this ${days}-day window`],
        ['Record creators',number(data.creators),'Distinct accounts creating core workspace / feedback records'],
        ['New records',number(newRecords),'Across the listed collections; excludes account records'],
        ['Logical storage',bytes(data.totalBytes),'Account records plus listed collections'],
        ['Task completion',percent(completed,totalTasks),`${number(completed)} of ${number(totalTasks)} retained tasks; excludes Canvas events`],
        ['Completed in window',number(tasks?.completed),'Retained tasks currently completed with a completion date in this window'],
        ['Chat contributors',number(chat?.contributors),'Accounts with saved messages in this window'],
        ['Active documents',number(documents?.storage.find(item=>item._id==='active')?.count),'Documents outside Trash']
      ].map(([title,value,note])=><article key={title}><span>{title}</span><strong>{value}</strong><small>{note}</small></article>)}</div>
      <div className="admin-stats-split"><section><h4>Account feature adoption</h4><p>Current settings across all accounts; not proof of feature use.</p><div className="admin-stats-table"><table><thead><tr><th>Setting</th><th>Accounts</th><th>Share</th></tr></thead><tbody>{[['Canvas configured',accounts.canvas],['Personal AI key saved',accounts.personalAIKey],['AI enabled',accounts.aiEnabled],['App-only chat enabled',accounts.appOnly]].map(([label,count])=><tr key={label}><th scope="row">{label}</th><td>{number(count)}</td><td>{percent(count,accounts.count)}</td></tr>)}</tbody></table></div></section>
      <section><h4>AI conversation activity</h4><p>Saved messages in the reporting window. Excludes provider requests, tokens, costs and unsaved attempts.</p><div className="admin-stats-table"><table><thead><tr><th>Message type</th><th>Messages</th><th>Failed</th><th>Partial</th></tr></thead><tbody>{['user','assistant'].map(role=>{const row=chat?.messages.find(item=>item._id===role);return <tr key={role}><th scope="row">{role==='user'?'User prompts':'Assistant replies'}</th><td>{number(row?.count)}</td><td>{number(row?.failed)}</td><td>{number(row?.partial)}</td></tr>})}</tbody></table></div></section></div>
      <section><h4>Record and storage inventory</h4><p>Logical BSON sizes include stored files, originals and metadata. Excludes database indexes, compression, replication, infrastructure backups, shared caches and device storage. Independently collected totals are not a transactional snapshot.</p><div className="admin-stats-table"><table><thead><tr><th>Collection</th><th>Stored records</th><th>Created in window</th><th>Logical size</th><th>Storage share</th></tr></thead><tbody><tr><th scope="row">Accounts</th><td>{number(accounts.count)}</td><td>{number(trend.reduce((sum,item)=>sum+item.signups,0))}</td><td>{bytes(accounts.bytes)}</td><td>{percent(accounts.bytes,data.totalBytes)}</td></tr>{[...collections].sort((a,b)=>b.bytes-a.bytes).map(item=><tr key={item.name}><th scope="row">{item.label}</th><td>{number(item.count)}</td><td>{number(item.daily.reduce((sum,row)=>sum+row.count,0))}</td><td>{bytes(item.bytes)}</td><td>{percent(item.bytes,data.totalBytes)}</td></tr>)}</tbody></table></div></section>
      <details><summary>Daily creation trend ({days} days)</summary><p>Zero-filled UTC days. Record creation excludes messages added to existing conversations and changes to existing records.</p><div className="admin-stats-table admin-stats-trend"><table><thead><tr><th>Day (UTC)</th><th>New accounts</th><th>New records</th></tr></thead><tbody>{trend.map(row=><tr key={row.day}><th scope="row">{row.day}</th><td>{number(row.signups)}</td><td>{number(row.records)}</td></tr>)}</tbody></table></div></details>
      <p className="admin-stats-note">Only aggregate statistics are returned. This dashboard does not return account identities, credentials, document titles, document text, prompts or answers.</p>
    </>}
  </section>
}
