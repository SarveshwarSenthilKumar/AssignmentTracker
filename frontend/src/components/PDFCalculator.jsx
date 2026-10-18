import { useEffect, useRef, useState } from 'react'
import { Calculator, Copy, X } from 'lucide-react'
import { calculate } from '../lib/calculator'
import './PDFCalculator.css'

export default function PDFCalculator({open,onClose,selection}){
  const [expression,setExpression]=useState(''),[answer,setAnswer]=useState(0),[history,setHistory]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState('')
  const input=useRef(null)
  useEffect(()=>{
    if(!selection)return
    setExpression(selection.expression||'');setNotice('')
    if(selection.pending){setAnswer(null);setError('');setNotice('Reading selected math with AI…');return}
    if(selection.error){setAnswer(null);setError(selection.error);return}
    try{const result=calculate(selection.expression);setAnswer(result);setError('');setNotice(selection.source==='ai'?`AI recognition · ${selection.transcription||selection.expression}. Review the transcription; handwriting recognition can make mistakes.`:'Calculated selected text. Check the recognized expression above.');setHistory(previous=>[{expression:selection.expression,result},...previous].slice(0,8))}catch(error){setAnswer(null);setError(`Could not calculate the selection: ${error.message} Review or edit the recognized expression.`)}
  },[selection])
  useEffect(()=>{if(!open)return;const previous=document.activeElement;input.current?.focus({preventScroll:true});return()=>previous?.isConnected&&previous.focus({preventScroll:true})},[open])
  const insert=value=>{
    const field=input.current,start=field?.selectionStart??expression.length,end=field?.selectionEnd??start
    const next=expression.slice(0,start)+value+expression.slice(end)
    if(next.length>500)return
    setExpression(next);setError('');setNotice('')
    requestAnimationFrame(()=>{field?.focus({preventScroll:true});field?.setSelectionRange(start+value.length,start+value.length)})
  }
  const evaluate=()=>{try{const value=calculate(expression,answer??0);setAnswer(value);setHistory(previous=>[{expression,result:value},...previous].slice(0,8));setError('');setNotice('')}catch(error){setAnswer(null);setError(error.message)}}
  const backspace=()=>{const field=input.current,start=field?.selectionStart??expression.length,end=field?.selectionEnd??start;setExpression(expression.slice(0,Math.max(0,start===end?start-1:start))+expression.slice(end));setError('');requestAnimationFrame(()=>{field?.focus();const position=Math.max(0,start===end?start-1:start);field?.setSelectionRange(position,position)})}
  return <aside hidden={!open} className="pdf-calculator" aria-label="PDF calculator" onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();onClose()}}}>
    <header><span><Calculator size={16}/>Calculator</span><button type="button" onClick={onClose} aria-label="Close calculator"><X size={16}/></button></header>
    <form onSubmit={event=>{event.preventDefault();evaluate()}}><label htmlFor="pdf-calculator-expression">Expression</label><input ref={input} id="pdf-calculator-expression" value={expression} maxLength={500} autoComplete="off" spellCheck={false} placeholder="(125 + 75) ÷ 4" onChange={event=>{setExpression(event.target.value);setError('');setNotice('')}}/><div className="pdf-calculator-result"><output aria-live="polite">{answer===null?'—':String(answer)}</output><button type="button" disabled={answer===null} title="Copy result" aria-label="Copy calculator result" onClick={async()=>{try{await navigator.clipboard.writeText(String(answer));setNotice('Result copied.')}catch{setError('Could not copy. Select the result and copy it manually.')}}}><Copy size={14}/></button></div>
    <div className="pdf-calculator-keys">{['(',')','%','⌫','sqrt(','^','pi','÷','7','8','9','×','4','5','6','−','1','2','3','+','AC','0','.','='].map(key=><button key={key} type="button" className={key==='='?'is-equals':['÷','×','−','+'].includes(key)?'is-operator':''} aria-label={key==='⌫'?'Backspace':key==='AC'?'Clear expression':key==='sqrt('?'Square root':key==='pi'?'Pi':key} onClick={()=>key==='='?evaluate():key==='AC'?(setExpression(''),setError(''),input.current?.focus()):key==='⌫'?backspace():insert(key)}>{key==='sqrt('?'√':key==='pi'?'π':key}</button>)}</div>
    <button className="pdf-calculator-ans" disabled={answer===null} type="button" onClick={()=>insert('ans')}>Use previous answer</button></form>
    {error&&<p role="alert" className="pdf-calculator-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <p className="pdf-calculator-help">Enter to calculate · Esc to close. Percent divides by 100. Calculations stay separate from the PDF.</p>
    {history.length>0&&<section className="pdf-calculator-history"><h4>Recent calculations</h4>{history.map((item,index)=><button type="button" key={index} title="Reuse this result" onClick={()=>insert(String(item.result))}><span>{item.expression}</span><strong>= {String(item.result)}</strong></button>)}</section>}
  </aside>
}
