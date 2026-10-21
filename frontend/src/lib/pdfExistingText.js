// PDF.js text transforms -> the same scale-1 viewport used by annotations.
import {fontKey,loadPageFontStyles} from './pdfTextStyle'

export async function existingTextRuns(page, pdfjs, file) {
  const [content,operators,embedded]=await Promise.all([page.getTextContent(),page.getOperatorList(),loadPageFontStyles(file,page.pageNumber-1).catch(()=>new Map())])
  const viewport = page.getViewport({ scale: 1 }),paints=[],stack=[]
  let state={font:'',color:'#000000',charSpacing:0,opacity:1,fontSize:12},paintIndex=0
  const hex=values=>'#'+Array.from(values).slice(0,3).map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0')).join('')
  for(let index=0;index<operators.fnArray.length;index++){
    const op=operators.fnArray[index],args=operators.argsArray[index]||[],OPS=pdfjs.OPS
    if(op===OPS.save)stack.push({...state})
    else if(op===OPS.restore)state=stack.pop()||state
    else if(op===OPS.setFont)state={...state,font:args[0],fontSize:Math.abs(args[1])}
    else if(op===OPS.setFillRGBColor)state={...state,color:hex(args)}
    else if(op===OPS.setFillGray)state={...state,color:hex([args[0]*255,args[0]*255,args[0]*255])}
    else if(op===OPS.setCharSpacing)state={...state,charSpacing:args[0]}
    else if(op===OPS.setGState){for(const [key,value]of args[0]||[])if(key==='ca')state={...state,opacity:value}}
    else if(op===OPS.showText||op===OPS.showSpacedText){const text=(args[0]||[]).map(glyph=>typeof glyph==='object'?glyph?.unicode||'':'').join('');if(text.trim())paints.push({...state,text})}
  }
  return content.items.flatMap((item, index) => {
    if (!item.str?.trim() || !item.transform) return []
    const transform = pdfjs.Util.transform(viewport.transform, item.transform)
    const height = Math.hypot(transform[2], transform[3])
    // The current editor's text boxes are horizontal. Don't create misplaced
    // replacements over vertical, skewed or independently rotated text.
    const angle = Math.atan2(transform[1], transform[0])
    if (Math.abs(angle) > .02 || height < 1) return []
    const style = content.styles[item.fontName] || {}
    const ascent = Number.isFinite(style.ascent) ? style.ascent : Number.isFinite(style.descent) ? 1 + style.descent : .8
    const width = Math.max(1, item.width * viewport.scale)
    let paint=paints[paintIndex]
    const compact=value=>value.replace(/\s/g,'')
    const match=paints.findIndex((entry,i)=>i>=paintIndex&&entry.font===item.fontName&&(compact(entry.text).includes(compact(item.str))||compact(item.str).includes(compact(entry.text))))
    if(match>=0){paint=paints[match];paintIndex=match+1}
    if(paint?.font!==item.fontName)paint=null
    let nativeFont
    try{nativeFont=page.commonObjs.get(item.fontName)}catch{}
    const fontName=nativeFont?.name||style.fontFamily||'Helvetica',face=embedded.get(fontKey(fontName))
    const bold=!!nativeFont?.bold||/bold|black|heavy|semibold|demi/i.test(fontName),italic=!!nativeFont?.italic||/italic|oblique/i.test(fontName)
    const cleanName=fontName.replace(/^[A-Z]{6}\+/,'').replace(/[-,](BoldItalic|BoldOblique|Bold|Italic|Oblique|Regular|Roman|PSMT|MT)$/i,'')
    const generic=/courier|mono|consolas/i.test(fontName)?'monospace':/times|serif|georgia|cambria|garamond/i.test(fontName)?'serif':'sans-serif'
    const textStyle={fontName,fontFamily:face?`"${face}"`:`"${cleanName.replace(/["\\]/g,'')}", ${generic}`,embedded:!!face,approximate:!face&&!/^(Helvetica|Times-Roman|Times-Bold|Times-Italic|Times-BoldItalic|Courier)(-|$)/i.test(fontName),bold,italic,letterSpacing:(paint?.charSpacing||0)*height/(paint?.fontSize||height),opacity:paint?.opacity??1}
    const canvas=document.createElement('canvas'),context=canvas.getContext('2d')
    context.font=`${face?'normal':italic?'italic':'normal'} ${face?'400':bold?'700':'400'} ${height}px ${textStyle.fontFamily}`
    const measured=context.measureText(item.str),natural=measured.width+textStyle.letterSpacing*Math.max(0,item.str.length-1)
    textStyle.horizontalScale=natural>0?width/natural:1
    const metrics=context.measureText('Mg')
    textStyle.baselineRatio=Number.isFinite(metrics.fontBoundingBoxAscent)?(.6+(metrics.fontBoundingBoxAscent-metrics.fontBoundingBoxDescent)/(2*height)):.9465
    return [{ key: `${page.pageNumber}:${index}`, text: item.str, x: transform[4], y: transform[5] - height * ascent, width, height, fontSize: height, baseline: transform[5],textStyle,color:paint?.color||'#000000' }]
  })
}
