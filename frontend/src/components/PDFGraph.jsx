import {useEffect,useRef,useState} from 'react'
import {LineChart,X} from 'lucide-react'
import {compileGraph,drawGraph} from '../lib/pdfGraph'
import './PDFCalculator.css'
import './PDFGraph.css'

export default function PDFGraph({open,onClose,selection,onInsert,canInsert}) {
  const [expression,setExpression]=useState(''),[limits,setLimits]=useState(['-10','10','-10','10']),[error,setError]=useState(''),[notice,setNotice]=useState(''),[valid,setValid]=useState(false)
  const canvas=useRef(null)
  useEffect(()=>{if(!selection)return;setExpression(selection.expression||'');setError(selection.error||'');setNotice(selection.pending?'Reading selected equation with AI…':'');setValid(false)},[selection])
  useEffect(()=>{
    setValid(false)
    if(!open||!expression||selection?.pending)return
    try{const compiled=compileGraph(expression),visible=drawGraph(canvas.current,compiled,limits.map(v=>v.trim()===''?NaN:Number(v)));setError('');setNotice(visible?'':'No curve is visible in these limits. Adjust the axes.');setValid(true)}catch(e){setError(e.message)}
  },[expression,limits,open,selection])
  const asset=()=>({dataUrl:canvas.current.toDataURL('image/png'),width:canvas.current.width,height:canvas.current.height,label:`Graph: ${expression}`})
  return <aside hidden={!open} className="pdf-calculator pdf-graph" aria-label="Equation graph" data-keep-text-active>
    <header><span><LineChart size={17}/>Equation graph</span><button type="button" aria-label="Close graph" onClick={onClose}><X size={16}/></button></header>
    <label>Function of x<input value={expression} placeholder="y = x^2" disabled={selection?.pending} onChange={e=>setExpression(e.target.value)} maxLength={500}/></label>
    <p>Choose More tools → Graph selected region, then hold the left mouse button and drag a box around one equation. Pen selection also works. Trigonometry uses radians.</p>
    <div className="pdf-graph-limits">{['X min','X max','Y min','Y max'].map((label,i)=><label key={label}>{label}<input type="number" step="any" value={limits[i]} onChange={e=>setLimits(values=>values.map((v,j)=>i===j?e.target.value:v))}/></label>)}</div>
    {error&&<p className="pdf-calculator-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <canvas ref={canvas} width={720} height={520} hidden={!valid} aria-label={`Plot of ${expression}`} role="img"/>
    <div className="pdf-graph-actions"><button type="button" disabled={!valid||!canInsert} onClick={()=>{try{onInsert(asset())}catch(e){setError(e.message)}}}>Insert on page</button><button type="button" disabled={!valid} onClick={()=>{const a=document.createElement('a');a.href=asset().dataUrl;a.download='equation-graph.png';a.click()}}>Download PNG</button></div>
    <p>Supports powers, fractions, implicit multiplication (2x), sin, cos, tan, asin, acos, atan, sqrt, abs, ln, log (base 10), exp, floor, ceil, pi and e. Sampled preview; narrow features may need smaller axis limits.</p>
  </aside>
}
