import {DEFAULT_SCROLL_SETTINGS} from '../lib/pdfScrollSettings'
import './PDFScrollSettings.css'

export default function PDFScrollSettings({value=DEFAULT_SCROLL_SETTINGS,onChange}){
  const preset=(dragFriction,releaseFriction)=>onChange({dragFriction,releaseFriction,momentum:true})
  return <div className="pdf-scroll-settings">
    <p>Adjust touch panning and how far the page glides after you lift your fingers. Saved on this device.</p>
    <div className="pdf-scroll-presets" role="group" aria-label="Scroll feel presets">{[['Floaty',25,20],['Balanced',50,50],['Firm',75,80]].map(([label,drag,release])=><button type="button" key={label} aria-pressed={value.dragFriction===drag&&value.releaseFriction===release&&value.momentum} onClick={()=>preset(drag,release)}>{label}</button>)}</div>
    <label className="pdf-scroll-slider">Drag resistance <strong>{value.dragFriction}%</strong><input type="range" min="0" max="100" step="1" value={value.dragFriction} onChange={event=>onChange({...value,dragFriction:Number(event.target.value)})}/><small>Low: less finger movement · High: more controlled movement</small></label>
    <label className="pdf-scroll-momentum"><input type="checkbox" checked={value.momentum} onChange={event=>onChange({...value,momentum:event.target.checked})}/><span>Glide after release</span></label>
    <label className="pdf-scroll-slider">Release friction <strong>{value.releaseFriction}%</strong><input type="range" min="0" max="100" step="1" disabled={!value.momentum} value={value.releaseFriction} onChange={event=>onChange({...value,releaseFriction:Number(event.target.value)})}/><small>Low: longer glide · High: stops sooner</small></label>
    <p>Works with touch scrolling in annotation tools. Select text mode, wheel/trackpad scrolling and external websites use their native scrolling. Reduced-motion settings disable the release glide.</p>
    <button type="button" onClick={()=>onChange({...DEFAULT_SCROLL_SETTINGS})}>Restore balanced defaults</button>
  </div>
}
