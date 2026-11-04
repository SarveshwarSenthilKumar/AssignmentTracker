export const DEFAULT_SCROLL_SETTINGS={dragFriction:50,releaseFriction:50,momentum:true,wheelEnabled:true}
export const SCROLL_SETTINGS_KEY='pdf-scroll-feel-v1'
const level=value=>typeof value==='number'&&Number.isFinite(value)?Math.round(Math.max(0,Math.min(100,value))):50
export const normalizeScrollSettings=value=>({dragFriction:level(value?.dragFriction),releaseFriction:level(value?.releaseFriction),momentum:value?.momentum!==false,wheelEnabled:value?.wheelEnabled!==false})
export function readScrollSettings(){try{return normalizeScrollSettings(JSON.parse(localStorage.getItem(SCROLL_SETTINGS_KEY)||'null'))}catch{return {...DEFAULT_SCROLL_SETTINGS}}}
export function scrollPhysics(value){
  const settings=normalizeScrollSettings(value)
  return {gain:Math.pow(4,(50-settings.dragFriction)/50),decayTime:325*Math.exp((50-settings.releaseFriction)*.035),momentum:settings.momentum,wheelEnabled:settings.wheelEnabled}
}
