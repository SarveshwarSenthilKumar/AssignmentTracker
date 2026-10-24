import {existingTextRuns,makeSourceReplacement} from './pdfExistingText'
import {layoutCoverLetter} from './coverLetterPdfLayout'

export async function preparePdfCleanup({file,pdfjs,annotations,page,count,scope,signal}){
  if(!file)throw new Error('Wait for the PDF to finish loading.')
  if(scope==='document'&&count>20)throw new Error('Whole-document cleanup supports up to 20 pages. Clean up individual pages for longer files.')
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false})
  const sources=new Map(),existing=new Map(),texts=[],slots=[]
  let characters=0
  try{
    const pdf=await task.promise
    if(scope==='document'&&pdf.numPages>20)throw new Error('Whole-document cleanup supports up to 20 pages. Choose the current page for longer PDFs.')
    const pages=scope==='document'?Array.from({length:pdf.numPages},(_,index)=>index+1):[page]
    for(const number of pages){
      if(signal.aborted)throw new Error('Cleanup was canceled.')
      const sheet=await pdf.getPage(number),runs=await existingTextRuns(sheet,pdfjs,file)
      const replaced=new Set(annotations.filter(item=>(item.page||1)===number&&item.sourceText).map(item=>item.sourceText.key))
      for(const run of runs){
        if(replaced.has(run.key))continue
        const id=`source:${run.key}`,source={...run,page:number}
        sources.set(id,source);slots.push({id,text:run.text});texts.push({id,text:run.text,page:number})
      }
      for(const item of annotations.filter(item=>(item.page||1)===number&&item.tool==='text'&&item.text?.trim())){
        const id=`annotation:${item.id}`
        existing.set(id,item);texts.push({id,text:item.text,page:number})
      }
      characters=texts.reduce((sum,item)=>sum+item.text.length,0)
      if(texts.length>600||characters>40000)throw new Error('This selection is too large for cleanup. Choose the current page instead (up to 600 regions and 40,000 characters).')
    }
  }finally{await task.destroy()}
  if(!texts.length)throw new Error('No editable text was found. Cleanup supports PDF text and text annotations; handwritten ink and scanned pages are kept unchanged.')
  return {texts,sources,existing,slots}
}

export function cleanupAnnotations(snapshot,replacements,annotations){
  const result=[...annotations]
  const sourceChanges=replacements.filter(item=>snapshot.sources.has(item.id))
  const laidOut=layoutCoverLetter(snapshot.slots,sourceChanges,snapshot.sources)
  for(const change of laidOut){
    const run=snapshot.sources.get(change.id)
    result.push({...makeSourceReplacement(run,run.page,crypto.randomUUID()),text:change.text})
  }
  const context=document.createElement('canvas').getContext('2d')
  for(const change of replacements.filter(item=>snapshot.existing.has(item.id))){
    const original=snapshot.existing.get(change.id),index=result.findIndex(item=>item.id===original.id)
    if(index<0)throw new Error('The document changed. Prepare cleanup again.')
    const style=original.textStyle||{},size=original.fontSize||16
    context.font=`${style.embedded?'normal':style.italic?'italic':'normal'} ${style.embedded?400:style.fontWeight||400} ${size}px ${style.fontFamily||'Helvetica, Arial, sans-serif'}`
    const width=value=>(context.measureText(value).width+(style.letterSpacing||0)*Math.max(0,value.length-1))*(style.horizontalScale||1)
    const before=original.text.split('\n'),after=change.text.split('\n')
    if(after.length>before.length||after.some((line,n)=>width(line)>width(before[n]||'')+.5))throw new Error('A proposed annotation is too long at its original font size. Shorten it in the review or exclude it before applying.')
    result[index]={...original,text:change.text}
  }
  return result
}
