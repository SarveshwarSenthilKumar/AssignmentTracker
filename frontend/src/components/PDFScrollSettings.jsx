import {useRef} from 'react'
import {DEFAULT_SCROLL_SETTINGS,scrollPhysics} from '../lib/pdfScrollSettings'
import usePDFTouchInput from '../hooks/usePDFTouchInput'
import './PDFScrollSettings.css'

export default function PDFScrollSettings({value=DEFAULT_SCROLL_SETTINGS,onChange,scrollMode,currentTool,onEnableScroll}){
  const preset=(dragFriction,releaseFriction)=>onChange({dragFriction,releaseFriction,momentum:true,wheelEnabled:true})
  const viewer=useRef(null),overlay=useRef(null)
  const {handlers,activity}=usePDFTouchInput({viewer,overlay,scrollWithFinger:true,scrollSettings:value,canDrawTouch:()=>false,onDrawEnd:()=>{},resetAnnotation:()=>{},tool:'select',resetKey:'scroll-settings-preview'})
  const physics=scrollPhysics(value),distance=Math.round(100*physics.gain)
  const dragLabel=value.dragFriction<=25?'Very light':value.dragFriction>=75?'Very controlled':'Balanced'
  const releaseLabel=!value.momentum?'Stops immediately':value.releaseFriction<=25?'Long, floaty glide':value.releaseFriction>=75?'Quick stop':'Gentle glide'
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  return <div className="pdf-scroll-settings">
    <div className="pdf-scroll-intro"><strong>Make scrolling feel right.</strong><p>Choose how easily the document moves, then how quickly it settles after you stop. Changes apply immediately and save on this device.</p></div>
    <div className="pdf-scroll-presets" role="group" aria-label="Scroll feel presets">{[['Floaty',25,20],['Balanced',50,50],['Firm',75,80]].map(([label,drag,release])=><button type="button" key={label} aria-pressed={value.dragFriction===drag&&value.releaseFriction===release&&value.momentum} onClick={()=>preset(drag,release)}>{label}</button>)}</div>
    <label className="pdf-scroll-slider"><span>1. Movement resistance <strong>{value.dragFriction}/100</strong></span><input type="range" min="0" max="100" step="1" value={value.dragFriction} aria-valuetext={`${dragLabel}; a 100 pixel drag moves about ${distance} pixels`} onChange={event=>onChange({...value,dragFriction:Number(event.target.value)})}/><span className="pdf-scroll-scale"><span>Loose / faster</span><span>Firm / slower</span></span><small>{dragLabel}: a 100 px finger drag moves the document about <b>{distance} px</b>. This also changes wheel distance when customization is enabled.</small></label>
    <label className="pdf-scroll-momentum"><input type="checkbox" checked={value.momentum} onChange={event=>onChange({...value,momentum:event.target.checked})}/><span>Glide after release</span></label>
    <label className="pdf-scroll-slider"><span>2. Friction after stopping <strong>{value.releaseFriction}/100</strong></span><input type="range" min="0" max="100" step="1" disabled={!value.momentum} value={value.releaseFriction} aria-valuetext={releaseLabel} onChange={event=>onChange({...value,releaseFriction:Number(event.target.value)})}/><span className="pdf-scroll-scale"><span>Long glide</span><span>Quick stop</span></span><small>{releaseLabel}. {value.momentum?'A higher value slows the document sooner after your fingers lift or wheel input stops.':'Turn glide on to adjust the slow-down.'}</small></label>
    <label className="pdf-scroll-momentum"><input type="checkbox" checked={value.wheelEnabled!==false} onChange={event=>onChange({...value,wheelEnabled:event.target.checked})}/><span>Customize mouse wheel &amp; trackpad</span></label>
    <p>Wheel input uses distance scaling and a smooth settling tail; it does not add another fling on top of trackpad momentum. Turn this off to use native wheel behavior. Ctrl/Cmd+wheel zoom is unchanged.</p>
    {(currentTool==='read'||!scrollMode)&&onEnableScroll&&<div className="pdf-scroll-callout"><p>{currentTool==='read'?'Select text uses native touch scrolling, so custom finger friction is not active. Wheel customization still works.':'Finger drawing is active. One finger draws; use two fingers to pan, or enable one-finger scrolling.'}</p><button type="button" onClick={onEnableScroll}>Enable adjustable one-finger scrolling</button></div>}
    {reduced&&<p className="pdf-scroll-callout">Your device requests reduced motion, so release glide is disabled. Movement resistance still applies.</p>}
    <section className="pdf-scroll-demo"><strong>Try it here</strong><p>Swipe this panel or use your wheel to compare presets. {activity==='scrolling'?'Moving…':'Ready'}</p><div ref={viewer} {...handlers} tabIndex={0} className="pdf-scroll-demo-viewport" aria-label="Scroll settings practice area" style={{touchAction:'none',overscrollBehavior:'contain'}}>{['Start here','Try a gentle swipe','Lift your finger to feel the glide','Try Firm for a quick stop','Try Floaty for a longer coast','You reached the end'].map((line,index)=><div key={line}><span>{String(index+1).padStart(2,'0')}</span>{line}</div>)}</div></section>
    <p>Touch settings affect custom PDF panning in annotation tools. Select text mode keeps native touch selection and scrolling. External sites keep their own scrolling.</p>
    <button type="button" onClick={()=>onChange({...DEFAULT_SCROLL_SETTINGS})}>Restore balanced defaults</button>
  </div>
}
