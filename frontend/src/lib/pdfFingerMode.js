export const PDF_FINGER_MODE_CHANGED='pdf-finger-mode-changed'
const key='pdf-finger-mode'
let mode='scroll'

export function readPDFFingerMode(){
  try{return localStorage.getItem(key)==='draw'?'draw':'scroll'}
  catch{return mode}
}

export function savePDFFingerMode(value){
  mode=value
  try{localStorage.setItem(key,value)}catch{/* Keep the choice for this session. */}
  window.dispatchEvent(new CustomEvent(PDF_FINGER_MODE_CHANGED,{detail:value}))
}
