import {useEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {ChevronLeft,ChevronRight,X} from 'lucide-react'
import {DETECTIVE_CASES} from '../lib/detectiveCaseTemplates'
import {CASE_BOARD_PRESETS} from '../lib/detectiveCaseOptions'
import './DetectiveCasePicker.css'

const categories=[
  {id:'original',label:'Original mysteries',cases:DETECTIVE_CASES.filter(item=>!item.credits)},
  {id:'famous',label:'Famous mysteries',cases:DETECTIVE_CASES.filter(item=>item.credits)}
]
const caseLabel=item=>item.credits?item.source:item.title

export default function DetectiveCasePicker({busy,error,onChoose,onClose}){
  const [category,setCategory]=useState('famous')
  const [choices,setChoices]=useState(()=>Object.fromEntries(categories.map(group=>[group.id,group.cases[0].id])))
  const [options,setOptions]=useState(CASE_BOARD_PRESETS.standard)
  const {cases}=categories.find(group=>group.id===category)
  const index=cases.findIndex(item=>item.id===choices[category])
  const selected=cases[index]
  const choose=id=>setChoices(previous=>({...previous,[category]:id}))
  const cycle=direction=>choose(cases[(index+direction+cases.length)%cases.length].id)
  const updateOption=(key,value)=>setOptions(previous=>({...previous,[key]:value}))
  const preset=Object.keys(CASE_BOARD_PRESETS).find(key=>
    Object.entries(CASE_BOARD_PRESETS[key]).every(([setting,value])=>options[setting]===value)
  )||'custom'
  const root=useRef(null),caseSelect=useRef(null),latest=useRef(null)
  latest.current={busy,onClose}
  useEffect(()=>{
    const previous=document.activeElement
    caseSelect.current?.focus({preventScroll:true})
    const key=event=>{
      const state=latest.current
      // Keep shortcuts for the board behind the dialog from firing.
      event.stopImmediatePropagation()
      if(event.key==='Escape'){
        event.preventDefault()
        if(!state.busy)state.onClose()
        return
      }
      if(event.key!=='Tab')return
      const controls=[...root.current.querySelectorAll(':is(button,input,select,a[href]):not(:disabled)')]
      const first=controls[0],last=controls.at(-1),focused=document.activeElement
      if(!first){event.preventDefault();return}
      if(!controls.includes(focused)||event.shiftKey&&focused===first||!event.shiftKey&&focused===last){
        event.preventDefault()
        const next=event.shiftKey?last:first
        next.focus()
      }
    }
    window.addEventListener('keydown',key,true)
    return()=>{
      window.removeEventListener('keydown',key,true)
      if(previous?.isConnected)previous.focus({preventScroll:true})
    }
  },[])
  return createPortal(<div className="detective-picker-backdrop" onPointerDown={event=>{
    if(event.target===event.currentTarget&&!busy)onClose()
  }}>
    <section ref={root} className="detective-case-picker" role="dialog" aria-modal="true" aria-labelledby="detective-picker-title"
      aria-describedby="detective-picker-description" aria-busy={busy} style={{'--case-accent':selected.accent}} data-case-picker>
      <header>
        <div><h2 id="detective-picker-title">Choose a sample board</h2>
          <p id="detective-picker-description">Pick a mystery, then choose how much evidence and how many connections to generate.</p>
        </div>
        <button type="button" disabled={busy} aria-label="Close case picker" onClick={onClose}><X size={19}/></button>
      </header>
      <div className="detective-picker-body">
        <div className="detective-picker-categories" role="group" aria-label="Mystery category">
          {categories.map(group=><button key={group.id} type="button" disabled={busy}
            aria-pressed={group.id===category} onClick={()=>setCategory(group.id)}>{group.label}</button>)}
        </div>
        <div className="detective-case-select-row">
          <label>Mystery<select ref={caseSelect} value={selected.id} disabled={busy} onChange={event=>choose(event.target.value)}>
            {cases.map(item=><option key={item.id} value={item.id}>{caseLabel(item)}</option>)}
          </select></label>
          <button type="button" disabled={busy} onClick={()=>cycle(-1)} aria-label="Previous mystery in this category"><ChevronLeft size={20}/></button>
          <button type="button" disabled={busy} onClick={()=>cycle(1)} aria-label="Next mystery in this category"><ChevronRight size={20}/></button>
        </div>
        <article className="detective-case-preview" aria-live="polite" aria-atomic="true">
          <h3>{selected.title}</h3>
          <p>{selected.description}</p>
          <div className="detective-case-tags">{selected.tags.map(tag=><span key={tag}>{tag}</span>)}</div>
          <div className="detective-case-credits">
            {selected.credits?<><strong>{selected.source} ({selected.year})</strong><span>{selected.credits.join(' · ')}</span>
              <a href={selected.creditUrl} target="_blank" rel="noopener noreferrer">Source credits</a></>:<span>Original case created for Assignment Tracker.</span>}
          </div>
        </article>
        {category==='famous'&&<p className="detective-picker-spoilers">Unofficial fan-made boards with fictional evidence. They may contain major plot spoilers. Assignment Tracker is independent of the referenced works and their rights holders.</p>}
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
        </fieldset>
        {error&&<p className="detective-picker-error" role="alert">{error}</p>}
      </div>
      <footer>
        <span aria-live="polite">{options.groups} groups · {options.photos?options.groups*2:0} images</span>
        <button type="button" disabled={busy} onClick={()=>onChoose(selected.id,options)}>{busy?'Generating…':'Generate board'}</button>
      </footer>
    </section>
  </div>,document.fullscreenElement||document.body)
}
