// Reflow only within existing adjacent lines with identical typography.
// No font substitution, resizing, character-spacing changes or extra lines.
export function layoutCoverLetter(slots,changes,runs,{preserveBullets=false}={}){
  const replacements=new Map(changes.map(item=>[item.id,item.text]))
  const context=document.createElement('canvas').getContext('2d')
  const entries=slots.map(slot=>({id:slot.id,run:runs.get(slot.id),text:replacements.get(slot.id)??slot.text,original:slot.text}))
  const measure=(run,text)=>{
    const style=run.textStyle
    context.font=`${style.embedded?'normal':style.italic?'italic':'normal'} ${style.embedded?400:style.fontWeight||400} ${run.fontSize}px ${style.fontFamily}`
    return (context.measureText(text).width+(style.letterSpacing||0)*Math.max(0,text.length-1))*(style.horizontalScale||1)
  }
  const sameParagraph=(a,b)=>{
    const x=a.run,y=b.run
    if(!x||!y)return false
    return x.page===y.page&&Math.abs(x.x-y.x)<2&&y.y-x.y>Math.max(x.height,y.height)*.5&&y.y-x.y<Math.max(x.height,y.height)*1.6&&Math.abs(x.fontSize-y.fontSize)<.05&&x.color===y.color&&x.textStyle.pdfFontId===y.textStyle.pdfFontId&&Math.abs((x.textStyle.horizontalScale||1)-(y.textStyle.horizontalScale||1))<.01&&Math.abs((x.textStyle.letterSpacing||0)-(y.textStyle.letterSpacing||0))<.01
  }
  const groups=[]
  for(const entry of entries){
    const group=groups[groups.length-1]
    const startsBullet=/^\s*(?:[•●○▪◦‣⁃·*–—-]\s*|\d+[.)]\s+)/.test(entry.original)
    if(group&&sameParagraph(group[group.length-1],entry)&&!(preserveBullets&&startsBullet))group.push(entry)
    else groups.push([entry])
  }
  for(const group of groups){
    if(!group.some(entry=>entry.text!==entry.original))continue
    for(const entry of group){
      if(!entry.run)throw new Error('Template layout is unavailable. Generate the letter again.')
      if(entry.run.textStyle.approximate)throw new Error(`The original font (${entry.run.textStyle.fontName}) is unavailable. Upload the Word original or a PDF with embedded fonts to preserve typography.`)
    }
    if(group.every(entry=>!/[\r\n]/.test(entry.text)&&measure(entry.run,entry.text)<=entry.run.width+.5))continue
    if(group.some(entry=>/[\r\n]/.test(entry.text)))throw new Error('Keep the existing PDF line breaks. Use the Word original to change paragraph structure.')
    const words=group.map(entry=>entry.text).join(' ').trim().split(/\s+/).filter(Boolean)
    let word=0
    const lines=[]
    for(const entry of group){
      let line=''
      while(word<words.length){
        const candidate=line?`${line} ${words[word]}`:words[word]
        if(measure(entry.run,candidate)>entry.run.width+.5)break
        line=candidate;word++
      }
      lines.push(line)
    }
    if(word<words.length)throw new Error(`The paragraph beginning “${group[0].text.slice(0,70)}” is too long at the original font and size. Shorten its wording or use the Word template for natural page reflow. Your draft has been kept.`)
    group.forEach((entry,index)=>{entry.text=lines[index]})
  }
  return entries.filter(entry=>entry.text!==entry.original).map(({id,text})=>({id,text}))
}
