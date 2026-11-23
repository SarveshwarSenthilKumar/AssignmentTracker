import {useEffect,useRef,useState} from 'react'
import {ChevronLeft,ChevronRight,Pin,X} from 'lucide-react'
import {DETECTIVE_CASES} from '../lib/detectiveCaseTemplates'
import './DetectiveCasePicker.css'

export default function DetectiveCasePicker({busy,error,onChoose,onClose}){
  const [index,setIndex]=useState(0)
  const root=useRef(null),latest=useRef(null)
  latest.current={busy,onChoose,onClose,index}
  const cycle=direction=>setIndex(value=>(value+direction+DETECTIVE_CASES.length)%DETECTIVE_CASES.length)
  useEffect(()=>{
    const previous=document.activeElement
    root.current?.querySelector('[data-picker-generate]')?.focus()
    const key=event=>{
      const state=latest.current
      // Keep board shortcuts and arrow-key nudging out of the modal.
      event.stopImmediatePropagation()
      if(event.key==='Enter'&&event.target.closest?.('button')&&!event.target.closest('[data-picker-generate]'))return
      if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown','Enter','Escape'].includes(event.key)){
        event.preventDefault();if(state.busy||event.repeat)return
        if(event.key==='Escape')state.onClose()
        else if(event.key==='Enter')state.onChoose(DETECTIVE_CASES[state.index].id)
        else cycle(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)
      }else if(event.key==='Tab'){
        const buttons=[...root.current.querySelectorAll('button:not(:disabled)')]
        const first=buttons[0],last=buttons[buttons.length-1]
        if(!first){event.preventDefault();return}
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    }
    window.addEventListener('keydown',key,true)
    return()=>{window.removeEventListener('keydown',key,true);if(previous?.isConnected)previous.focus({preventScroll:true})}
  },[])
  const selected=DETECTIVE_CASES[index]
  return <div className="detective-picker-backdrop" onPointerDown={event=>{if(event.target===event.currentTarget&&!busy)onClose()}}>
    <section ref={root} className="detective-case-picker" role="dialog" aria-modal="true" aria-labelledby="detective-picker-title" aria-describedby="detective-picker-description" aria-busy={busy} style={{'--case-accent':selected.accent}} data-case-picker>
      <header><div><span className="detective-picker-eyebrow">CLASSIFIED / CASE ARCHIVE</span><h2 id="detective-picker-title">Choose your investigation</h2></div><button type="button" disabled={busy} aria-label="Close case picker" onClick={onClose}><X size={19}/></button></header>
      <p id="detective-picker-description">Use ← / → to browse. Enter builds a new editable wall. Esc closes.</p>
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
      <div className="detective-picker-tabs" aria-label="Available cases">{DETECTIVE_CASES.map((item,i)=><button key={item.id} type="button" disabled={busy} aria-pressed={i===index} onClick={()=>setIndex(i)}>{item.source}</button>)}</div>
      <p className="detective-picker-spoilers">Includes major plot spoilers. Fan-made evidence illustrations and notes, rather than official film stills or case documents.</p>
      {error&&<p className="detective-picker-error" role="alert">{error}</p>}
      <footer><span>A separate wall with a fresh, messy layout.</span><button type="button" data-picker-generate disabled={busy} onClick={()=>onChoose(selected.id)}>{busy?'Assembling evidence…':'Generate case board'}</button></footer>
    </section>
  </div>
}
