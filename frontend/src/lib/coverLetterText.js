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
  const result=regions.map(({id,text})=>({id,text}))
  // Preserve untouched runs and their exact formatting. Do not proportionally
  // redistribute text between fonts, paragraphs or fixed PDF line positions.
  if(first!==last)throw new Error('This edit crosses template text regions. Edit one sentence or line at a time to preserve its formatting; keep the original paragraph and line breaks.')
  result[first].text=prefix+value.slice(start,nextEnd)+suffix
  return result
}
