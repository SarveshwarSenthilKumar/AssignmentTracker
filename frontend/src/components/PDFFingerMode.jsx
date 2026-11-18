import { Lock, Move, Pen } from 'lucide-react'

export default function PDFFingerMode({scroll,onChange,pageLocked,onPageLock,activity='idle'}){
  const hint=activity==='pen'?'Pen active':activity==='drawing'?'Drawing':activity==='scrolling'?'Pan / zoom':scroll?'1 finger pans · 2 zoom':'1 finger draws · 2 pan / zoom'
  return <div className="pdf-finger-input">
    <div className="pdf-finger-mode" role="group" aria-label="Finger input mode">
    <button type="button" aria-pressed={scroll} onClick={()=>onChange(true)} title="One finger scrolls; pen still annotates"><Move size={15}/><span>Scroll</span></button>
    <button type="button" aria-pressed={!scroll} onClick={()=>onChange(false)} title="One finger annotates; two fingers scroll"><Pen size={15}/><span>Draw</span></button>
    <button type="button" aria-pressed={pageLocked} onClick={()=>onPageLock(!pageLocked)} title="Freeze scrolling and draw with one finger"><Lock size={15}/><span>{pageLocked?'Unlock page':'Lock page'}</span></button>
    </div>
    <span className={`pdf-input-activity is-${activity}`} role="status" aria-live="polite"><i aria-hidden="true"/>{pageLocked?'Page locked · 1 finger draws':hint}</span>
  </div>
}
