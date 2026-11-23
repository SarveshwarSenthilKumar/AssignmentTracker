import {useEffect,useState} from 'react'
import {MAX_WALL_SIZE,MIN_TEXT_SIZE} from '../lib/detectiveWallLimits'

export default function DetectiveStringWidth({value,onChange,onStart,label}){
  const [draft,setDraft]=useState(value)
  useEffect(()=>setDraft(value),[value])
  const commit=()=>{
    const parsed=Number(draft)
    if(draft===''||!Number.isFinite(parsed)){setDraft(value);return}
    const next=Math.max(MIN_TEXT_SIZE,Math.min(MAX_WALL_SIZE,parsed));setDraft(next);onChange(next)
  }
  return <label className="detective-string-size">Thickness
    <input aria-label={`${label} slider`} type="range" min={MIN_TEXT_SIZE} max={Math.min(MAX_WALL_SIZE,Math.max(24,value*2))} step=".1" value={value} onFocus={onStart} onChange={event=>onChange(Number(event.target.value))}/>
    <input className="detective-width-value" aria-label={label} type="number" min={MIN_TEXT_SIZE} max={MAX_WALL_SIZE} step="any" value={draft} onFocus={onStart} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{event.stopPropagation();if(event.key==='Enter')event.currentTarget.blur()}}/><span>px</span>
  </label>
}
