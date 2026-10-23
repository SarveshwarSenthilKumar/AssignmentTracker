import {useEffect,useRef,useState} from 'react'
import {Timer,Play,Pause,RotateCcw,X} from 'lucide-react'

export default function PDFStopwatch({visible,onHide}){
  const elapsed=useRef(0),started=useRef(null)
  const [running,setRunning]=useState(false),[display,setDisplay]=useState(0)
  const current=()=>elapsed.current+(started.current===null?0:performance.now()-started.current)
  useEffect(()=>{
    if(!visible)return
    const update=()=>setDisplay(current())
    update()
    if(!running)return
    const timer=setInterval(update,200)
    document.addEventListener('visibilitychange',update)
    return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',update)}
  },[running,visible])
  const toggle=()=>{
    if(started.current===null){started.current=performance.now();setRunning(true)}
    else{elapsed.current=current();started.current=null;setDisplay(elapsed.current);setRunning(false)}
  }
  const reset=()=>{elapsed.current=0;started.current=null;setRunning(false);setDisplay(0)}
  if(!visible)return null
  const seconds=Math.floor(display/1000),hours=Math.floor(seconds/3600)
  const time=[hours,Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':')
  return <div className={`pdf-stopwatch${running?' is-running':''}`} role="group" aria-label="Stopwatch">
    <Timer size={14} aria-hidden="true"/>
    <output aria-label={`Elapsed time ${time}`} title={running?'Stopwatch running':'Stopwatch paused'} aria-live="off">{time}</output>
    <button type="button" className="pc-button pc-icon" onClick={toggle} aria-label={running?'Pause stopwatch':'Start stopwatch'} title={running?'Pause stopwatch':'Start stopwatch'}>{running?<Pause size={14}/>:<Play size={14}/>}</button>
    <button type="button" className="pc-button pc-icon" onClick={reset} aria-label="Reset stopwatch" title="Reset stopwatch"><RotateCcw size={14}/></button>
    <button type="button" className="pc-button pc-icon" onClick={onHide} aria-label="Hide stopwatch" title="Hide stopwatch (keeps running)"><X size={13}/></button>
  </div>
}
