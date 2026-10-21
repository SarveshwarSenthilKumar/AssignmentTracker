const point=(a,b,t)=>({...a,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,pressure:(a.pressure??.5)+((b.pressure??.5)-(a.pressure??.5))*t})
const strokeBounds=new WeakMap()
function bounds(points){
  let value=strokeBounds.get(points)
  if(!value){value={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};for(const point of points){value.left=Math.min(value.left,point.x);value.top=Math.min(value.top,point.y);value.right=Math.max(value.right,point.x);value.bottom=Math.max(value.bottom,point.y)}strokeBounds.set(points,value)}
  return value
}
function clip(a,b,c,r,shape){
  const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-c.x,oy=a.y-c.y
  if(shape==='square'){
    let lo=0,hi=1
    for(const [origin,delta]of [[ox,dx],[oy,dy]]){
      if(!delta){if(Math.abs(origin)>r)return null;continue}
      const first=(-r-origin)/delta,last=(r-origin)/delta
      lo=Math.max(lo,Math.min(first,last));hi=Math.min(hi,Math.max(first,last));if(lo>hi)return null
    }
    return [lo,hi]
  }
  const length=dx*dx+dy*dy
  if(!length)return ox*ox+oy*oy<=r*r?[0,1]:null
  const dot=ox*dx+oy*dy,d=dot*dot-length*(ox*ox+oy*oy-r*r)
  if(d<0)return null
  const lo=Math.max(0,(-dot-Math.sqrt(d))/length),hi=Math.min(1,(-dot+Math.sqrt(d))/length)
  return lo<=hi?[lo,hi]:null
}
function cut(stroke,c,r,shape,id){
  const points=stroke.points;r+=(stroke.strokeWidth||1)/2
  if(points.length===1)return clip(points[0],points[0],c,r,shape)?[]:[stroke]
  const chunks=[];let current=[],changed=false
  const append=value=>{const last=current[current.length-1];if(!last||Math.hypot(last.x-value.x,last.y-value.y)>.001)current.push(value)}
  const flush=()=>{if(current.length)chunks.push(current);current=[]}
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],hit=clip(a,b,c,r,shape)
    if(!hit||hit[1]-hit[0]<1e-8){append(a);append(b);continue}
    changed=true
    if(hit[0]>0){append(a);append(point(a,b,hit[0]));flush()}else flush()
    if(hit[1]<1){append(point(a,b,hit[1]));append(b)}
  }
  flush();return changed?chunks.map((points,i)=>({...stroke,id:i===0?stroke.id:id(),points})):[stroke]
}
export function eraseAnnotations(items,from,to,{size,shape,mode,target,page,measure,id}){
  const radius=size/2,steps=Math.max(1,Math.ceil(Math.hypot(to.x-from.x,to.y-from.y)/Math.max(.5,radius*.5)))
  let result=items
  for(let step=0;step<=steps;step++){
    const c=point(from,to,step/steps),next=[]
    for(const item of result){
      if((item.page||1)!==page){next.push(item);continue}
      if(item.points?.length){
        if(mode==='objects'||target!=='all'&&item.tool!==target){next.push(item);continue}
        const box=bounds(item.points),margin=radius+(item.strokeWidth||1)*.8
        if(c.x<box.left-margin||c.x>box.right+margin||c.y<box.top-margin||c.y>box.bottom+margin){next.push(item);continue}
        if(mode==='precision'){next.push(...cut(item,c,radius,shape,id));continue}
        const points=item.points,r=radius+(item.strokeWidth||1)/2
        if(!(points.length===1?clip(points[0],points[0],c,r,shape):points.some((p,i)=>i>0&&clip(points[i-1],p,c,r,shape))))next.push(item)
      }else if(mode==='objects'){
        const bounds=measure(item),x=Math.max(item.x,Math.min(c.x,item.x+bounds.width)),y=Math.max(item.y,Math.min(c.y,item.y+bounds.height))
        if(shape==='square'?Math.abs(c.x-x)>radius||Math.abs(c.y-y)>radius:Math.hypot(c.x-x,c.y-y)>radius)next.push(item)
      }else next.push(item)
    }
    result=next
  }
  return result.length===items.length&&result.every((item,i)=>item===items[i])?items:result
}
