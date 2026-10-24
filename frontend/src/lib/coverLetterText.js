// Keep the document's text-region IDs behind a single native textarea.
export function letterRegions(slots,changes,runs){
  const replacements=new Map(changes.map(item=>[item.id,item.text]))
  return slots.map((slot,index)=>{
    const previous=slots[index-1],run=runs.get(slot.id),prior=previous&&runs.get(previous.id)
    let separator=index?' ':''
    if(index&&slot.separatorBefore!==undefined)separator=slot.separatorBefore
    else if(run&&prior){
      const gap=run.y-prior.y
      separator=run.page!==prior.page?'\n\n':Math.abs(gap)<Math.max(run.height,prior.height)*.4?' ':gap>Math.max(run.height,prior.height)*1.6?'\n\n':'\n'
    }
    return {...slot,text:replacements.get(slot.id)??slot.text,separator}
  })
}

export const letterText=regions=>regions.map(region=>region.separator+region.text).join('')

export function editLetter(regions,value){
  const before=letterText(regions)
  if(before===value)return regions.map(({id,text})=>({id,text}))
  let start=0,end=before.length,nextEnd=value.length
  while(start<end&&start<nextEnd&&before[start]===value[start])start++
  while(end>start&&nextEnd>start&&before[end-1]===value[nextEnd-1]){end--;nextEnd--}
  let offset=0
  const bounds=regions.map(region=>{const begin=offset+region.separator.length;offset=begin+region.text.length;return {begin,end:offset}})
  let first=bounds.findIndex(bound=>bound.end>=start)
  if(first<0)first=regions.length-1
  let last=first
  while(last<regions.length-1&&bounds[last+1].begin<end)last++
  const prefix=regions[first].text.slice(0,Math.max(0,start-bounds[first].begin))
  const suffix=regions[last].text.slice(Math.max(0,end-bounds[last].begin))
  let remaining=prefix+value.slice(start,nextEnd)+suffix
  const result=regions.map(({id,text})=>({id,text}))
  // Multi-region pastes are apportioned at word boundaries so an entire letter
  // is not squeezed into the first PDF line or Word formatting run.
  let weight=regions.slice(first,last+1).reduce((sum,region)=>sum+Math.max(1,region.text.length),0)
  for(let index=first;index<=last;index++){
    const size=Math.max(1,regions[index].text.length)
    let cut=remaining.length
    if(index<last){
      const target=Math.round(remaining.length*size/weight)
      const after=remaining.indexOf(' ',target),prior=remaining.lastIndexOf(' ',target)
      cut=after<0?(prior<0?target:prior):prior>=0&&target-prior<after-target?prior:after
    }
    result[index].text=remaining.slice(0,cut)
    remaining=remaining.slice(cut)
    if(regions[index+1]?.separator)remaining=remaining.replace(/^ /,'')
    weight-=size
  }
  return result
}
