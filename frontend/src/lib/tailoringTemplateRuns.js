// Text annotations are editable regions in their own right. Keep the original
// PDF bytes and annotation objects; never flatten away fonts, ink or images.
export function tailoringTemplateRuns(baseRuns,annotations,page){
  const replaced=new Set(annotations.filter(item=>(item.page||1)===page&&item.sourceText).map(item=>item.sourceText.key))
  const result=baseRuns.filter(run=>!replaced.has(run.key)).map(run=>({...run,page}))
  const context=document.createElement('canvas').getContext('2d')
  annotations.forEach((item,index)=>{
    if(item.tool!=='text'||(item.page||1)!==page||typeof item.text!=='string')return
    const size=item.fontSize||16
    const style=item.textStyle||{fontName:'Helvetica',fontFamily:'Helvetica, Arial, sans-serif',fontWeight:400,embedded:false,approximate:false,horizontalScale:1,baselineRatio:.9465}
    context.font=`${style.embedded?'normal':style.italic?'italic':'normal'} ${style.embedded?400:style.fontWeight||400} ${size}px ${style.fontFamily||'Helvetica, Arial, sans-serif'}`
    item.text.split('\n').forEach((text,line)=>{
      if(!text.trim())return
      const measured=(context.measureText(text).width+(style.letterSpacing||0)*Math.max(0,text.length-1))*(style.horizontalScale||1)
      const baseline=item.y+2+size*(style.baselineRatio||.9465)+line*size*1.2
      const run={key:`annotation:${index}:${line}`,text,page,x:item.x+4,y:baseline-size*.8,width:Math.max(1,measured,(item.sourceText?.width||1)-1),height:size,fontSize:size,baseline,textStyle:{...style,pdfFontId:`annotation:${index}:${style.pdfFontId||style.fontName||'Helvetica'}`},color:item.color||'#000000'}
      const position=result.findIndex(existing=>existing.y>run.y+size*.4)
      if(position<0)result.push(run);else result.splice(position,0,run)
    })
  })
  return result
}
