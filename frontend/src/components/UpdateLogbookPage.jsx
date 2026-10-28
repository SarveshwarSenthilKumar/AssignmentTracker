import {useEffect,useMemo,useRef,useState} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {readApiJson} from '../lib/apiResponse'
import {downloadBlob} from '../lib/documentFormats'
import './HandbookPage.css'

export default function UpdateLogbookPage({token}){
  const [text,setText]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[active,setActive]=useState('all'),[limit,setLimit]=useState(20),[revision,setRevision]=useState(0)
  const content=useRef(null)
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('')
    fetch('/api/logbook',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok){const data=await readApiJson(response);throw new Error(data.message||'Could not load the update logbook.')}
      if(!response.headers.get('content-type')?.includes('text/markdown'))throw new Error('The update logbook endpoint is unavailable. Restart the updated backend.')
      const body=await response.text();if(!body.trim())throw new Error('The update logbook is empty.')
      if(!controller.signal.aborted)setText(body)
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,revision])
  const updates=useMemo(()=>Array.from(text.matchAll(/^## Update (\d+)\s*\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm),match=>({id:match[1],body:match[0],summary:match[2].match(/\*\*Change:\*\* (.+)/)?.[1]||'Documentation update'})).sort((a,b)=>Number(b.id)-Number(a.id)),[text])
  const matches=useMemo(()=>{const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);return updates.filter(update=>terms.every(term=>update.body.toLowerCase().includes(term)))},[updates,query])
  const selected=active==='all'?matches.slice(0,limit):matches.filter(update=>update.id===active)
  const choose=id=>{setActive(id);requestAnimationFrame(()=>{content.current?.focus({preventScroll:true});content.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})})}
  return <section className="handbook-page" aria-label="Platform update logbook"><header><div><h2>Update logbook</h2><p>Numbered changes, dates, commit references, implementation notes and changed files. {updates.length>0&&`${updates.length} recorded updates.`}</p></div><div className="logbook-actions"><button type="button" disabled={loading} onClick={()=>setRevision(value=>value+1)}>Refresh</button><button type="button" disabled={!text||loading} onClick={()=>downloadBlob(new Blob([text],{type:'text/markdown;charset=utf-8'}),'AssignmentTracker-Update-Logbook.md').catch(reason=>setError(reason.message))}>Download logbook</button></div></header>
    {error&&<p className="handbook-error" role="alert">{error}</p>}
    {loading?<p role="status">Loading update history…</p>:<><label className="handbook-search">Search update history<input type="search" value={query} placeholder="Update number, feature, commit or file…" onChange={event=>{setQuery(event.target.value);setActive('all');setLimit(20)}}/></label><p className="logbook-note">Newest updates first. Update numbers identify recorded changes, not application release versions. This page reads LOGBOOK.md; it does not automatically invent entries from runtime activity.</p><div className="handbook-layout"><nav aria-label="Numbered updates"><button type="button" aria-pressed={active==='all'} onClick={()=>choose('all')}>All matches ({matches.length})</button>{matches.map(update=><button key={update.id} type="button" aria-pressed={active===update.id} onClick={()=>choose(update.id)}>Update {update.id}<span className="logbook-summary">{update.summary}</span></button>)}</nav><article ref={content} tabIndex={-1} aria-label="Update history">{selected.map(update=><section key={update.id}><ReactMarkdown remarkPlugins={[remarkGfm]}>{update.body}</ReactMarkdown></section>)}{!selected.length&&<p>No updates match your search.</p>}{active==='all'&&matches.length>limit&&<button type="button" onClick={()=>setLimit(value=>value+20)}>Show 20 more updates</button>}</article></div><details className="logbook-about"><summary>Coverage and verification notes</summary><ReactMarkdown remarkPlugins={[remarkGfm]}>{text.split(/^## Recent update index/m)[0]}</ReactMarkdown></details></>}
  </section>
}
