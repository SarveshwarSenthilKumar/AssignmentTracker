import { PDFDocument, PDFDict, PDFName, PDFRawStream, decodePDFRawStream, StandardFonts } from 'pdf-lib'

const documents=new WeakMap(),faces=new Map()
export const fontKey=name=>String(name||'').replace(/^[A-Z]{6}\+/,'').replace(/[^a-z0-9]/gi,'').toLowerCase()
export function pageFontPrograms(doc,index){
  const result=new Map(),seen=new Set()
  const visit=resources=>{
    if(!(resources instanceof PDFDict)||seen.has(resources))return
    seen.add(resources)
    const fonts=resources.lookup(PDFName.of('Font'))
    if(fonts instanceof PDFDict)for(const [,reference] of fonts.entries()){
      let font=doc.context.lookup(reference)
      if(!(font instanceof PDFDict))continue
      const base=font.lookup(PDFName.of('BaseFont'))?.decodeText?.()||''
      const descendants=font.lookup(PDFName.of('DescendantFonts'))
      if(descendants?.size?.())font=doc.context.lookup(descendants.get(0))
      const descriptor=font.lookup(PDFName.of('FontDescriptor'))
      if(!(descriptor instanceof PDFDict))continue
      const stream=descriptor.lookup(PDFName.of('FontFile2'))||descriptor.lookup(PDFName.of('FontFile3'))
      if(!(stream instanceof PDFRawStream))continue
      try{result.set(fontKey(base),decodePDFRawStream(stream).decode())}catch{/* Unsupported font compression must not prevent other text from loading. */}
    }
    const objects=resources.lookup(PDFName.of('XObject'))
    if(objects instanceof PDFDict)for(const [,reference]of objects.entries()){
      const object=doc.context.lookup(reference)
      if(object instanceof PDFRawStream)visit(object.dict.lookup(PDFName.of('Resources')))
    }
  }
  visit(doc.getPage(index).node.Resources())
  return result
}
export function standardTextFont(name,bold=false,italic=false){
  const key=fontKey(name)
  const mono=/courier|mono|consolas/.test(key),serif=!mono&&/times|serif|georgia|cambria|garamond/.test(key)
  if(mono)return bold?(italic?StandardFonts.CourierBoldOblique:StandardFonts.CourierBold):(italic?StandardFonts.CourierOblique:StandardFonts.Courier)
  if(serif)return bold?(italic?StandardFonts.TimesRomanBoldItalic:StandardFonts.TimesRomanBold):(italic?StandardFonts.TimesRomanItalic:StandardFonts.TimesRoman)
  return bold?(italic?StandardFonts.HelveticaBoldOblique:StandardFonts.HelveticaBold):(italic?StandardFonts.HelveticaOblique:StandardFonts.Helvetica)
}
export async function loadPageFontStyles(file,pageIndex){
  if(!file)return new Map()
  if(!documents.has(file))documents.set(file,file.arrayBuffer().then(bytes=>PDFDocument.load(bytes)))
  const programs=pageFontPrograms(await documents.get(file),pageIndex),loaded=new Map()
  for(const [key,bytes]of programs){
    // Include the font bytes in the identity to isolate equally named subsets.
    let hash=2166136261;for(const byte of bytes)hash=Math.imul(hash^byte,16777619)>>>0
    const family=`pdfedit_${hash.toString(16)}`
    if(!faces.has(family))faces.set(family,(async()=>{try{const face=new FontFace(family,bytes);await face.load();document.fonts.add(face);return family}catch{return null}})())
    const face=await faces.get(family);if(face)loaded.set(key,face)
  }
  return loaded
}

export function replacementCss(item,scale=1){
  const style=item.textStyle||{}
  return {fontFamily:style.fontFamily||'Helvetica, Arial, sans-serif',fontWeight:style.embedded?400:style.bold?700:400,fontStyle:style.embedded?'normal':style.italic?'italic':'normal',letterSpacing:(style.letterSpacing||0)*scale,opacity:style.opacity??1,transform:style.horizontalScale?`scaleX(${style.horizontalScale})`:undefined,transformOrigin:'left top'}
}
