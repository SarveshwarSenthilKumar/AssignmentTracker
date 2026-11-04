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

// Keep pen lifts as separate strokes. A V-shaped head or two detached wings
// can supply the destination even when they do not touch the shaft.
export function detectCopyArrowStrokes(strokes,scale=1){
  const zoom=Number.isFinite(scale)&&scale>0?scale:1
  const paths=strokes.map(stroke=>{
    const valid=stroke.filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y))
    // Bound simplification work for long, densely sampled stylus strokes.
    const stride=Math.max(1,Math.ceil(valid.length/1200))
    const sampled=valid.filter((_,index)=>index%stride===0)
    if(valid.length&&sampled.at(-1)!==valid.at(-1))sampled.push(valid.at(-1))
    return simplify(sampled,2.5/zoom)
  }).filter(path=>path.length>1)
  if(!paths.length)return null
  const length=path=>path.slice(1).reduce((sum,point,index)=>sum+distance(point,path[index]),0)
  const shaft=paths.reduce((best,path)=>length(path)>length(best)?path:best)
  const shaftLength=length(shaft)
  if(shaftLength*zoom<24)return null
  const single=detectCopyArrow(shaft,zoom)
  let best=single?.hasHead?{...single,score:2}:null
  const gap=Math.min(90/zoom,Math.max(30/zoom,shaftLength*.4))
  const consider=(tip,left,right)=>{
    const a=distance(tip,left),b=distance(tip,right)
    if(Math.min(a,b)*zoom<4||Math.max(a,b)>Math.min(130/zoom,shaftLength*.9)||Math.max(a,b)/Math.min(a,b)>4)return
    const cosine=((left.x-tip.x)*(right.x-tip.x)+(left.y-tip.y)*(right.y-tip.y))/(a*b)
    if(cosine<-.85||cosine>.96)return
    const midpoint={x:(left.x+right.x)/2,y:(left.y+right.y)/2}
    const headDirection={x:tip.x-midpoint.x,y:tip.y-midpoint.y}
    const headLength=Math.hypot(headDirection.x,headDirection.y)
    if(headLength*zoom<3)return
    for(const reverse of [false,true]){
      const ordered=reverse?[...shaft].reverse():shaft
      const end=ordered.at(-1)
      let previous=ordered[0],travel=0
      for(let i=ordered.length-2;i>=0;i--){travel+=distance(ordered[i+1],ordered[i]);previous=ordered[i];if(travel>=Math.max(12/zoom,Math.min(40/zoom,shaftLength*.25)))break}
      const tangent=distance(end,previous)
      if(!tangent)continue
      const ux=(end.x-previous.x)/tangent,uy=(end.y-previous.y)/tangent
      const alignment=(headDirection.x*ux+headDirection.y*uy)/headLength
      const separation=distance(tip,end)
      const ahead=(tip.x-end.x)*ux+(tip.y-end.y)*uy
      if(alignment<.45||separation>gap||ahead< -Math.max(a,b)*.6)continue
      const score=alignment*2-separation/gap-Math.abs(Math.log(a/b))*.15
      if(!best||score>best.score)best={tip,hasHead:true,score}
    }
  }
  const heads=paths.filter(path=>path!==shaft)
  for(const path of heads){
    for(let i=1;i<path.length-1;i++)consider(path[i],path[0],path.at(-1))
  }
  // Join the near ends of two independently drawn wings. For small gaps,
  // intersect their supporting lines to estimate the actual apex.
  for(let i=0;i<heads.length;i++)for(let j=i+1;j<heads.length;j++){
    const a=heads[i],b=heads[j]
    for(const flipA of [false,true])for(const flipB of [false,true]){
      const nearA=flipA?a.at(-1):a[0],farA=flipA?a[0]:a.at(-1)
      const nearB=flipB?b.at(-1):b[0],farB=flipB?b[0]:b.at(-1)
      if(distance(nearA,nearB)*zoom>30)continue
      let tip={x:(nearA.x+nearB.x)/2,y:(nearA.y+nearB.y)/2}
      const ax=nearA.x-farA.x,ay=nearA.y-farA.y,bx=nearB.x-farB.x,by=nearB.y-farB.y,det=ax*by-ay*bx
      if(Math.abs(det)>1e-6){
        const t=((farB.x-farA.x)*by-(farB.y-farA.y)*bx)/det
        const intersection={x:farA.x+t*ax,y:farA.y+t*ay}
        if(distance(intersection,nearA)*zoom<30&&distance(intersection,nearB)*zoom<30)tip=intersection
      }
      consider(tip,farA,farB)
    }
  }
  return best||single||{tip:shaft.at(-1),hasHead:false}
}
