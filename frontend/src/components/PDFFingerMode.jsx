import { Move, Pen } from 'lucide-react'

export default function PDFFingerMode({scroll,onChange}){
  return <div className="pdf-finger-mode" role="group" aria-label="Finger input mode">
    <button type="button" aria-pressed={scroll} onClick={()=>onChange(true)} title="One finger scrolls; pen still annotates"><Move size={15}/><span>Scroll</span></button>
    <button type="button" aria-pressed={!scroll} onClick={()=>onChange(false)} title="One finger annotates; two fingers scroll"><Pen size={15}/><span>Draw</span></button>
  </div>
}
