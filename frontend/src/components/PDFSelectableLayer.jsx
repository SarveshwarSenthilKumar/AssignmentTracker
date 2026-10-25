import {useEffect,useRef} from 'react'
import {pdfjs} from 'react-pdf'
import {registerCopyRun} from '../lib/pdfCopyText'

const contents=new WeakMap()
const readContent=page=>{
  if(!contents.has(page))contents.set(page,page.getTextContent({includeMarkedContent:false,disableNormalization:false}).catch(error=>{contents.delete(page);throw error}))
  return contents.get(page)
}

function annotationItems(annotation,viewport,styles){
  const style=annotation.textStyle||{},size=annotation.fontSize||16,fontName=`annotation_${annotation.id}`
  styles[fontName]={fontFamily:style.fontFamily||'Arial, sans-serif',ascent:.8,descent:-.2,vertical:false}
  const context=document.createElement('canvas').getContext('2d')
  context.font=`${style.embedded?'normal':style.italic?'italic':'normal'} ${style.embedded?400:style.fontWeight||400} ${size}px ${styles[fontName].fontFamily}`
  return (annotation.text||'').split('\n').map((str,index)=>{
    const x=annotation.x+4,y=annotation.y+2+size*(style.baselineRatio||.9465)+index*size*1.2
    const transform=pdfjs.Util.transform(pdfjs.Util.inverseTransform(viewport.transform),[size*(style.horizontalScale||1),0,0,-size,x,y])
    return {str,dir:'ltr',transform,fontName,width:(context.measureText(str).width+(style.letterSpacing||0)*Math.max(0,str.length-1))*(style.horizontalScale||1),height:size,hasEOL:true}
  })
}

function completeContent(content,annotations,page){
  const styles={...content.styles},viewport=page.getViewport({scale:1}),replacements=new Map(),added=[]
  for(const annotation of annotations.filter(item=>item.tool==='text')){
    const items=annotationItems(annotation,viewport,styles)
    if(annotation.sourceText?.key)replacements.set(annotation.sourceText.key,items)
    else added.push(...items)
  }
  // Keep every PDF text item: no size, font, direction, rotation or geometry
  // eligibility checks from the text-editing tool belong in selection.
  const items=content.items.flatMap((item,index)=>replacements.has(`${page.pageNumber}:${index}`)?replacements.get(`${page.pageNumber}:${index}`):[item])
  for(const item of added){
    const point=pdfjs.Util.transform(viewport.transform,item.transform)
    const next=items.findIndex(candidate=>candidate.transform&&pdfjs.Util.transform(viewport.transform,candidate.transform)[5]>point[5]+item.height*.5)
    if(next<0)items.push(item);else items.splice(next,0,item)
  }
  return {...content,styles,items}
}

// Fallback keeps text selectable if the native renderer rejects a font or
// malformed geometry. It uses textContent, never PDF-supplied HTML.
function fallbackLayer(container,content,viewport,page){
  const context=document.createElement('canvas').getContext('2d')
  for(const item of content.items){
    if(typeof item.str!=='string'||!item.transform)continue
    const transform=pdfjs.Util.transform(viewport.transform,item.transform),style=content.styles[item.fontName]||{}
    const size=Math.max(.5,Math.hypot(transform[2],transform[3])),angle=Math.atan2(transform[1],transform[0])+(style.vertical?Math.PI/2:0)
    const span=document.createElement('span');span.textContent=item.str;span.setAttribute('role','presentation')
    context.font=`${size}px ${style.fontFamily||'sans-serif'}`
    const measured=context.measureText(item.str).width,width=Math.abs(item.width||0)*viewport.scale
    Object.assign(span.style,{left:`${transform[4]}px`,top:`${transform[5]-size*(style.ascent??.8)}px`,fontSize:`${size}px`,fontFamily:style.fontFamily||'sans-serif',transform:`rotate(${angle}rad) scaleX(${measured&&width?width/measured:1})`})
    container.append(span)
    registerCopyRun(span,item,viewport,page,content.styles)
    if(item.hasEOL)container.append(document.createElement('br'))
  }
}

export default function PDFSelectableLayer({page,scale,rotation,annotations}){
  const root=useRef(null)
  useEffect(()=>{
    if(!page||!root.current)return
    const container=root.current,viewport=page.getViewport({scale,rotation:((page.rotate||0)+rotation)%360})
    let disposed=false,task
    container.replaceChildren()
    ;(async()=>{
      const content=completeContent(await readContent(page),annotations,page)
      if(disposed)return
      try{
        const textDivs=[]
        task=pdfjs.renderTextLayer({container,viewport,textContentSource:content,textDivs})
        await task.promise
        if(disposed)return
        let index=0
        for(const item of content.items){
          if(typeof item.str!=='string')continue
          const span=textDivs[index++]
          if(span)registerCopyRun(span,item,viewport,page.pageNumber,content.styles)
        }
      }catch(error){
        if(disposed)return
        container.replaceChildren();fallbackLayer(container,content,viewport,page.pageNumber)
      }
    })().catch(()=>{if(!disposed)container.setAttribute('aria-label','This page has no readable text layer. Scanned or outlined text needs OCR.')})
    return()=>{disposed=true;task?.cancel();container.replaceChildren()}
  },[page,scale,rotation,annotations])
  return <div ref={root} className="textLayer pdf-complete-text-layer" style={{'--scale-factor':scale}} aria-label="Selectable PDF text"/>
}
