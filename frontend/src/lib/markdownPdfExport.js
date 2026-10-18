// Capture math with the browser's layout engine before html2canvas sees it.
// KaTeX uses positioned glyphs and rules that canvas text emulation can misalign.
async function embeddedMathFonts() {
  const faces=[]
  for(const sheet of document.styleSheets){
    let rules
    try{rules=sheet.cssRules}catch{continue}
    for(const rule of rules){
      if(rule.type!==CSSRule.FONT_FACE_RULE||!rule.style.fontFamily.includes('KaTeX'))continue
      let css=rule.cssText
      const urls=[...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
      // One supported format per face keeps the SVG small.
      const match=urls.find(value=>value[1].includes('.woff2'))||urls[0]
      if(!match)continue
      const response=await fetch(new URL(match[1],sheet.href||document.baseURI))
      if(!response.ok)throw new Error('A math font could not be loaded. Reload and try again.')
      const blob=await response.blob()
      const data=await new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not prepare a math font.'));reader.readAsDataURL(blob)
      })
      css=`@font-face{font-family:${rule.style.fontFamily};font-style:${rule.style.fontStyle};font-weight:${rule.style.fontWeight};src:url("${data}")}`
      faces.push(css)
    }
  }
  if(!faces.length)throw new Error('Math fonts are not ready. Reload and try again.')
  return faces.join('\n')
}

function inlineStyles(source,target){
  const style=getComputedStyle(source)
  for(const name of style)target.style.setProperty(name,style.getPropertyValue(name))
  Array.from(source.children).forEach((child,index)=>inlineStyles(child,target.children[index]))
}

export async function prepareMarkdownExport(source){
  await document.fonts.ready
  const clone=source.cloneNode(true)
  const formulas=[...source.querySelectorAll('.katex')]
  const copies=[...clone.querySelectorAll('.katex')]
  const fonts=formulas.length?await embeddedMathFonts():''
  for(let index=0;index<formulas.length;index++){
    const formula=formulas[index],copy=formula.cloneNode(true)
    inlineStyles(formula,copy)
    const bounds=formula.getBoundingClientRect(),padding=4
    const width=Math.ceil(bounds.width)+padding*2,height=Math.ceil(bounds.height)+padding*2
    if(width>4096||height>4096)throw new Error('A formula is too large. Split it into shorter equations.')
    const wrapper=document.createElement('div')
    wrapper.setAttribute('xmlns','http://www.w3.org/1999/xhtml')
    wrapper.style.cssText=`position:relative;width:${width}px;height:${height}px;padding:${padding}px;box-sizing:border-box;background:white;`
    const style=document.createElement('style');style.textContent=fonts;wrapper.append(style,copy)
    copy.style.margin='0';copy.style.position='static'
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(wrapper)}</foreignObject></svg>`
    const image=new Image()
    image.src=`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    await image.decode()
    const canvas=document.createElement('canvas');canvas.width=width*3;canvas.height=height*3
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height)
    const replacement=new Image();replacement.src=canvas.toDataURL('image/png')
    replacement.alt=formula.textContent;replacement.className='markdown-pdf-formula'
    replacement.style.cssText=`display:inline-block;width:${width}px;height:auto;max-width:100%;margin:-${padding}px;vertical-align:middle;`
    copies[index].replaceWith(replacement)
    await replacement.decode()
  }
  return clone
}
