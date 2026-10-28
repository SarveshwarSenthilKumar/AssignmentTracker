import {useEffect,useMemo,useRef,useState} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {readApiJson} from '../lib/apiResponse'
import {downloadBlob} from '../lib/documentFormats'
import './HandbookPage.css'

export default function HandbookPage({token}){
  const [text,setText]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query,setQuery]=useState(''),[active,setActive]=useState('all'),[downloading,setDownloading]=useState(false),[revision,setRevision]=useState(0)
  const article=useRef(null)
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError('')
    fetch('/api/handbook',{headers:{Authorization:`Bearer ${token}`},cache:'no-store',signal:controller.signal}).then(async response=>{
      if(!response.ok){const data=await readApiJson(response);throw new Error(data.message||'Could not load the handbook.')}
      const body=await response.text();if(!body.trim()||!response.headers.get('content-type')?.includes('text/markdown'))throw new Error('The handbook response is unavailable. Restart the updated backend.')
      if(!controller.signal.aborted)setText(body)
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[token,revision])
  const chapters=useMemo(()=>text.split(/(?=^# )/m).filter(value=>value.trim()).map((body,index)=>({id:String(index),title:body.match(/^# (.+)$/m)?.[1]||'Introduction',body})),[text])
  const matches=useMemo(()=>chapters.filter(chapter=>chapter.body.toLowerCase().includes(query.trim().toLowerCase())),[chapters,query])
  const visible=active==='all'?matches:matches.filter(chapter=>chapter.id===active)
  const download=async()=>{
    if(downloading)return;setDownloading(true);setError('')
    try{const response=await fetch('/api/handbook/pdf',{headers:{Authorization:`Bearer ${token}`},cache:'no-store'});if(!response.ok){const data=await readApiJson(response);throw new Error(data.message||'Could not download the handbook.')}if(!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('The PDF response is unavailable. Restart the updated backend.');await downloadBlob(await response.blob(),'AssignmentTracker-Product-and-Technical-Handbook.pdf')}
    catch(reason){setError(reason.message)}finally{setDownloading(false)}
  }
  const select=id=>{setActive(id);requestAnimationFrame(()=>{article.current?.focus({preventScroll:true});article.current?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})})}
  return <section className="handbook-page" aria-label="Product handbook"><header><div><h2>Product & technical handbook</h2><p>Feature instructions, numbered updates, implementation notes and limitations.</p></div><button type="button" onClick={download} disabled={loading||downloading}>{downloading?'Downloading…':'Download PDF'}</button></header>
    {error&&<div role="alert" className="handbook-error">{error} <button type="button" onClick={()=>setRevision(value=>value+1)}>Reload handbook</button></div>}
    {loading?<p role="status">Loading handbook…</p>:<><label className="handbook-search">Find a feature or update<input type="search" value={query} onChange={event=>{setQuery(event.target.value);setActive('all')}} placeholder="Search chapters, features or update numbers…"/></label><div className="handbook-layout"><nav aria-label="Handbook chapters"><button type="button" aria-pressed={active==='all'} onClick={()=>select('all')}>All matching chapters ({matches.length})</button>{matches.map(chapter=><button type="button" key={chapter.id} aria-pressed={active===chapter.id} onClick={()=>select(chapter.id)}>{chapter.title}</button>)}</nav><article ref={article} tabIndex={-1} aria-label="Handbook content">{visible.length?visible.map(chapter=><div key={chapter.id}><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children})=><a href={href} target={/^https?:/i.test(href||'')?'_blank':undefined} rel="noopener noreferrer">{children}</a>}}>{chapter.body}</ReactMarkdown></div>):<p>No chapters match this search.</p>}</article></div></>}
  </section>
}
