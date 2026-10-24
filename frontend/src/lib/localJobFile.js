import {pdfjs} from 'react-pdf'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl

const check=signal=>{if(signal?.aborted)throw new DOMException('File import canceled.','AbortError')}
function pdfText(content,viewport){
  const lines=[]
  for(const item of content.items){
    if(!item.str?.trim()||!item.transform)continue
    const matrix=pdfjs.Util.transform(viewport.transform,item.transform),x=matrix[4],y=matrix[5],height=Math.hypot(matrix[2],matrix[3])||10
    let line=lines.find(value=>Math.abs(value.y-y)<Math.max(2,Math.min(height,value.height)*.3))
    if(!line){line={y,height,items:[]};lines.push(line)}
    line.items.push({x,width:item.width||0,text:item.str,height})
  }
  const ordered=lines.sort((a,b)=>a.y-b.y)
  const gaps=[]
  for(const line of ordered){const items=[...line.items].sort((a,b)=>a.x-b.x);for(let i=1;i<items.length;i++){const end=items[i-1].x+items[i-1].width;if(items[i].x-end>Math.max(45,line.height*4))gaps.push((items[i].x+end)/2)}}
  let columnBoundary=null
  for(const gap of gaps){const cluster=gaps.filter(value=>Math.abs(value-gap)<24);if(cluster.length>=4){columnBoundary=cluster.sort((a,b)=>a-b)[Math.floor(cluster.length/2)];break}}
  const renderLine=line=>{
    let previous=null
    return line.items.sort((a,b)=>a.x-b.x).map(item=>{
      const gap=previous?item.x-previous.x-previous.width:0
      // Preserve separation between columns/sidebars instead of constructing
      // a fictional sentence from unrelated text sharing the same baseline.
      const separate=previous&&gap>Math.max(38,Math.min(item.height,previous.height)*3)
      const prefix=separate?'\n':previous&&gap>Math.min(item.height,previous.height)*.12&&!/\s$/.test(previous.text)&&!/^\s/.test(item.text)?' ':''
      previous=item;return prefix+item.text
    }).join('')
  }
  if(columnBoundary!==null){
    const left=[],right=[]
    for(const line of ordered){const first=line.items.filter(item=>item.x<columnBoundary),second=line.items.filter(item=>item.x>=columnBoundary);if(first.length)left.push(renderLine({...line,items:first}));if(second.length)right.push(renderLine({...line,items:second}))}
    // Require substantial text on both sides before changing reading order.
    if(left.join('').length>200&&right.join('').length>100)return left.join('\n')+'\n\n'+right.join('\n')
  }
  return ordered.map(renderLine).join('\n')
}
function normalizeImage(canvas){
  const context=canvas.getContext('2d'),w=canvas.width,h=canvas.height
  // Sample the content, not just borders: dark browser chrome around a white
  // job page must not cause the actual document to be inverted.
  const samples=[]
  for(let row=1;row<=5;row++)for(let column=1;column<=5;column++){
    const pixel=context.getImageData(Math.min(w-1,Math.floor(w*column/6)),Math.min(h-1,Math.floor(h*row/6)),1,1).data
    samples.push((pixel[0]+pixel[1]+pixel[2])/3)
  }
  const light=samples.sort((a,b)=>a-b)[Math.floor(samples.length/2)]
  const adjusted=document.createElement('canvas');adjusted.width=w;adjusted.height=h
  const output=adjusted.getContext('2d');output.filter=`${light<100?'invert(1) ':''}grayscale(1) contrast(1.15)`;output.drawImage(canvas,0,0)
  canvas.width=1;canvas.height=1
  return adjusted
}
async function imageCanvas(file){
  const url=URL.createObjectURL(file),image=new Image()
  try{
    image.src=url;await image.decode()
    if(!image.naturalWidth||!image.naturalHeight||image.naturalWidth*image.naturalHeight>50000000)throw new Error('Choose an image under 50 megapixels.')
    const scale=Math.min(image.naturalWidth<1400?2:1,5000/Math.max(image.naturalWidth,image.naturalHeight),Math.sqrt(8000000/(image.naturalWidth*image.naturalHeight)))
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale))
    const context=canvas.getContext('2d');context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height)
    return normalizeImage(canvas)
  }finally{URL.revokeObjectURL(url)}
}
export async function readLocalJobFile(file,{signal,onProgress=()=>{}}={}){
  if(!file?.size||file.size>10*1024*1024)throw new Error('Choose a nonempty job file up to 10 MB.')
  if(!/\.(pdf|png|jpe?g|webp)$/i.test(file.name))throw new Error('Choose PDF, PNG, JPEG or WebP.')
  let ocr=null,pdfTask=null,currentPage=1,pageCount=1,ocrPages=0,textPages=0
  const warnings=[]
  const cancel=()=>{ocr?.terminate().catch(()=>{});pdfTask?.destroy().catch(()=>{})}
  signal?.addEventListener('abort',cancel,{once:true})
  const recognize=async canvas=>{
    try{
      check(signal)
      if(!ocr){
        onProgress({message:'Preparing local OCR (first use downloads English recognition data)…'})
        const {createWorker,PSM}=await import('tesseract.js')
        check(signal)
        const pending=createWorker('eng',1,{logger:entry=>{if(!signal?.aborted)onProgress({message:`Page ${currentPage} of ${pageCount}: ${entry.status}`,progress:Number.isFinite(entry.progress)?Math.round(entry.progress*100):undefined})}})
        // Cancel the UI immediately even if worker/language downloads are pending.
        // A worker that finishes initializing later is terminated without receiving an image.
        ocr=await new Promise((resolve,reject)=>{
          const stopped=()=>reject(new DOMException('File import canceled.','AbortError'))
          signal?.addEventListener('abort',stopped,{once:true})
          pending.then(worker=>{signal?.removeEventListener('abort',stopped);if(signal?.aborted){worker.terminate().catch(()=>{});stopped()}else resolve(worker)},error=>{signal?.removeEventListener('abort',stopped);reject(new Error(`Local OCR could not start. First use needs internet access to download the OCR engine and English data. Try again or paste the job text. ${error.message||''}`))})
          if(signal?.aborted)stopped()
        })
        check(signal);await ocr.setParameters({tessedit_pageseg_mode:PSM.AUTO,preserve_interword_spaces:'1',user_defined_dpi:'200'})
      }
      const result=await ocr.recognize(canvas);check(signal)
      ocrPages++
      if(result.data.confidence<65)warnings.push(`Page ${currentPage} has low OCR confidence. Check names, salary figures and dates.`)
      return result.data.text
    }finally{canvas.width=1;canvas.height=1}
  }
  try{
    check(signal);let extracted=''
    if(/\.pdf$/i.test(file.name)){
      onProgress({message:'Reading PDF text locally…'})
      pdfTask=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false})
      const pdf=await pdfTask.promise;check(signal);pageCount=pdf.numPages
      if(pageCount<1||pageCount>12)throw new Error('Choose a PDF with 1–12 pages.')
      for(currentPage=1;currentPage<=pageCount;currentPage++){
        check(signal);onProgress({message:`Reading PDF page ${currentPage} of ${pageCount}…`})
        const page=await pdf.getPage(currentPage),content=await page.getTextContent(),viewport=page.getViewport({scale:1})
        const direct=pdfText(content,viewport)
        const readable=direct.replace(/[^\p{L}\p{N}]/gu,'').length>=80&&direct.split(/\s+/).length>=15&&(direct.match(/\uFFFD/g)||[]).length<Math.max(2,direct.length*.01)
        if(readable){extracted+=direct+'\n\n';textPages++}
        else{
          const scale=Math.min(2.2,5000/Math.max(viewport.width,viewport.height),Math.sqrt(8000000/(viewport.width*viewport.height))),rendered=page.getViewport({scale}),canvas=document.createElement('canvas')
          canvas.width=Math.ceil(rendered.width);canvas.height=Math.ceil(rendered.height)
          try{await page.render({canvasContext:canvas.getContext('2d'),viewport:rendered,background:'white'}).promise;check(signal);extracted+=await recognize(normalizeImage(canvas))+'\n\n'}finally{canvas.width=1;canvas.height=1}
        }
        page.cleanup()
        if(extracted.length>60000)throw new Error('This job file contains too much text. Import only the pages describing one role.')
      }
    }else extracted=await recognize(await imageCanvas(file))
    check(signal)
    if(extracted.trim().length<100)throw new Error('Not enough job text was readable. Use a sharper screenshot or copy and paste the job description.')
    if(extracted.length>60000)throw new Error('Too much text was found. Use a shorter job file.')
    return {text:extracted.trim(),method:ocrPages?textPages?'PDF text + local OCR':'Local OCR':'PDF text layer',warnings}
  }catch(error){if(signal?.aborted)throw new DOMException('File import canceled.','AbortError');if(error.name==='PasswordException')throw new Error('Choose an unlocked PDF.');throw error}
  finally{signal?.removeEventListener('abort',cancel);if(ocr)await ocr.terminate().catch(()=>{});if(pdfTask)await pdfTask.destroy().catch(()=>{})}
}
