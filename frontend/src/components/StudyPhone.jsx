import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Smartphone, X, Minus, Home, ArrowLeft, Globe, FileText, Calculator, Timer, ListChecks, ExternalLink, Wifi, Grip } from 'lucide-react'
import { calculate } from '../lib/calculator'
import { taskDueLabel } from '../lib/calendar'
import { activeTimeZone } from '../lib/timeZone'
import './StudyPhone.css'
import { useAuth } from '../contexts/AuthContext'

export const toggleStudyPhone=()=>window.dispatchEvent(new Event('study-phone-toggle'))
export function StudyPhoneButton({className}){
  const {user}=useAuth()
  return user?.studyPhoneEnabled!==false?<button type="button" className={className} onClick={toggleStudyPhone} title="Study phone · Alt + P">Phone</button>:null
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value))
const apps=[['reference','Reference',Globe],['notes','Scratchpad',FileText],['calculator','Calculator',Calculator],['timer','Focus timer',Timer],['tasks','My tasks',ListChecks]]
function fit(rect){
  rect=rect&&typeof rect==='object'?Object.fromEntries(Object.entries(rect).filter(([,value])=>Number.isFinite(value))):{}
  const maxWidth=Math.max(1,(window.visualViewport?.width||window.innerWidth)-16),maxHeight=Math.max(1,(window.visualViewport?.height||window.innerHeight)-16)
  const width=clamp(rect?.width||320,Math.min(260,maxWidth),maxWidth),height=clamp(rect?.height||640,Math.min(380,maxHeight),maxHeight)
  return {width,height,x:clamp(rect?.x??window.innerWidth-width-20,8,Math.max(8,window.innerWidth-width-8)),y:clamp(rect?.y??70,8,Math.max(8,maxHeight-height+8))}
}
export default function StudyPhone({userId,tasks=[],enabled=true}){
  const key=`study-phone:${userId}`,[open,setOpen]=useState(false),[minimized,setMinimized]=useState(false),[app,setApp]=useState('home'),[host,setHost]=useState(document.fullscreenElement||document.body)
  const [rect,setRect]=useState(()=>{try{return fit(JSON.parse(localStorage.getItem(key)||'{}').rect)}catch{return fit()}}),[note,setNote]=useState(()=>{try{const value=JSON.parse(localStorage.getItem(key)||'{}').note;return typeof value==='string'?value.slice(0,20000):''}catch{return ''}}),[notice,setNotice]=useState(''),[clock,setClock]=useState(new Date()),[dragging,setDragging]=useState(false)
  const [address,setAddress]=useState(''),[url,setUrl]=useState(''),[expression,setExpression]=useState(''),[answer,setAnswer]=useState(''),[minutes,setMinutes]=useState(25),[remaining,setRemaining]=useState(1500),[deadline,setDeadline]=useState(null)
  const panel=useRef(null),gesture=useRef(null),frame=useRef(null),geometry=useRef(rect),restoreFocus=useRef(null),discard=useRef(false)
  const apply=value=>{geometry.current=value;if(panel.current)for(const [name,number]of Object.entries(value))panel.current.style.setProperty(`--phone-${name}`,`${number}px`)}
  const end=(cancel=false)=>{
    const active=gesture.current;if(!active)return
    if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null}
    gesture.current=null;document.documentElement.style.userSelect=active.selection;document.documentElement.style.cursor=active.cursor
    try{if(active.target.hasPointerCapture(active.pointerId))active.target.releasePointerCapture(active.pointerId)}catch{}
    const value=cancel?active.rect:active.next;apply(value);setRect(value);setDragging(false)
  }
  useEffect(()=>{
    if(!enabled){end();setOpen(false);setMinimized(false);setDeadline(null);return}
    const toggle=()=>{setOpen(value=>{if(!value)restoreFocus.current=document.activeElement;return !value});setMinimized(false)}
    const shortcut=event=>{if(event.altKey&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&(event.code==='KeyP'||event.key.toLowerCase()==='p')&&!event.repeat&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();toggle()}else if(event.key==='Escape'&&gesture.current){event.preventDefault();event.stopImmediatePropagation();end(true)}}
    const fullscreen=()=>{end();setHost(document.fullscreenElement||document.body)}
    const resize=()=>{end();setRect(value=>fit(value))}
    const blur=()=>end()

    window.addEventListener('study-phone-toggle',toggle);window.addEventListener('keydown',shortcut,true);document.addEventListener('fullscreenchange',fullscreen);window.addEventListener('resize',resize);window.addEventListener('blur',blur);window.visualViewport?.addEventListener('resize',resize)
    return()=>{end(true);window.removeEventListener('study-phone-toggle',toggle);window.removeEventListener('keydown',shortcut,true);document.removeEventListener('fullscreenchange',fullscreen);window.removeEventListener('resize',resize);window.removeEventListener('blur',blur);window.visualViewport?.removeEventListener('resize',resize)}
  },[userId,enabled])
  useEffect(()=>{
    const reset=event=>{if(event.detail!==userId)return;discard.current=true;setOpen(false);setDeadline(null);setNote('');setUrl('');setAddress('');try{localStorage.removeItem(key)}catch{}}
    window.addEventListener('workspace-reset',reset)
    return()=>window.removeEventListener('workspace-reset',reset)
  },[userId])
  useLayoutEffect(()=>{if(open&&!minimized){apply(fit(rect));panel.current?.focus({preventScroll:true})}},[open,minimized,host])
  useLayoutEffect(()=>{if(!gesture.current)apply(fit(rect))},[rect])
  useEffect(()=>{if(discard.current)return;try{localStorage.setItem(key,JSON.stringify({rect,note}))}catch{setNotice('Browser storage is unavailable. Copy your scratchpad before closing this session.')}},[rect,note,key])
  useEffect(()=>{if(!open)return;setClock(new Date());const timer=setInterval(()=>setClock(new Date()),15000);return()=>clearInterval(timer)},[open])
  useEffect(()=>{if(!deadline)return;const tick=()=>{const left=Math.max(0,Math.ceil((deadline-Date.now())/1000));setRemaining(left);if(!left){setDeadline(null);setNotice('Focus session complete.')}};tick();const timer=setInterval(tick,500);return()=>clearInterval(timer)},[deadline])
  const begin=(event,resize=false)=>{
    if(event.button!==0||event.isPrimary===false||gesture.current||(!resize&&event.target.closest('button')))return
    event.preventDefault();event.stopPropagation();const start=geometry.current
    gesture.current={rect:{...start},next:{...start},x:event.clientX,y:event.clientY,resize,target:event.currentTarget,pointerId:event.pointerId,selection:document.documentElement.style.userSelect,cursor:document.documentElement.style.cursor}
    event.currentTarget.setPointerCapture(event.pointerId);document.documentElement.style.userSelect='none';document.documentElement.style.cursor=resize?'nwse-resize':'grabbing';setDragging(true)
  }
  const move=event=>{
    const active=gesture.current;if(!active||event.pointerId!==active.pointerId)return
    const dx=event.clientX-active.x,dy=event.clientY-active.y
    active.next=fit(active.resize?{...active.rect,width:Math.min(window.innerWidth-active.rect.x-8,active.rect.width+dx),height:Math.min((window.visualViewport?.height||window.innerHeight)-active.rect.y-8,active.rect.height+dy)}:{...active.rect,x:active.rect.x+dx,y:active.rect.y+dy})
    if(frame.current===null)frame.current=requestAnimationFrame(()=>{frame.current=null;if(gesture.current)apply(gesture.current.next)})
  }
  const handlers={onPointerMove:move,onPointerUp:()=>end(),onPointerCancel:()=>end(true),onLostPointerCapture:()=>end()}
  const close=()=>{end();setOpen(false);restoreFocus.current?.isConnected&&restoreFocus.current.focus({preventScroll:true})}
  const copy=async()=>{try{await navigator.clipboard.writeText(note);setNotice('Scratchpad copied.')}catch{setNotice('Select the scratchpad text to copy it manually.')}}
  const browse=event=>{
    event.preventDefault();try{const next=new URL(/^https?:\/\//i.test(address.trim())?address.trim():`https://${address.trim()}`);if(!['http:','https:'].includes(next.protocol)||next.username||next.password||next.origin===location.origin)throw new Error();setUrl(next.href);setNotice('')}catch{setNotice('Enter an external http or https website address.')}
  }
  if(!enabled||!open)return null
  if(minimized)return createPortal(<button type="button" className="study-phone-minimized" onClick={()=>setMinimized(false)}><Smartphone size={16}/>Study phone{deadline?' · Timer running':''}</button>,host)
  return createPortal(<aside ref={panel} tabIndex={-1} data-phone-ui className={`study-phone${dragging?' is-dragging':''}`} role="dialog" aria-modal="false" aria-label="Study phone companion" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close()}}} onPointerDown={event=>event.stopPropagation()}>
    <header className="study-phone-handle" onPointerDown={event=>begin(event)} {...handlers}><span><Grip size={13}/>Study phone</span><div><button type="button" aria-label="Reset phone size and position" onClick={()=>setRect(fit())}>↺</button><button type="button" aria-label="Minimize phone" onClick={()=>setMinimized(true)}><Minus size={14}/></button><button type="button" aria-label="Close phone" onClick={close}><X size={14}/></button></div></header>
    <div className="study-phone-device"><div className="study-phone-status"><time>{clock.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone:activeTimeZone()})}</time><i/><Wifi size={12}/></div><div className="study-phone-appbar"><button type="button" aria-label="Phone home" onClick={()=>{setApp('home');setNotice('')}}><ArrowLeft size={15}/></button><strong>{apps.find(item=>item[0]===app)?.[1]||'Companion'}</strong><small>Alt + P</small></div>
      <main className="study-phone-screen">
        {app==='home'&&<div className="study-phone-home"><p>YOUR STUDY COMPANION</p><h2>{clock.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',timeZone:activeTimeZone()})}</h2><span>{clock.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric',timeZone:activeTimeZone()})}</span><div>{apps.map(([id,label,Icon])=><button type="button" key={id} onClick={()=>{setApp(id);setNotice('')}}><Icon size={23}/><span>{label}</span></button>)}</div><small>A simulated phone with study tools. Keep it beside your PDF or notes.</small></div>}
        {app==='notes'&&<div className="study-phone-pad"><label htmlFor="phone-scratchpad">Quick scratchpad · saved on this device</label><textarea id="phone-scratchpad" value={note} maxLength={20000} onChange={event=>setNote(event.target.value)} placeholder="Capture a thought without leaving your notes…"/><button type="button" onClick={copy}>Copy scratchpad</button></div>}
        {app==='calculator'&&<form className="study-phone-calculator" onSubmit={event=>{event.preventDefault();try{setAnswer(String(calculate(expression)));setNotice('')}catch(error){setNotice(error.message)}}}><label htmlFor="phone-expression">Expression</label><input id="phone-expression" value={expression} maxLength={1000} onChange={event=>setExpression(event.target.value)} placeholder="(12 + 8) / 4"/><output>{answer||'0'}</output><div>{['7','8','9','/','4','5','6','*','1','2','3','-','0','.','(',')'].map(value=><button type="button" key={value} onClick={()=>setExpression(previous=>previous+value)}>{value}</button>)}</div><div className="study-phone-calc-actions"><button type="button" onClick={()=>{setExpression('');setAnswer('')}}>Clear</button><button type="button" onClick={()=>setExpression(previous=>previous+'+')}>+</button><button type="submit">Calculate</button></div></form>}
        {app==='timer'&&<div className="study-phone-timer"><p>FOCUS SESSION</p><output role="timer">{String(Math.floor(remaining/60)).padStart(2,'0')}:{String(remaining%60).padStart(2,'0')}</output><div>{[5,15,25,50].map(value=><button type="button" key={value} disabled={!!deadline} onClick={()=>{setMinutes(value);setRemaining(value*60)}}>{value}m</button>)}</div><button type="button" onClick={()=>{if(deadline){setRemaining(Math.max(0,Math.ceil((deadline-Date.now())/1000)));setDeadline(null)}else setDeadline(Date.now()+(remaining||minutes*60)*1000)}}>{deadline?'Pause':'Start / resume'}</button><button type="button" onClick={()=>{setDeadline(null);setRemaining(minutes*60)}}>Reset</button><small>Continues while minimized or switching apps. Reloading resets the timer.</small></div>}
        {app==='tasks'&&<div className="study-phone-tasks"><h3>Active tasks</h3>{tasks.filter(task=>task.status!=='completed').slice(0,60).map(task=><article key={task._id}><strong>{task.text}</strong><small>{taskDueLabel(task,true)}</small><span>{task.status==='in-progress'?'In progress':'To do'}</span></article>)}{!tasks.some(task=>task.status!=='completed')&&<p>No active tasks.</p>}</div>}
        {app==='reference'&&<div className="study-phone-browser"><form onSubmit={browse}><input aria-label="Reference website address" value={address} onChange={event=>setAddress(event.target.value)} placeholder="https://example.com" maxLength={2000}/><button type="submit">Go</button></form>{url?<><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={12}/>Open website in a browser tab</a><small>Some sites block embedded views or require cookies. Use the link above when a page will not load.</small><iframe key={url} title="Phone reference website" src={url} sandbox="allow-scripts allow-forms" referrerPolicy="no-referrer"/></>:<p>Open a reference website beside your work. Only the address you submit is sent to that site.</p>}</div>}
      </main>{notice&&<p role="status" className="study-phone-notice">{notice}</p>}<footer><button type="button" aria-label="Return to phone home" onClick={()=>setApp('home')}><Home size={17}/></button></footer>
    </div><button type="button" className="study-phone-resize" aria-label="Resize phone" title="Drag to resize · Arrow keys resize; Shift for larger steps" onPointerDown={event=>begin(event,true)} {...handlers} onKeyDown={event=>{if(!event.key.startsWith('Arrow'))return;event.preventDefault();const step=event.shiftKey?40:10;setRect(previous=>fit({...previous,width:previous.width+(event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0),height:previous.height+(event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0)}))}}/>
  </aside>,host)
}
