const median=values=>{
  const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2)
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2
}

// PDF font resource IDs distinguish real font faces, including separate bold
// and italic faces. Never infer a font from spatial proximity alone.
export function calibratePeerFonts(runs){
  const groups=new Map()
  for(const run of runs){
    const id=run.textStyle.pdfFontId
    if(!id)continue
    if(!groups.has(id))groups.set(id,[])
    groups.get(id).push(run)
  }
  for(const peers of groups.values()){
    // Longer runs offer more reliable evidence than punctuation or a single glyph.
    const samples=peers.filter(run=>[...run.text.replace(/\s/g,'')].length>=4&&Number.isFinite(run.textStyle.horizontalScale)&&run.textStyle.horizontalScale>0)
      .sort((a,b)=>Math.min(b.text.length,80)-Math.min(a.text.length,80)).slice(0,32)
    if(samples.length<2||samples.reduce((n,run)=>n+run.text.replace(/\s/g,'').length,0)<16)continue
    const ratios=samples.map(run=>run.textStyle.horizontalScale/(run.textStyle.pdfHorizontalScale||1))
    const center=median(ratios),deviation=median(ratios.map(value=>Math.abs(value-center)))
    if(!Number.isFinite(center)||center<.5||center>2)continue
    const tolerance=Math.max(center*.035,deviation*3)
    const consistent=samples.filter((run,index)=>Math.abs(ratios[index]-center)<=tolerance)
    if(consistent.length<2||consistent.length<samples.length*.7||deviation/center>.08)continue
    const factor=median(consistent.map(run=>run.textStyle.horizontalScale/(run.textStyle.pdfHorizontalScale||1)))
    for(const run of peers){
      const style=run.textStyle,scale=factor*(style.pdfHorizontalScale||1)
      // Keep explicit per-run spacing, size and color. Outlying stretches are
      // deliberately left alone rather than being forced to match body text.
      if(Math.abs(scale-style.horizontalScale)>Math.max(.12,scale*.15))continue
      style.horizontalScale=scale
      style.peerCalibration={samples:consistent.length,method:'same-pdf-font',approximate:style.approximate}
    }
  }
  return runs
}
