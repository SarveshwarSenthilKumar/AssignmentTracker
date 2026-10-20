import { useEffect, useRef, useState } from 'react'
import { X, Pen, Eraser, Move, Undo, Redo, ChevronLeft, ChevronRight, Power, RotateCcw } from 'lucide-react'
import './PDFStylusSettings.css'

export const STYLUS_ACTIONS=[['eraser','Erase','Hold to erase',Eraser],['pan','Pan','Hold and drag the page',Move],['undo','Undo','One undo per press',Undo],['redo','Redo','One redo per press',Redo],['previous','Previous page','Go back one page',ChevronLeft],['next','Next page','Go forward one page',ChevronRight],['none','Disabled','Use the selected tool',Power]]
export default function PDFStylusSettings({barrel,onBarrel,tip,onTip,extra,onExtra,onReset,onClose}){
  const [selected,setSelected]=useState('barrel'),panel=useRef(null)
  useEffect(()=>{const previous=document.activeElement;panel.current?.querySelector('button')?.focus();return()=>previous?.isConnected&&previous.focus({preventScroll:true})},[])
  const handleKeyDown=event=>{
    event.stopPropagation()
    if(event.key==='Escape'){event.preventDefault();onClose();return}
    if(event.key!=='Tab')return
    const controls=[...panel.current.querySelectorAll('button:not(:disabled),input:not(:disabled)')]
    const first=controls[0],last=controls.at(-1)
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
  }
  const value=selected==='barrel'?barrel:selected==='tip'?tip:extra.secondary
  const change=action=>selected==='barrel'?onBarrel(action):selected==='tip'?onTip(action):onExtra({...extra,secondary:action})
  return <section ref={panel} className="stylus-studio" role="dialog" aria-modal="true" aria-labelledby="stylus-studio-title" onKeyDown={handleKeyDown}>
    <header><div><span className="stylus-eyebrow">YOUR WRITING SETUP</span><h2 id="stylus-studio-title">Make your pen yours.</h2><p>Pick a control on the pen, then assign its action.</p></div><button type="button" onClick={onClose} aria-label="Close stylus settings"><X size={21}/></button></header>
    <div className="stylus-studio-grid">
      <div className="stylus-visual"><div className="stylus-orbit"/><svg viewBox="0 0 400 440" aria-hidden="true"><defs><linearGradient id="stylus-body" x1="0" x2="1"><stop stopColor="#273547"/><stop offset=".45" stopColor="#8195aa"/><stop offset=".6" stopColor="#54677d"/><stop offset="1" stopColor="#1b2738"/></linearGradient></defs><g transform="rotate(24 200 220)"><rect x="178" y="57" width="44" height="302" rx="22" fill="url(#stylus-body)" stroke="#c0d7ed" strokeOpacity=".35"/><path d="M178 340 L200 399 L222 340" fill="#a6b6c9"/><path d="M194 384 L200 401 L206 384" fill="#1a2433"/><rect x="179" y="57" width="42" height="25" rx="13" fill={selected==='tip'?'#9dc7fa':'#687d96'}/><rect x="190" y="216" width="20" height="47" rx="8" fill={selected==='barrel'?'#9dc7fa':'#263449'}/><rect x="190" y="178" width="20" height="30" rx="8" fill={selected==='secondary'?'#9dc7fa':'#263449'}/></g></svg>
        <div className="stylus-control-list" role="group" aria-label="Choose pen control">{[['tip','Eraser tip','01'],['secondary','Second button','02'],['barrel','Main side button','03']].map(([id,label,n])=><button key={id} type="button" aria-pressed={selected===id} className={selected===id?'is-selected':''} onClick={()=>setSelected(id)}><span>{n}</span>{label}<i/></button>)}</div>
        <small><Pen size={14}/> Illustration only · button availability depends on your pen</small>
      </div>
      <div className="stylus-assignments"><span className="stylus-eyebrow">{selected==='barrel'?'MAIN SIDE BUTTON':selected==='tip'?'ERASER TIP':'SECOND SIDE BUTTON'}</span><h3>Choose an action</h3><div className="stylus-action-grid">{STYLUS_ACTIONS.map(([id,label,description,Icon])=><button key={id} type="button" aria-pressed={value===id} className={value===id?'is-selected':''} onClick={()=>change(id)}><Icon size={20}/><strong>{label}</strong><small>{description}</small></button>)}</div>
        <div className="stylus-erase-options"><h3>Button eraser feel</h3><div role="group" aria-label="Stylus eraser mode">{[['precision','Precision'],['stroke','Whole stroke'],['objects','Objects']].map(([mode,label])=><button key={mode} type="button" aria-pressed={extra.mode===mode} onClick={()=>onExtra({...extra,mode})}>{label}</button>)}</div><label htmlFor="stylus-erase-size">Eraser size <strong>{extra.size} pt</strong></label><input id="stylus-erase-size" type="range" min="2" max="160" value={extra.size} onChange={event=>onExtra({...extra,size:Number(event.target.value)})}/><div role="group" aria-label="Stylus eraser shape">{['round','square'].map(shape=><button key={shape} type="button" aria-pressed={extra.shape===shape} onClick={()=>onExtra({...extra,shape})}>{shape==='round'?'Round':'Square'}</button>)}</div></div>
      </div>
    </div>
    <footer><p>Saved automatically on this device. Hold actions end when you lift the pen. Second buttons work only when the browser reports them separately.</p><button type="button" onClick={onReset}><RotateCcw size={15}/>Restore defaults</button><button type="button" className="stylus-done" onClick={onClose}>Done</button></footer>
  </section>
}
