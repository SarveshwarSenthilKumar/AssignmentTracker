import {useLayoutEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import './DocumentFolderNavigation.css'

export default function FaviconColorDialog({color,defaultColor,mode,onSave,onClose}){
  const dialog=useRef(null),input=useRef(null)
  const [draft,setDraft]=useState(color??defaultColor)
  useLayoutEffect(()=>{
    dialog.current.showModal()
    input.current?.focus()
  },[])
  const finish=color=>{
    onSave(color)
    dialog.current.close()
  }

  return createPortal(<dialog ref={dialog} data-favicon-color-dialog className="document-file-dialog" aria-labelledby="favicon-color-title"
    onClose={onClose} onKeyDown={event=>event.stopPropagation()}>
    <form onSubmit={event=>{event.preventDefault();finish(draft)}}>
      <h2 id="favicon-color-title">Page tab color</h2>
      <p>Set a color for this page in this browser.</p>
      {mode!=='page'&&<p>Colors are visible when Browser tab icon is set to Match the page in Appearance.</p>}
      <label>Tab icon color<input ref={input} type="color" value={draft} onChange={event=>setDraft(event.target.value)}/></label>
      <footer>
        {color&&<button type="button" onClick={()=>finish(null)}>Reset color</button>}
        <button type="button" onClick={()=>dialog.current.close()}>Cancel</button>
        <button type="submit">Save color</button>
      </footer>
    </form>
  </dialog>,document.fullscreenElement||document.body)
}
