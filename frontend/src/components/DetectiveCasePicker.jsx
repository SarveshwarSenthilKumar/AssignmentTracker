import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {ChevronLeft,ChevronRight,Pin,X} from 'lucide-react'
import {DETECTIVE_CASES} from '../lib/detectiveCaseTemplates'
import {CASE_BOARD_PRESETS} from '../lib/detectiveCaseOptions'
import './DetectiveCasePicker.css'

export default function DetectiveCasePicker({busy,error,onChoose,onClose}){
  const [index,setIndex]=useState(0)
  const [options,setOptions]=useState(CASE_BOARD_PRESETS.standard)
  const updateOption=(key,value)=>setOptions(previous=>({...previous,[key]:value}))
  const preset=Object.keys(CASE_BOARD_PRESETS).find(key=>
    Object.entries(CASE_BOARD_PRESETS[key]).every(([setting,value])=>options[setting]===value)
  )||'custom'
  const root=useRef(null),latest=useRef(null)
  latest.current={busy,onChoose,onClose,index,options}
  const cycle=direction=>setIndex(value=>(value+direction+DETECTIVE_CASES.length)%DETECTIVE_CASES.length)
  useEffect(()=>{
    const previous=document.activeElement
    root.current?.querySelector('[data-picker-generate]')?.focus()
    const key=event=>{
      const state=latest.current
      // Keep board shortcuts and arrow-key nudging out of the modal.
      event.stopImmediatePropagation()
      const formControl=event.target.closest?.('input,select')
      if(formControl&&event.key!=='Escape'&&event.key!=='Tab')return
      if(event.key==='Enter'&&event.target.closest?.('button,a[href]')&&!event.target.closest('[data-picker-generate]'))return
      if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Enter','Escape'].includes(event.key)){
        event.preventDefault();if(state.busy||event.repeat)return
        if(event.key==='Escape')state.onClose()
        else if(event.key==='Enter')state.onChoose(DETECTIVE_CASES[state.index].id,state.options)
        else cycle(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)
      }else if(event.key==='Tab'){
        const controls=[...root.current.querySelectorAll(':is(button,input,select,a[href]):not(:disabled)')]
        const first=controls[0],last=controls.at(-1)
        if(!first){event.preventDefault();return}
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    }
    window.addEventListener('keydown',key,true)
    return()=>{window.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus({preventScroll:true})}
  },[])
  const selected=DETECTIVE_CASES[index]
  return createPortal(<div className="detective-picker-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget&&!busy)onClose()}}>
    <section ref={root} className="detective-case-picker" role="dialog" aria-modal="true" aria-labelledby="detective-picker-title" aria-describedby="detective-picker-description" aria-busy={busy} style={{'--case-accent':selected.accent}} data-case-picker>
      <header><div><span className="detective-picker-eyebrow">CLASSIFIED / CASE ARCHIVE</span><h2 id="detective-picker-title">Choose your investigation</h2></div><button type="button" disabled={busy} aria-label="Close case picker" onClick={onClose}><X size={19}/></button></header>
      <p id="detective-picker-description">Browse cases with ← / →. Choose a complexity preset or customize the board before generating it.</p>
      <div className="detective-case-carousel">
        <button type="button" disabled={busy} onClick={()=>cycle(-1)} aria-label="Previous fictional case"><ChevronLeft size={24}/></button>
        <article className="detective-case-preview" aria-live="polite" aria-atomic="true">
          <div className="detective-case-stamp"><Pin size={23}/><span>FILE {selected.code}</span></div>
          <p>{selected.source}</p><h3>{selected.title}</h3><p>{selected.description}</p>
          <div className="detective-case-tags">{selected.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
          <small>{index+1} / {DETECTIVE_CASES.length}</small>
        </article>
        <button type="button" disabled={busy} onClick={()=>cycle(1)} aria-label="Next fictional case"><ChevronRight size={24}/></button>
      </div>
      <div className="detective-case-credits" aria-live="polite">
        {selected.credits?<><strong>{selected.source} ({selected.year})</strong><span>{selected.credits.join(' · ')}</span>
          <a href={selected.creditUrl} target="_blank" rel="noopener noreferrer">Source credits</a></>:<span>Original case created for Assignment Tracker.</span>}
      </div>
      <div className="detective-picker-tabs" aria-label="Available cases">{DETECTIVE_CASES.map((item,i)=><button key={item.id} type="button" disabled={busy} aria-pressed={i===index} onClick={()=>setIndex(i)}>{item.credits?item.source:item.title}</button>)}</div>
      <fieldset className="detective-case-settings" disabled={busy}>
        <legend>Board settings</legend>
        <div className="detective-case-setting-grid">
          <label>Complexity<select value={preset} onChange={event=>setOptions(CASE_BOARD_PRESETS[event.target.value])}>
            <option value="simple">Simple</option><option value="standard">Standard</option><option value="complex">Complex</option>
            <option value="custom" disabled>Custom</option>
          </select></label>
          <label>Evidence groups<select value={options.groups} onChange={event=>updateOption('groups',Number(event.target.value))}>
            {[4,5,6,7,8].map(value=><option key={value} value={value}>{value} groups</option>)}
          </select></label>
          <label>String density<select value={options.density} onChange={event=>updateOption('density',event.target.value)}>
            <option value="sparse">Sparse</option><option value="standard">Standard</option><option value="dense">Dense</option>
          </select></label>
        </div>
        <div className="detective-case-setting-toggles">
          {[['photos','Evidence images'],['timeline','Timeline'],['scraps','Extra notes']].map(([key,label])=><label key={key}>
            <input type="checkbox" checked={options[key]} onChange={event=>updateOption(key,event.target.checked)}/>{label}
          </label>)}
        </div>
        <p aria-live="polite">{options.groups} evidence groups · {options.photos?options.groups*2:0} evidence images</p>
      </fieldset>
      <p className="detective-picker-spoilers">These demonstration cases and their evidence are fictional. Some are unofficial fan-made interpretations and may contain major plot spoilers. Assignment Tracker is independent of the referenced works and their rights holders.</p>
      {error&&<p className="detective-picker-error" role="alert">{error}</p>}
      <footer><span>A separate wall with a fresh, messy layout.</span><button type="button" data-picker-generate disabled={busy} onClick={()=>onChoose(selected.id,options)}>{busy?'Assembling evidence…':'Generate case board'}</button></footer>
    </section>
  </div>,document.fullscreenElement||document.body)
}
