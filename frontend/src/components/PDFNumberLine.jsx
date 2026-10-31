import {useEffect,useRef,useState} from 'react'
import {X} from 'lucide-react'
import {downloadBlob} from '../lib/documentFormats'
import './PDFCalculator.css'
import './PDFGraph.css'

export default function PDFNumberLine({open,onClose,onInsert,canInsert}) {
  const [values,setValues]=useState(['-10','10','1'])
  const [error,setError]=useState(''),[valid,setValid]=useState(false)
  const canvas=useRef(null)
  useEffect(()=>{
    setValid(false)
    if(!open)return
    try{
      const [min,max,step]=values.map(value=>value.trim()===''?NaN:Number(value))
      const range=max-min,count=Math.floor(range/step+1e-9)
      if(![min,max,step,range].every(Number.isFinite)||max<=min||step<=0||step>range||Math.abs(min)>1e9||Math.abs(max)>1e9||range<1e-9)
        throw new Error('Enter increasing limits between −1 billion and 1 billion, and positive tick spacing no larger than the range.')
      if(count>100)throw new Error('Use larger tick spacing to show at most 101 ticks.')
      const ctx=canvas.current.getContext('2d'),w=canvas.current.width,h=canvas.current.height
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,w,h)
      ctx.strokeStyle='#172033';ctx.fillStyle='#172033';ctx.lineWidth=2
      const y=80,left=60,right=w-60
      ctx.beginPath();ctx.moveTo(24,y);ctx.lineTo(w-24,y)
      ctx.moveTo(35,y-7);ctx.lineTo(24,y);ctx.lineTo(35,y+7)
      ctx.moveTo(w-35,y-7);ctx.lineTo(w-24,y);ctx.lineTo(w-35,y+7);ctx.stroke()
      ctx.font='16px sans-serif';ctx.textAlign='center'
      const labelEvery=Math.max(1,Math.ceil((count+1)/12))
      for(let i=0;i<=count;i++){
        const value=min+i*step,x=left+(value-min)/range*(right-left)
        ctx.beginPath();ctx.moveTo(x,y-9);ctx.lineTo(x,y+9);ctx.stroke()
        if(i%labelEvery===0||i===count){
          const label=Number(value.toPrecision(10)).toString()
          ctx.fillText(label,x,y+34,Math.max(36,(right-left)/Math.min(count+1,12)-6))
        }
      }
      setError('');setValid(true)
    }catch(e){setError(e.message)}
  },[open,values])
  return <aside hidden={!open} className="pdf-calculator pdf-graph" aria-label="Number line" data-keep-text-active>
    <header><span>Number line</span><button type="button" aria-label="Close number line" onClick={onClose}><X size={16}/></button></header>
    <p>Set the range and spacing between ticks. Labels start at the minimum; crowded labels are reduced automatically.</p>
    <div className="pdf-graph-limits">{['Minimum','Maximum','Tick spacing'].map((label,index)=><label key={label}>{label}<input type="number" step="any" value={values[index]} onChange={event=>setValues(previous=>previous.map((value,i)=>i===index?event.target.value:value))}/></label>)}</div>
    {error&&<p className="pdf-calculator-error" role="alert">{error}</p>}
    <canvas ref={canvas} width={960} height={160} hidden={!valid} role="img" aria-label={`Number line from ${values[0]} to ${values[1]}, tick spacing ${values[2]}`}/>
    <div className="pdf-graph-actions">
      <button type="button" disabled={!valid||!canInsert} onClick={()=>{try{onInsert({dataUrl:canvas.current.toDataURL('image/png'),width:960,height:160,label:`Number line: ${values[0]} to ${values[1]}`})}catch(e){setError(e.message)}}}>Insert on page</button>
      <button type="button" disabled={!valid} onClick={async()=>{try{const blob=await new Promise(resolve=>canvas.current.toBlob(resolve,'image/png'));if(!blob)throw new Error('Could not export the number line.');await downloadBlob(blob,'number-line.png')}catch(e){setError(e.message)}}}>Download PNG</button>
    </div>
  </aside>
}
