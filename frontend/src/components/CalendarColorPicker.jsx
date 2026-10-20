import { useEffect, useId, useState } from 'react'
const palette=[['#86a395','Sage'],['#6e9fc6','Blue'],['#a08bc6','Violet'],['#d392a8','Rose'],['#d49a72','Orange'],['#c5b06b','Gold'],['#64b3ab','Teal'],['#b47575','Red']]
export default function CalendarColorPicker({color,onChange,disabled}){
  const [custom,setCustom]=useState(color||'#86a395'),id=useId()
  useEffect(()=>setCustom(color||'#86a395'),[color])
  return <fieldset className="calendar-color-picker" disabled={disabled}><legend>Event color</legend><div className="calendar-color-swatches">{palette.map(([value,name])=><button type="button" key={value} title={name} aria-label={`${name} event color`} aria-pressed={color===value} style={{backgroundColor:value}} onClick={()=>onChange(value)}/>)}<button type="button" className="calendar-color-default" aria-pressed={!color} onClick={()=>onChange(null)}>Default</button></div><div className="calendar-color-custom"><label htmlFor={id}>Custom<input id={id} type="color" value={custom} onChange={event=>setCustom(event.target.value)}/></label><button type="button" disabled={disabled||custom===color} onClick={()=>onChange(custom)}>Apply color</button></div></fieldset>
}
