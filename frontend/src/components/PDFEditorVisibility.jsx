import {useEffect,useRef} from 'react'
import {SlidersHorizontal,X} from 'lucide-react'
import './PDFEditorVisibility.css'

export const editorVisibilityDefaults={header:true,toolbar:true,folders:true,thumbnails:true,footer:true,collaborators:true,cursors:true,assistant:true,phone:true,finger:true,brush:true,clock:true,timers:true};
export function readEditorVisibility(){
  try{const saved=JSON.parse(localStorage.getItem('pdf-editor-visibility')||'{}');return Object.fromEntries(Object.entries(editorVisibilityDefaults).map(([key,value])=>[key,typeof saved?.[key]==='boolean'?saved[key]:value]));}catch{return {...editorVisibilityDefaults};}
}
const options=[['header','Document header'],['toolbar','Tools toolbar'],['folders','Folder navigation'],['thumbnails','Page thumbnails'],['footer','Page navigation and zoom footer'],['collaborators','Online collaborators and sync status'],['cursors','Other editors’ cursors and selections'],['assistant','AI assistant shortcut and panel'],['phone','Study Phone shortcut'],['finger','Finger input controls'],['brush','Color and brush controls'],['clock','Clock (when enabled)'],['timers','Timer and stopwatch (when enabled)']];

export default function PDFEditorVisibility({value,onChange,onReset,open,onOpen,onClose,onSave,onExit,onZen}){
  const root=useRef(null),trigger=useRef(null),close=useRef(null)
  const opener=useRef(null)
  const closePanel=()=>{onClose();const target=trigger.current||opener.current;if(target?.isConnected)target.focus({preventScroll:true})}
  const dismiss=useRef(onClose)
  dismiss.current=onClose
  useEffect(()=>{
    if(!open)return
    opener.current=document.activeElement
    close.current?.focus()
    const outside=event=>{if(!root.current?.contains(event.target))dismiss.current()}
    document.addEventListener('pointerdown',outside)
    return()=>document.removeEventListener('pointerdown',outside)
  },[open])
  return <div className="pdf-visibility-control" ref={root}>
    {!value.toolbar&&<button type="button" ref={trigger} className="pdf-visibility-trigger" onClick={()=>open?onClose():onOpen()} aria-expanded={open} aria-label="Show or hide editor elements" title="Editor layout · restore hidden controls"><SlidersHorizontal size={17}/></button>}
    {open&&<section className="pdf-visibility-panel" role="dialog" aria-label="Show or hide editor elements" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();closePanel()}}}>
      <header><h2>Show or hide elements</h2><button type="button" ref={close} onClick={closePanel} aria-label="Close layout controls"><X size={17}/></button></header>
      <p>Choose what stays visible. Your layout is saved on this device. Page thumbnails also need to be opened from Pages.</p>
      <button type="button" onClick={onZen}>Enter Zen mode</button>
      <p>Just the page and your current tool. Press Escape or tap the top-right corner to exit.</p>
      <div className="pdf-visibility-options">{options.map(([key,label])=><label key={key}><input type="checkbox" checked={value[key]} onChange={event=>onChange(key,event.target.checked)}/><span>{label}</span></label>)}</div>
      <footer><button type="button" onClick={onReset}>Show everything</button><button type="button" onClick={onSave}>Save document</button><button type="button" onClick={onExit}>Close document</button></footer>
    </section>}
  </div>
}
