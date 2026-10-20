import { Move, Pen } from 'lucide-react'

export default function PDFFingerMode({scroll,onChange,activity='idle'}){
  const hint=activity==='pen'?'Pen active':activity==='drawing'?'Drawing':activity==='scrolling'?'Scrolling':scroll?'1 finger scrolls':'1 finger draws · 2 scroll'
  return <div className="pdf-finger-input">
    <div className="pdf-finger-mode" role="group" aria-label="Finger input mode">
    <button type="button" aria-pressed={scroll} onClick={()=>onChange(true)} title="One finger scrolls; pen still annotates"><Move size={15}/><span>Scroll</span></button>
    <button type="button" aria-pressed={!scroll} onClick={()=>onChange(false)} title="One finger annotates; two fingers scroll"><Pen size={15}/><span>Draw</span></button>
    </div>
    <span className={`pdf-input-activity is-${activity}`} role="status" aria-live="polite"><i aria-hidden="true"/>{hint}</span>
  </div>
}
