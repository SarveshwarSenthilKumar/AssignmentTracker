import {useEffect,useRef,useState} from 'react'
import {Hourglass,Play,Pause,RotateCcw,X} from 'lucide-react'

const format=milliseconds=>{
  const seconds=Math.max(0,Math.ceil(milliseconds/1000))
  return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(n=>String(n).padStart(2,'0')).join(':')
}

export default function PDFCountdown({visible,onHide}){
  const [minutes,setMinutes]=useState('25'),[seconds,setSeconds]=useState('0')
  const [duration,setDuration]=useState(25*60000),[remaining,setRemaining]=useState(25*60000)
  const [running,setRunning]=useState(false),[finished,setFinished]=useState(false),[error,setError]=useState(''),[sound,setSound]=useState(true)
  const deadline=useRef(null),audio=useRef(null),soundEnabled=useRef(sound)
  soundEnabled.current=sound
  useEffect(()=>()=>{audio.current?.close().catch(()=>{})},[])
  useEffect(()=>{
    if(!running)return
    const update=()=>{
      if(deadline.current===null)return
      const left=Math.max(0,deadline.current-Date.now())
      // A hidden timer still checks completion, but avoids rendering every tick.
      if(visible||left===0)setRemaining(left)
      if(left===0){
        deadline.current=null;setRunning(false);setFinished(true)
        const ctx=audio.current
        if(soundEnabled.current&&ctx?.state==='running'){
          for(let i=0;i<3;i++){
            const oscillator=ctx.createOscillator(),gain=ctx.createGain(),start=ctx.currentTime+i*.35
            oscillator.frequency.value=880;gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(.12,start+.02);gain.gain.exponentialRampToValueAtTime(.001,start+.22)
            oscillator.connect(gain);gain.connect(ctx.destination);oscillator.start(start);oscillator.stop(start+.25)
            oscillator.onended=()=>{oscillator.disconnect();gain.disconnect()}
          }
        }
      }
    }
    update();const interval=setInterval(update,250)
    document.addEventListener('visibilitychange',update)
    return()=>{clearInterval(interval);document.removeEventListener('visibilitychange',update)}
  },[running,visible])
  const toggle=()=>{
    if(running){setRemaining(Math.max(0,(deadline.current||Date.now())-Date.now()));deadline.current=null;setRunning(false);return}
    if(sound){try{const Audio=window.AudioContext||window.webkitAudioContext;if(Audio){audio.current??=new Audio();audio.current.resume().catch(()=>{})}}catch{/* Visual completion remains available without audio. */}}
    const left=remaining>0?remaining:duration
    deadline.current=Date.now()+left;setRemaining(left);setFinished(false);setRunning(true)
  }
  const reset=()=>{deadline.current=null;setRunning(false);setRemaining(duration);setFinished(false)}
  const apply=event=>{
    event.preventDefault()
    const m=Number(minutes),s=Number(seconds)
    if(!minutes.trim()||!seconds.trim()||!Number.isInteger(m)||!Number.isInteger(s)||m<0||m>1440||s<0||s>59||m*60+s<=0||m*60+s>86400){setError('Choose a duration between 1 second and 24 hours (seconds: 0–59).');return}
    const value=(m*60+s)*1000
    deadline.current=null;setRunning(false);setDuration(value);setRemaining(value);setFinished(false);setError('')
    event.currentTarget.closest('details')?.removeAttribute('open')
  }
  if(!visible&&!finished)return null
  return <div className={`pdf-stopwatch pdf-countdown${running?' is-running':''}${finished?' is-finished':''}`} role="group" aria-label="Countdown timer">
    {visible&&<>
      <Hourglass size={14} aria-hidden="true"/>
      <details className="pdf-countdown-settings">
        <summary title="Set timer duration" aria-label={`Set timer duration. Remaining ${format(remaining)}`}>{format(remaining)}</summary>
        <form onSubmit={apply} className="pdf-countdown-popover" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();event.currentTarget.closest('details').removeAttribute('open');event.currentTarget.closest('details').querySelector('summary').focus()}}>
          <strong>Countdown timer</strong>
          <div className="pdf-countdown-duration"><label>Minutes<input type="number" min="0" max="1440" step="1" value={minutes} onChange={event=>setMinutes(event.target.value)} required/></label><label>Seconds<input type="number" min="0" max="59" step="1" value={seconds} onChange={event=>setSeconds(event.target.value)} required/></label></div>
          <label className="pc-checkbox"><input type="checkbox" checked={sound} onChange={event=>setSound(event.target.checked)}/>Play completion sound</label>
          {error&&<p role="alert">{error}</p>}
          <small>Applying a duration resets the timer.</small>
          <button type="submit" className="pc-button">Set duration</button>
        </form>
      </details>
      <button type="button" className="pc-button pc-icon" onClick={toggle} aria-label={running?'Pause timer':'Start timer'} title={running?'Pause timer':'Start timer'}>{running?<Pause size={14}/>:<Play size={14}/>}</button>
      <button type="button" className="pc-button pc-icon" onClick={reset} aria-label="Reset timer" title="Reset timer"><RotateCcw size={14}/></button>
      <button type="button" className="pc-button pc-icon" onClick={onHide} aria-label="Hide timer" title="Hide timer (keeps running)"><X size={13}/></button>
    </>}
    {finished&&<div className="pdf-countdown-complete"><span role="alert">Time’s up!</span><button type="button" className="pc-button" onClick={()=>setFinished(false)} aria-label="Dismiss timer completion">Dismiss</button></div>}
  </div>
}
