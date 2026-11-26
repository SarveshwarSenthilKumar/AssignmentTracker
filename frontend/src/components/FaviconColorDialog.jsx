import {useLayoutEffect,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {X} from 'lucide-react'
import {previewPageFavicon} from '../lib/pageFavicon'
import './FaviconColorDialog.css'

const colors=[
  ['Blue','#245a78'],['Teal','#087f80'],['Green','#3c784e'],
  ['Purple','#6e51a2'],['Rose','#b14163'],['Amber','#bf791b']
]

export default function FaviconColorDialog({page,color,defaultColor,mode,onSave,onClose}){
  const dialog=useRef(null)
  const [draft,setDraft]=useState(color??defaultColor)
  useLayoutEffect(()=>{dialog.current.showModal()},[])
  const finish=value=>{
    onSave(value)
    dialog.current.close()
  }
  const close=()=>dialog.current.close()

  return createPortal(<dialog ref={dialog} data-favicon-color-dialog className="favicon-color-dialog" aria-labelledby="favicon-color-title"
    onClose={onClose} onKeyDown={event=>event.stopPropagation()}>
    <form onSubmit={event=>{event.preventDefault();finish(draft)}}>
      <header>
        <div><h2 id="favicon-color-title">Tab icon color</h2><p>Choose a color for this page in this browser.</p></div>
        <button type="button" className="favicon-dialog-close" aria-label="Close tab icon color" onClick={close}><X size={19}/></button>
      </header>
      <div className="favicon-color-preview">
        <img src={previewPageFavicon(page,draft)} width="32" height="32" alt=""/>
        <span>Tab preview</span>
        <output aria-label="Selected color">{draft.toUpperCase()}</output>
      </div>
      <div className="favicon-color-swatches" role="group" aria-label="Preset colors">
        {colors.map(([name,value])=><button key={value} type="button" aria-label={name} title={name}
          aria-pressed={draft===value} style={{'--swatch':value}} onClick={()=>setDraft(value)}/>)}
        <label className="favicon-custom-color">Custom<input type="color" value={draft} onChange={event=>setDraft(event.target.value)}/></label>
      </div>
      {mode!=='page'&&<p className="favicon-color-note">Saved colors appear when Browser tab icon is set to Match the page in Appearance.</p>}
      <footer>
        {color&&<button type="button" onClick={()=>finish(null)}>Reset color</button>}
        <button type="button" onClick={close}>Cancel</button>
        <button type="submit" className="favicon-save-color">Save color</button>
      </footer>
    </form>
  </dialog>,document.fullscreenElement||document.body)
}
