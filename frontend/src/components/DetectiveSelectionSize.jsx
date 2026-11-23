import {useEffect,useState} from 'react'

export default function DetectiveSelectionSize({fontSize,onFontSize,onFontDelta,onScale}){
  const [draft,setDraft]=useState(fontSize??'')
  useEffect(()=>setDraft(fontSize??''),[fontSize])
  const commit=()=>{
    if(draft===''||!Number.isFinite(Number(draft))){setDraft(fontSize??'');return}
    const next=Math.max(8,Math.min(96,Number(draft)));setDraft(next);onFontSize(next)
  }
  return <div className="detective-size-controls" role="group" aria-label="Selected item size">
    <button type="button" title="Shrink selected items, pictures and text by 20%" onClick={()=>onScale(.8)}>Smaller</button>
    <button type="button" title="Enlarge selected items, pictures and text by 25%" onClick={()=>onScale(1.25)}>Larger</button>
    <span className="detective-size-divider"/>
    <button type="button" aria-label="Decrease selected font sizes" onClick={()=>onFontDelta(-2)}>A−</button>
    <label>Text size<input type="number" aria-label="Selected font size" min="8" max="96" step="1" placeholder="Mixed" value={draft} onChange={event=>setDraft(event.target.value)} onBlur={commit} onKeyDown={event=>{event.stopPropagation();if(event.key==='Enter')event.currentTarget.blur()}}/><span>px</span></label>
    <button type="button" aria-label="Increase selected font sizes" onClick={()=>onFontDelta(2)}>A+</button>
  </div>
}
