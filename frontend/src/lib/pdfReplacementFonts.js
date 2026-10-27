// KaTeX ships Unicode fonts derived from Computer Modern. Use the same bytes
// in the browser and exported PDF, including when the PDF contains Type 1 fonts.
const assets=import.meta.glob('/node_modules/katex/dist/fonts/*.ttf',{eager:true,query:'?url',import:'default'})
const cache=new Map(),faces=new Map()
export function matchingFontAsset(name){
  const key=String(name||'').replace(/^[A-Z]{6}\+/,'').toLowerCase()
  let family
  if(/^(cmmi|cmmib|lm(?:math)?italic)/.test(key))family=/cmmib|bold/.test(key)?'Math-BoldItalic':'Math-Italic'
  else if(/^(cmss|lm?sans)/.test(key))family=/bx|bold/.test(key)?'SansSerif-Bold':/i|sl/.test(key)?'SansSerif-Italic':'SansSerif-Regular'
  else if(/^(cmtt|lmmono)/.test(key))family='Typewriter-Regular'
  else if(/^(cmr|cmbx|cmti|cmsl|cmbxti|lmroman|computermodern)/.test(key))family=/bx|bold/.test(key)?(/ti|italic/.test(key)?'Main-BoldItalic':'Main-Bold'):/ti|sl|italic/.test(key)?'Main-Italic':'Main-Regular'
  else if(/^ms[ab]/.test(key))family='AMS-Regular'
  return family?`KaTeX_${family}`:null
}
export async function replacementFontBytes(style){
  if(style.fontData)return Uint8Array.from(atob(style.fontData),character=>character.charCodeAt(0))
  const asset=style.replacementFont||matchingFontAsset(style.fontName)
  if(!asset)return null
  if(!cache.has(asset))cache.set(asset,(async()=>{
    const url=assets[`/node_modules/katex/dist/fonts/${asset}.ttf`]
    if(!url)throw new Error('The matching font asset is unavailable.')
    const response=await fetch(url);if(!response.ok)throw new Error('The matching font could not be loaded.')
    return new Uint8Array(await response.arrayBuffer())
  })().catch(error=>{cache.delete(asset);throw error}))
  return cache.get(asset)
}
export async function replacementFontFace(style){
  const bytes=await replacementFontBytes(style);if(!bytes)return null
  let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0
  const family=`pdfreplacement_${hash.toString(16)}`
  if(!faces.has(family))faces.set(family,(async()=>{
    const face=new FontFace(family,bytes);await face.load();document.fonts.add(face);return family
  })().catch(error=>{faces.delete(family);throw error}))
  return faces.get(family)
}
