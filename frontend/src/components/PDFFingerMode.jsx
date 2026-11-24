import {Move,Pen} from 'lucide-react'

export default function PDFFingerMode({scroll,onChange,pageLocked,activity='idle'}){
  const Icon=scroll?Move:Pen
  const hint=activity==='pen'?'Pen active':activity==='drawing'?'Drawing':activity==='scrolling'?'Pan / zoom':scroll?'Two fingers zoom':'Two fingers pan or zoom'
  return <div className="pdf-finger-input">
    <div className="pdf-finger-mode">
      <button type="button" role="switch" aria-label="One-finger drawing" aria-checked={!scroll}
        title={scroll?'Switch to one-finger drawing':'Switch to one-finger scrolling'} onClick={()=>onChange(!scroll)}>
        <Icon size={15} aria-hidden="true"/><span>1 finger: {scroll?'Scroll':'Draw'}</span>
      </button>
    </div>
    <span className={`pdf-input-activity is-${activity}`} role="status" aria-live="polite"><i aria-hidden="true"/>{pageLocked?'Page locked':hint}</span>
  </div>
}
