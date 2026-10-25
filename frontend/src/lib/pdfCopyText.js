const runs=new WeakMap()
export function registerCopyRun(span,item,viewport,page,styles){
  const transform=viewport.transform
  const x=transform[0]*item.transform[4]+transform[2]*item.transform[5]+transform[4]
  const y=transform[1]*item.transform[4]+transform[3]*item.transform[5]+transform[5]
  const dx=transform[0]*item.transform[0]+transform[2]*item.transform[1],dy=transform[1]*item.transform[0]+transform[3]*item.transform[1]
  span.setAttribute('data-pdf-copy-run','')
  runs.set(span,{page,x,y,angle:Math.atan2(dy,dx),height:Math.max(1,item.height*viewport.scale||Math.hypot(item.transform[2],item.transform[3])*viewport.scale),width:Math.abs(item.width||0)*viewport.scale,mono:/mono|courier/i.test(styles[item.fontName]?.fontFamily||'')})
}

const clean=value=>value.replace(/\u00a0/g,' ').replace(/\u200b/g,'').replace(/[\ufb00-\ufb06]/g,letter=>({'ﬀ':'ff','ﬁ':'fi','ﬂ':'fl','ﬃ':'ffi','ﬄ':'ffl','ﬅ':'st','ﬆ':'st'}[letter]))
const list=value=>/^\s*(?:[•●○▪◦‣⁃*–—-]\s+|\(?\d{1,3}[.)]\s+|[a-zA-Z][.)]\s+)/.test(value)
const code=line=>line.mono&&/[{};=]|^\s{2,}|^\s*(?:def|class|function|return|import|const|let|var|#include)\b/.test(line.text)
const escape=value=>value.replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))

export function copyPdfParagraphs(event,container){
  const selection=window.getSelection()
  if(!selection||selection.isCollapsed||!event.clipboardData)return
  if(!container.contains(selection.anchorNode)||!container.contains(selection.focusNode))return
  const fragments=[]
  for(const span of container.querySelectorAll('[data-pdf-copy-run]')){
    const metadata=runs.get(span)
    if(!metadata)continue
    for(let index=0;index<selection.rangeCount;index++){
      const selected=selection.getRangeAt(index)
      if(!selected.intersectsNode(span))continue
      const part=document.createRange();part.selectNodeContents(span)
      if(selected.compareBoundaryPoints(Range.START_TO_START,part)>0)part.setStart(selected.startContainer,selected.startOffset)
      if(selected.compareBoundaryPoints(Range.END_TO_END,part)<0)part.setEnd(selected.endContainer,selected.endOffset)
      const text=clean(part.toString())
      if(text)fragments.push({...metadata,text})
    }
  }
  if(!fragments.length)return
  const lines=[]
  for(const fragment of fragments){
    const previous=lines[lines.length-1],cos=Math.cos(fragment.angle),sin=Math.sin(fragment.angle)
    const baseline=-fragment.x*sin+fragment.y*cos,start=fragment.x*cos+fragment.y*sin
    const same=previous&&previous.page===fragment.page&&Math.abs(previous.angle-fragment.angle)<.08&&Math.abs(previous.baseline-baseline)<Math.max(previous.height,fragment.height)*.65&&start>=previous.start-Math.max(previous.height,fragment.height)
    if(!same){lines.push({...fragment,baseline,start,end:start+fragment.width,table:false});continue}
    const gap=start-previous.end,em=Math.max(previous.height,fragment.height)
    const separator=/\s$/.test(previous.text)||/^\s|^[,.;:!?)}\]]/.test(fragment.text)?'':gap>em*3?'\t':gap>em*.15?' ':''
    previous.table||=gap>em*3;previous.text+=separator+fragment.text;previous.end=Math.max(previous.end,start+fragment.width);previous.mono||=fragment.mono
  }
  let text=''
  for(let index=0;index<lines.length;index++){
    const current=lines[index],previous=lines[index-1],value=code(current)?current.text.trimEnd():current.text.trim()
    if(!value)continue
    if(!previous){text=value;continue}
    const gap=current.baseline-previous.baseline,em=Math.max(current.height,previous.height)
    const pageBreak=current.page!==previous.page
    const paragraph=(!pageBreak&&(gap>em*1.65||gap< -em*.65))||Math.abs(current.angle-previous.angle)>.08||previous.height>current.height*1.25||current.height>previous.height*1.25||(!pageBreak&&current.start-previous.start>em*.8&&/[.!?:][”'"’)]?$/.test(previous.text.trim()))
    const structural=list(value)||current.table||previous.table||code(current)||code(previous)
    if(structural||paragraph){text+=(paragraph?'\n\n':'\n')+value;continue}
    // Only discretionary soft hyphens are removed. Real hyphens are kept,
    // since geometry alone cannot distinguish them from word punctuation.
    if(/\u00ad$/.test(text))text=text.slice(0,-1)+value
    else text+=(/[-‐‑]$/.test(text)&&/^\p{Ll}/u.test(value)?'':' ')+value
  }
  text=text.replace(/\u00ad/g,'').trim()
  if(!text)return
  event.preventDefault()
  event.clipboardData.setData('text/plain',text)
  event.clipboardData.setData('text/html',text.split('\n\n').map(paragraph=>`<p>${escape(paragraph).replace(/\n/g,'<br>')}</p>`).join(''))
}
