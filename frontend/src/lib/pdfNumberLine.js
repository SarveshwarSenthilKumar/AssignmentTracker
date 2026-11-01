// Local geometry only: a recent axis and at least three crossing tick strokes.
// Labels, arrows and mathematical values are deliberately left untouched.
export function detectNumberLine(items,scale=1){
  const latest=items.at(-1)
  if(latest?.tool!=='pen'||!latest.inkCreatedAt)return null
  const recent=items.slice(-80).filter(item=>item.tool==='pen'&&item.page===latest.page&&item.color===latest.color&&item.strokeWidth===latest.strokeWidth&&item.inkCreatedAt&&latest.inkCreatedAt-item.inkCreatedAt>=0&&latest.inkCreatedAt-item.inkCreatedAt<90000&&!item.dottedLine&&!item.dashedLine)
  const segment=item=>{
    const points=item.points
    if(!points||points.length<2||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null
    const a=points[0],b=points.at(-1),length=Math.hypot(b.x-a.x,b.y-a.y)
    let travel=0
    for(let i=1;i<points.length;i++)travel+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y)
    if(!length||length/Math.max(travel,.001)<.85)return null
    if(points.some(p=>Math.abs((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))/length>Math.max(2/scale,length*.025)))return null
    return {item,a,b,length}
  }
  const segments=recent.map(segment).filter(Boolean)
  for(const axis of [...segments].sort((a,b)=>b.length-a.length)){
    if(axis.length<100||axis.length*scale<120)continue
    const dx=(axis.b.x-axis.a.x)/axis.length,dy=(axis.b.y-axis.a.y)/axis.length
    const project=p=>(p.x-axis.a.x)*dx+(p.y-axis.a.y)*dy
    const normal=p=>-(p.x-axis.a.x)*dy+(p.y-axis.a.y)*dx
    const ticks=segments.filter(tick=>tick!==axis&&tick.length*scale>=7&&tick.length<=Math.min(40/scale,axis.length*.22)&&!tick.item.numberLineAxis).map(tick=>{
      const na=normal(tick.a),nb=normal(tick.b),t=(project(tick.a)+project(tick.b))/2
      return {...tick,t,na,nb}
    }).filter(tick=>Math.abs(tick.nb-tick.na)/tick.length>.9&&tick.na*tick.nb<=0&&Math.abs((tick.na+tick.nb)/2)<=tick.length*.3&&tick.t>=-2/scale&&tick.t<=axis.length+2/scale).sort((a,b)=>a.t-b.t)
    if(ticks.length<3||ticks.length>40||![axis.item,...ticks.map(tick=>tick.item)].includes(latest))continue
    if(axis.item.numberLineGroup&&ticks.some(tick=>tick.item.numberLineGroup&&tick.item.numberLineGroup!==axis.item.numberLineGroup))continue
    const span=ticks.at(-1).t-ticks[0].t,spacing=span/(ticks.length-1)
    if(spacing*scale<12||span<axis.length*.35)continue
    if(ticks.some((tick,index)=>Math.abs(tick.t-(ticks[0].t+index*spacing))>Math.min(7/scale,spacing*.2)))continue
    const lengths=ticks.map(tick=>tick.length).sort((a,b)=>a-b),height=lengths[Math.floor(lengths.length/2)]
    if(ticks.some(tick=>Math.abs(tick.length-height)>height*.4))continue
    const group=axis.item.numberLineGroup||`number-line:${axis.item.id}`
    const replacements=[{original:axis.item,replacement:{...axis.item,straightLine:false,numberLineGroup:group,numberLineAxis:true,points:[axis.a,axis.b]}}]
    ticks.forEach((tick,index)=>{
      const t=ticks[0].t+index*spacing,x=axis.a.x+dx*t,y=axis.a.y+dy*t
      replacements.push({original:tick.item,replacement:{...tick.item,straightLine:false,numberLineGroup:group,numberLineAxis:false,points:[-1,1].map(sign=>({x:x-dy*height/2*sign,y:y+dx*height/2*sign,pressure:.5}))}})
    })
    return replacements
  }
  return null
}
