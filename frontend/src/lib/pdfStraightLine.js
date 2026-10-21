// Conservative intent detection in page units. Check geometry rather than
// pointer speed so mouse, stylus, and touch strokes behave consistently.
export function straightenStroke(points,scale=1){
  if(points.length<4||points.some(point=>!Number.isFinite(point.x)||!Number.isFinite(point.y)))return null
  const first=points[0],last=points[points.length-1],dx=last.x-first.x,dy=last.y-first.y,length=Math.hypot(dx,dy)
  if(length<72||length*Math.max(.25,scale)<100)return null
  let travel=0
  const cumulative=[0]
  for(let i=1;i<points.length;i++){travel+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);cumulative.push(travel)}
  if(!travel||length/travel<.94)return null
  const tolerance=Math.min(8,Math.max(2.5,length*.025))
  let squared=0,cursor=1
  // Sample by distance so a pause or a burst of coalesced events cannot bias confidence.
  for(let index=0;index<=32;index++){
    const distance=travel*index/32
    while(cursor<points.length-1&&cumulative[cursor]<distance)cursor++
    const start=points[cursor-1],end=points[cursor],segment=cumulative[cursor]-cumulative[cursor-1]
    const fraction=segment?(distance-cumulative[cursor-1])/segment:0
    const x=start.x+(end.x-start.x)*fraction,y=start.y+(end.y-start.y)*fraction
    const deviation=Math.abs(dx*(y-first.y)-dy*(x-first.x))/length
    const projection=((x-first.x)*dx+(y-first.y)*dy)/(length*length)
    if(deviation>tolerance||projection<-.015||projection>1.015)return null
    squared+=deviation*deviation
  }
  // Also check every original point, so short corners aren't missed by sampling.
  if(points.some(point=>Math.abs(dx*(point.y-first.y)-dy*(point.x-first.x))/length>tolerance))return null
  if(Math.sqrt(squared/33)>Math.max(1.25,tolerance*.55))return null
  const pressure=points.reduce((sum,point)=>sum+(point.pressure??.5),0)/points.length
  return [{x:first.x,y:first.y,pressure},{x:last.x,y:last.y,pressure}]
}
