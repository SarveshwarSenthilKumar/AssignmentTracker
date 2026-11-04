const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)

// Remove small hand tremors without assuming the shaft is straight.
function simplify(points,tolerance){
  if(points.length<3)return points
  const first=points[0],last=points.at(-1),dx=last.x-first.x,dy=last.y-first.y,length=dx*dx+dy*dy
  let greatest=0,index=0
  for(let i=1;i<points.length-1;i++){
    const point=points[i],t=length?Math.max(0,Math.min(1,((point.x-first.x)*dx+(point.y-first.y)*dy)/length)):0
    const deviation=Math.hypot(point.x-first.x-t*dx,point.y-first.y-t*dy)
    if(deviation>greatest){greatest=deviation;index=i}
  }
  if(greatest<=tolerance)return [first,last]
  return [...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)]
}

export function detectCopyArrow(points,scale=1){
  const zoom=Number.isFinite(scale)&&scale>0?scale:1
  const clean=[]
  for(const point of points){
    if(!Number.isFinite(point.x)||!Number.isFinite(point.y))continue
    if(!clean.length||distance(clean.at(-1),point)*zoom>=1)clean.push(point)
  }
  if(clean.length<2)return null
  const path=simplify(clean,2.5/zoom),travel=[0]
  for(let i=1;i<path.length;i++)travel.push(travel[i-1]+distance(path[i-1],path[i]))
  const total=travel.at(-1)
  if(total*zoom<24||Math.max(...path.map(point=>distance(point,path[0])))*zoom<20)return null
  // A head folds back against the incoming shaft. Only accept a compact
  // terminal cluster, so an earlier bend in a curved shaft is not the tip.
  for(let i=1;i<path.length-1;i++){
    const tip=path[i],before=path[i-1],after=path[i+1]
    if(travel[i]<total*.45||travel[i]*zoom<20)continue
    const incoming=distance(before,tip),outgoing=distance(tip,after)
    if(incoming*zoom<6||outgoing*zoom<5)continue
    const ux=(tip.x-before.x)/incoming,uy=(tip.y-before.y)/incoming
    const dot=(ux*(after.x-tip.x)+uy*(after.y-tip.y))/outgoing
    if(dot>-.25)continue
    const radius=Math.min(80/zoom,Math.max(12/zoom,travel[i]*.5))
    const tail=path.slice(i+1)
    if(total-travel[i]>radius*4)continue
    if(tail.every(point=>distance(point,tip)<=radius&&(point.x-tip.x)*ux+(point.y-tip.y)*uy<=radius*.18))return {tip,hasHead:true}
  }
  // Without a recognizable head, follow the drawn path to its endpoint.
  // Unlike distance-from-origin, this also follows curved and looping shafts.
  return {tip:clean.at(-1),hasHead:false}
}
