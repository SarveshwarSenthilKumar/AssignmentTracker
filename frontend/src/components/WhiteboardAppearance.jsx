import {useState} from 'react'
import './WhiteboardAppearance.css'
import {DEFAULT_WHITEBOARD_APPEARANCE,WHITEBOARD_PATTERNS} from '../lib/whiteboardAppearance'

export function WhiteboardAppearanceFields({value,onChange,disabled}){
  return <fieldset className="whiteboard-appearance-fields" disabled={disabled}>
    <legend>Board appearance</legend>
    <label>Background color<input type="color" value={value.color} onChange={event=>onChange({...value,color:event.target.value})}/></label>
    <label>Pattern<select value={value.pattern} onChange={event=>onChange({...value,pattern:event.target.value})}>
      {Object.entries(WHITEBOARD_PATTERNS).map(([key,label])=><option key={key} value={key}>{label}</option>)}
    </select></label>
  </fieldset>
}

export default function WhiteboardAppearance({value=DEFAULT_WHITEBOARD_APPEARANCE,onSave}){
  const [draft,setDraft]=useState(value),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('')
  const save=async event=>{
    event.preventDefault()
    if(busy)return
    setBusy(true);setError('');setMessage('')
    try{await onSave(draft);setMessage('Appearance saved.')}
    catch(error){setError(error.message)}
    finally{setBusy(false)}
  }
  const changed=draft.color!==value.color||draft.pattern!==value.pattern
  return <form className="whiteboard-appearance-form" onSubmit={save}>
    <WhiteboardAppearanceFields value={draft} onChange={setDraft} disabled={busy}/>
    <div>
      <button type="submit" disabled={busy||!changed}>{busy?'Saving…':'Apply appearance'}</button>
      <button type="button" disabled={busy} onClick={()=>setDraft(DEFAULT_WHITEBOARD_APPEARANCE)}>Reset appearance</button>
    </div>
    {error&&<p role="alert">{error}</p>}
    {message&&<p role="status">{message}</p>}
  </form>
}
