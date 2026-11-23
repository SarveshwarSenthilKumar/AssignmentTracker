import {MAX_WALL_SIZE} from './detectiveWallLimits'

const bounds=node=>{
  const angle=node.rotation*Math.PI/180
  const w=Math.abs(node.width*Math.cos(angle))+Math.abs(node.height*Math.sin(angle))
  const h=Math.abs(node.width*Math.sin(angle))+Math.abs(node.height*Math.cos(angle))
  return {cx:node.x+node.width/2,cy:node.y+node.height/2,w,h}
}
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value))

// A local, gentle relaxation, rather than a grid layout. Some paper overlap is
// intentional; only cards affected by an enlargement and their neighbors move.
export function spreadGrowingCards(before,next,{fromGesture=false,resizingIds=[]}={}){
  const previous=new Map(before.map(node=>[node.id,node]))
  const resizing=new Set(resizingIds)
  const growing=new Set(next.filter(node=>{
    const old=previous.get(node.id)
    return old&&node.type!=='pin'&&(node.width>old.width+.1||node.height>old.height+.1)
  }).map(node=>node.id))
  const restored=fromGesture?next.map(node=>{
    const old=previous.get(node.id)
    return old&&!growing.has(node.id)&&!resizing.has(node.id)?{...node,x:old.x,y:old.y}:node
  }):next
  if(!growing.size)return restored
  const nodes=restored.map(node=>({...node})),active=new Set(growing)
  const geometry=new Map(nodes.map(node=>[node.id,bounds(node)]))
  const translate=(node,dx,dy)=>{
    const x=clamp(node.x+dx,0,Math.max(0,MAX_WALL_SIZE-node.width))
    const y=clamp(node.y+dy,0,Math.max(0,MAX_WALL_SIZE-node.height))
    if(Math.abs(x-node.x)+Math.abs(y-node.y)>.05)active.add(node.id)
    node.x=x;node.y=y
    geometry.set(node.id,bounds(node))
  }
  for(let pass=0;pass<12;pass++){
    let changed=false
    for(let i=0;i<nodes.length;i++){
      const a=nodes[i];if(a.type==='pin')continue
      for(let j=i+1;j<nodes.length;j++){
        const b=nodes[j]
        if(b.type==='pin'||(!active.has(a.id)&&!active.has(b.id)))continue
        const ab=geometry.get(a.id),bb=geometry.get(b.id)
        // Keep roughly a tenth of the smaller card available for natural overlap.
        const overlapX=(ab.w+bb.w)/2-Math.abs(ab.cx-bb.cx)-Math.min(ab.w,bb.w)*.10
        const overlapY=(ab.h+bb.h)/2-Math.abs(ab.cy-bb.cy)-Math.min(ab.h,bb.h)*.10
        if(overlapX<=1||overlapY<=1)continue
        const horizontal=overlapX<overlapY
        const direction=horizontal?(bb.cx>=ab.cx?1:-1):(bb.cy>=ab.cy?1:-1)
        const shift=(horizontal?overlapX:overlapY)*.8+1
        const aGrowing=growing.has(a.id),bGrowing=growing.has(b.id)
        // Keep an individually resized card under the pointer; make room around it.
        const aShare=aGrowing&&!bGrowing?0:bGrowing&&!aGrowing?1:.5
        translate(a,horizontal?-direction*shift*aShare:0,horizontal?0:-direction*shift*aShare)
        translate(b,horizontal?direction*shift*(1-aShare):0,horizontal?0:direction*shift*(1-aShare))
        changed=true
      }
    }
    if(!changed)break
  }
  return nodes.map((node,index)=>node.x===restored[index].x&&node.y===restored[index].y?restored[index]:node)
}
