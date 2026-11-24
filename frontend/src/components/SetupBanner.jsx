import {useEffect,useState} from 'react'
import {CheckCircle2,ChevronDown,KeyRound,Settings2,X} from 'lucide-react'
import {PDF_FINGER_MODE_CHANGED,readPDFFingerMode,savePDFFingerMode} from '../lib/pdfFingerMode'
import './SetupBanner.css'

const readProgress=id=>{try{return JSON.parse(localStorage.getItem(`workspace-setup:${id}`)||'{}')||{}}catch{return {}}}

export default function SetupBanner({token,userId,page,canvasStatus}){
  const [progress,setProgress]=useState(()=>readProgress(userId))
  const [fingerMode,setFingerMode]=useState(readPDFFingerMode)
  useEffect(()=>{
    const changed=event=>setFingerMode(event.detail)
    window.addEventListener(PDF_FINGER_MODE_CHANGED,changed)
    return()=>window.removeEventListener(PDF_FINGER_MODE_CHANGED,changed)
  },[])
  const [credentials,setCredentials]=useState(null),[error,setError]=useState(false)
  const [expanded,setExpanded]=useState(false),[destination,setDestination]=useState(null),[refresh,setRefresh]=useState(0)
  useEffect(()=>{setProgress(readProgress(userId));setExpanded(false)},[userId])
  const update=patch=>setProgress(previous=>{const next={...previous,...patch};try{localStorage.setItem(`workspace-setup:${userId}`,JSON.stringify(next))}catch{}return next})
  useEffect(()=>{
    const controller=new AbortController()
    const load=async()=>{
      try{
        const response=await fetch('/api/account/ai-settings',{headers:{Authorization:`Bearer ${token}`},signal:controller.signal})
        if(!response.ok)throw new Error('Unable to load setup status')
        const data=await response.json()
        if(!controller.signal.aborted){setCredentials(data);setError(false)}
      }catch{if(!controller.signal.aborted)setError(true)}
    }
    setCredentials(null);load()
    window.addEventListener('assistant-credentials-changed',load)
    window.addEventListener('focus',load)
    return()=>{controller.abort();window.removeEventListener('assistant-credentials-changed',load);window.removeEventListener('focus',load)}
  },[token,refresh])
  useEffect(()=>{
    if(!destination||page!==destination.route)return
    const frame=requestAnimationFrame(()=>{
      const element=document.getElementById(destination.id)
      if(element){element.scrollIntoView({behavior:'smooth',block:'start'});element.setAttribute('tabindex','-1');element.focus({preventScroll:true})}
      setDestination(null)
    })
    return()=>cancelAnimationFrame(frame)
  },[page,destination])
  const hasKey=credentials?.hasPersonalKey&&!credentials?.needsReplacement
  const tasks=[
    {id:'key',title:credentials?.needsReplacement?'Replace your Gemini API key':'Add your Gemini API key',description:'Required for AI chats, file questions and AI study tools.',done:!!hasKey,automatic:true,route:'account',target:'account-ai-title'},
    {id:'preferences',title:'Review your preferences',description:'Check your time zone, appearance and other account settings.',done:!!progress.preferences,route:'account',target:'account-preferences-title'},
    {id:'pdf-finger',title:'Choose how one finger works in PDFs',description:'Scroll is the default. You can switch modes anytime in the PDF toolbar.',done:!!progress['pdf-finger']},
    {id:'tutorial',title:'Explore the platform tutorial',description:'Learn the editor, tasks, calendar and sharing tools.',done:!!progress.tutorial,route:'tutorial'},
    {id:'canvas',title:'Connect Canvas (optional)',description:'Import your courses and assignments, or skip this step.',done:!!canvasStatus?.hasCredentials||!!progress.canvas,automatic:!!canvasStatus?.hasCredentials,route:'canvas',optional:true}
  ]
  const remaining=tasks.filter(task=>!task.done)
  const openTask=(event,task)=>{
    if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return
    if(task.target)setDestination({route:task.route,id:task.target})
  }
  if(progress.dismissed)return <div className="setup-banner-collapsed"><button type="button" onClick={()=>update({dismissed:false})}><Settings2 size={14}/>Setup checklist{credentials&&!hasKey?' · API key missing':''}</button></div>
  return <section className="setup-banner" aria-label="Account setup">
    <div className="setup-banner-heading">
      {remaining.length?<KeyRound size={19} aria-hidden="true"/>:<CheckCircle2 size={19} aria-hidden="true"/>}
      <div><strong>{remaining.length?'Finish setting up your workspace':'Your workspace is ready'}</strong><p>{credentials&&!hasKey?'Set up your Gemini API key to use AI features. ':''}{remaining.length?`${remaining.length} setup ${remaining.length===1?'item':'items'} remaining.`:'All setup items are complete.'}</p></div>
      <div className="setup-banner-actions">
        {credentials&&!hasKey&&<a href="#/account" onClick={event=>openTask(event,tasks[0])}>Set up API key</a>}
        <button type="button" aria-expanded={expanded} aria-controls="workspace-setup-checklist" onClick={()=>setExpanded(value=>!value)}>Checklist<ChevronDown size={15} className={expanded?'is-expanded':''}/></button>
        <button type="button" aria-label="Dismiss setup banner" title="Dismiss; reopen using Setup checklist" onClick={()=>update({dismissed:true})}><X size={17}/></button>
      </div>
    </div>
    {error&&<p className="setup-banner-error" role="status">Could not check API key status. <button type="button" onClick={()=>setRefresh(value=>value+1)}>Retry</button></p>}
    {expanded&&<ul id="workspace-setup-checklist" className="setup-banner-list">{tasks.map(task=><li key={task.id}>
      <span className={`setup-banner-dot${task.done?' is-done':''}`} aria-label={task.done?'Complete':'Incomplete'}>{task.done&&<CheckCircle2 size={18}/>}</span>
      <div><strong>{task.title}</strong><p>{task.description}</p></div>
      {task.id==='pdf-finger'?<div className="setup-banner-actions" role="group" aria-label="One-finger PDF input">
        {['scroll','draw'].map(mode=><button key={mode} type="button" aria-pressed={fingerMode===mode} onClick={()=>{
          savePDFFingerMode(mode)
          update({'pdf-finger':true})
        }}>{mode==='scroll'?'Scroll (default)':'Draw'}</button>)}
      </div>:<div className="setup-banner-actions"><a href={`#/${task.route}`} onClick={event=>openTask(event,task)}>{task.done?'Review':'Open'}</a>{!task.automatic&&<button type="button" onClick={()=>update({[task.id]:!task.done})}>{task.done?'Reset':task.optional?'Skip':'Mark done'}</button>}</div>}
    </li>)}</ul>}
  </section>
}
