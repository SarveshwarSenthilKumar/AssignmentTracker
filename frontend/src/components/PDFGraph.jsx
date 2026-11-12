import {downloadBlob} from '../lib/documentFormats'
import {useEffect,useMemo,useRef,useState} from 'react'
import {LineChart,X} from 'lucide-react'
import {compileGraph,drawGraph} from '../lib/pdfGraph'
import './PDFCalculator.css'
import './PDFGraph.css'

export default function PDFGraph({open,onClose,selection,onInsert,canInsert}) {
  const [expression,setExpression]=useState(''),[limits,setLimits]=useState(['-10','10','-10','10']),[error,setError]=useState(''),[notice,setNotice]=useState(''),[valid,setValid]=useState(false)
  const canvas=useRef(null)
  const [xValue,setXValue]=useState('')
  const graph=useMemo(()=>{
    if(!expression.trim())return null
    try{return {compiled:compileGraph(expression)}}
    catch(error){return {error:error.message}}
  },[expression])
  const x=xValue.trim() ? Number(xValue) : NaN
  const y=graph?.compiled && !selection?.pending && Number.isFinite(x) ? graph.compiled.evaluate(x) : null

  useEffect(()=>{
    if(!selection)return
    setExpression(selection.expression||'')
    setError(selection.error||'')
    setNotice(selection.pending?'Reading selected equation with AI…':'')
    setValid(false)
  },[selection])

  useEffect(()=>{
    setValid(false)
    if(!open||!expression||selection?.pending)return
    try{
      if(!graph?.compiled){
        setError(graph?.error||'')
        return
      }
      const visible=drawGraph(canvas.current,graph.compiled,limits.map(v=>v.trim()===''?NaN:Number(v)))
      setError('')
      setNotice(visible?'':'No curve is visible in these limits. Adjust the axes.')
      setValid(true)
    }catch(e){
      setError(e.message)
    }
  },[expression,graph,limits,open,selection])

  const asset=()=>({
    dataUrl:canvas.current.toDataURL('image/png'),
    width:canvas.current.width,
    height:canvas.current.height,
    label:`Graph: ${expression}`
  })

  return <aside hidden={!open} className="pdf-calculator pdf-graph" aria-label="Equation graph" data-keep-text-active>
    <header>
      <span><LineChart size={17}/>Equation graph</span>
      <button type="button" aria-label="Close graph" onClick={onClose}>
        <X size={16}/>
      </button>
    </header>

    <label>
      Function of x
      <input
        value={expression}
        placeholder="y = x^2"
        disabled={selection?.pending}
        onChange={e=>setExpression(e.target.value)}
        maxLength={500}
      />
    </label>

    <div className="pdf-graph-evaluation">
      <label>
        Evaluate at x
        <input type="number" step="any" value={xValue} placeholder="Enter x" disabled={selection?.pending} onChange={e=>setXValue(e.target.value)} />
      </label>
      <output aria-live="polite">
        {y===null ? 'y = —' : Number.isFinite(y) ? `y = ${Number(y.toPrecision(12))}` : 'y is undefined at this x'}
      </output>
    </div>

    <p>Choose More tools → Graph selected region, then hold the left mouse button and drag a box around one equation. Pen selection also works. Trigonometry uses radians.</p>

    <div className="pdf-graph-limits">
      {['X min','X max','Y min','Y max'].map((label,i)=>
        <label key={label}>
          {label}
          <input
            type="number"
            step="any"
            value={limits[i]}
            onChange={e=>setLimits(values=>values.map((v,j)=>i===j?e.target.value:v))}
          />
        </label>
      )}
    </div>

    {error&&<p className="pdf-calculator-error" role="alert">{error}</p>}
    {notice&&<p role="status">{notice}</p>}

    <canvas
      ref={canvas}
      width={720}
      height={520}
      hidden={!valid}
      aria-label={`Plot of ${expression}`}
      role="img"
    />

    <div className="pdf-graph-actions">
      <button
        type="button"
        disabled={!valid||!canInsert}
        onClick={()=>{
          try{
            onInsert(asset())
          }catch(e){
            setError(e.message)
          }
        }}
      >
        Insert on page
      </button>

      <button
        type="button"
        disabled={!valid}
        onClick={async()=>{
          try{
            const blob=await new Promise(resolve=>canvas.current.toBlob(resolve,'image/png'))
            if(!blob)throw new Error('Could not export the graph.')
            await downloadBlob(blob,'equation-graph.png')
          }catch(error){
            setError(error.message||'Could not save the graph.')
          }
        }}
      >
        Download PNG
      </button>
    </div>

    <p>Supports powers, fractions, implicit multiplication (2x), sin, cos, tan, asin, acos, atan, sqrt, abs, ln, log (base 10), exp, floor, ceil, pi and e. Sampled preview; narrow features may need smaller axis limits.</p>
  </aside>
}
