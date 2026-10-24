const tidy=value=>String(value||'').replace(/\s+/g,' ').trim()
export function pdfJobLayout(content,viewport,pdfjs,page){
  const rows=[]
  for(const item of content.items){
    if(!tidy(item.str)||!item.transform)continue
    const t=pdfjs.Util.transform(viewport.transform,item.transform),height=Math.hypot(t[2],t[3])||10
    if(Math.abs(Math.atan2(t[1],t[0]))>.08)continue
    let row=rows.find(row=>Math.abs(row.y-t[5])<Math.max(2,Math.min(row.height,height)*.25))
    if(!row){row={y:t[5],height,items:[]};rows.push(row)}
    row.items.push({text:item.str,x:t[4],width:item.width||0,height})
  }
  const lines=[]
  for(const row of rows.sort((a,b)=>a.y-b.y)){
    let group=[]
    const flush=()=>{
      if(!group.length)return
      let value='',previous
      for(const item of group){const space=previous&&item.x-previous.x-previous.width>Math.min(item.height,previous.height)*.12?' ':'';value+=space+item.text;previous=item}
      const left=Math.min(...group.map(i=>i.x)),right=Math.max(...group.map(i=>i.x+i.width)),height=Math.max(...group.map(i=>i.height))
      lines.push({text:tidy(value),page,x:Math.max(0,left/viewport.width),y:Math.max(0,(row.y-height)/viewport.height),width:Math.max(0,(right-left)/viewport.width),height:height/viewport.height,confidence:100})
      group=[]
    }
    for(const item of row.items.sort((a,b)=>a.x-b.x)){const last=group.at(-1);if(last&&item.x-last.x-last.width>Math.max(35,row.height*3))flush();group.push(item)}flush()
  }
  return lines
}
export function ocrJobLayout(data,width,height,page){
  const lines=[]
  for(const block of data.blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[]){
    if(!tidy(line.text)||!line.bbox)continue
    const b=line.bbox;lines.push({text:tidy(line.text),page,x:b.x0/width,y:b.y0/height,width:(b.x1-b.x0)/width,height:(b.y1-b.y0)/height,confidence:Number.isFinite(line.confidence)?line.confidence:data.confidence||0})
  }
  return lines
}
