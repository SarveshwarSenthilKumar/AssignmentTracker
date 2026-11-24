import {pdfTextLines,stickyNoteSize,pdfObjectSize} from './pdfTextBox'
import {NOTE_INK_GRID,NOTE_INK_WIDTH} from './stickyNoteInk'

export function selectionHasInk(items,box){
  return items.some(item=>{
    // A translucent highlight does not change the printed equation beneath it.
    if(item.tool==='highlighter')return false
    if(item.points?.length){const xs=item.points.map(point=>point.x),ys=item.points.map(point=>point.y);return Math.min(...xs)<=box.x+box.width&&Math.max(...xs)>=box.x&&Math.min(...ys)<=box.y+box.height&&Math.max(...ys)>=box.y}
    const hasNoteInk=item.stickyNote&&item.ink?.length
    if(item.tool!=='image'&&!hasNoteInk)return false
    const {width,height}=hasNoteInk?stickyNoteSize(item):item
    return item.x<box.x+box.width&&item.x+width>box.x&&item.y<box.y+box.height&&item.y+height>box.y
  })
}

export async function mathSelectionImage(page,box,items,padding=5){
  const viewport=page.getViewport({scale:1})
  const x=Math.max(0,box.x-padding),y=Math.max(0,box.y-padding),width=Math.min(viewport.width-x,box.width+padding*2),height=Math.min(viewport.height-y,box.height+padding*2)
  if(width<=0||height<=0)throw new Error('Select an area inside the page.')
  const scale=Math.min(3,1600/Math.max(width,height)),canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.ceil(width*scale));canvas.height=Math.max(1,Math.ceil(height*scale))
  const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height)
  await page.render({canvasContext:context,viewport,transform:[scale,0,0,scale,-x*scale,-y*scale],background:'white'}).promise
  context.setTransform(scale,0,0,scale,-x*scale,-y*scale)
  for(const item of items){
    context.save()
    if(item.rotation&&!item.sourceText&&['image','text'].includes(item.tool)){
      const {width,height}=pdfObjectSize(item)
      const x=item.x+width/2,y=item.y+height/2
      context.translate(x,y)
      context.rotate(item.rotation*Math.PI/180)
      context.translate(-x,-y)
    }
    if(item.points?.length){
      context.strokeStyle=item.color||'#000';context.fillStyle=item.color||'#000';context.lineWidth=item.strokeWidth||2;context.lineCap='round';context.lineJoin='round';context.globalAlpha=item.tool==='highlighter' ? 0.3 : 1
      const first=item.points[0];context.beginPath();context.moveTo(first.x,first.y)
      if(item.points.length===1){context.arc(first.x,first.y,context.lineWidth/2,0,Math.PI*2);context.fill()}
      else{for(const point of item.points.slice(1))context.lineTo(point.x,point.y);context.stroke()}
    }else if(item.tool==='text'){
      if(item.stickyNote){
        const {width,height}=stickyNoteSize(item)
        context.fillStyle=item.noteColor||'#fff1a8'
        context.fillRect(item.x,item.y,width,height)
      }
      context.font=`${item.fontSize||16}px Helvetica, Arial, sans-serif`;context.fillStyle=item.color||'#000';context.textBaseline='top'
      pdfTextLines(item).forEach((line,index)=>context.fillText(line,item.x+4,item.y+2+index*(item.fontSize||16)*1.2))
      if(item.stickyNote&&item.ink?.length){
        const {width,height}=stickyNoteSize(item)
        context.translate(item.x,item.y)
        context.scale(width/NOTE_INK_GRID,height/NOTE_INK_GRID)
        context.fillStyle=context.strokeStyle='#302a24'
        context.lineWidth=NOTE_INK_WIDTH
        context.lineCap=context.lineJoin='round'
        for(const stroke of item.ink){
          if(!stroke.length)continue
          const [x,y]=stroke[0]
          context.beginPath()
          if(stroke.length===1){
            context.arc(x,y,NOTE_INK_WIDTH/2,0,Math.PI*2)
            context.fill()
          }else{
            context.moveTo(x,y)
            for(let i=1;i<stroke.length;i++)context.lineTo(...stroke[i])
            context.stroke()
          }
        }
      }
    }else if(item.tool==='image'&&item.dataUrl?.startsWith('data:image/')){
      const image=new Image();image.src=item.dataUrl;try{await image.decode();context.drawImage(image,item.x,item.y,item.width,item.height)}catch{context.restore();throw new Error('An inserted image could not be read. Try selecting again.')}
    }
    context.restore()
  }
  return canvas.toDataURL('image/png')
}
