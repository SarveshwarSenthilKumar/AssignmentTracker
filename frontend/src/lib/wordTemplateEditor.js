import JSZip from 'jszip'

const WORD='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const XML='http://www.w3.org/XML/1998/namespace'

// Edit text in the uploaded package, leaving styles, section properties,
// relationships, headers, footers, images and other ZIP entries in place.
export async function openWordTemplate(bytes){
  const zip=await JSZip.loadAsync(bytes),entry=zip.file('word/document.xml')
  if(!entry)throw new Error('This Word document has no readable main document.')
  const xml=new DOMParser().parseFromString(await entry.async('string'),'application/xml')
  if(xml.getElementsByTagName('parsererror').length)throw new Error('The Word document XML could not be read.')
  const paragraphs=Array.from(xml.getElementsByTagNameNS(WORD,'p')).map(paragraph=>{
    const nodes=Array.from(paragraph.getElementsByTagNameNS(WORD,'t')).filter(node=>{
      let parent=node.parentElement
      while(parent&&parent!==paragraph){if(parent.namespaceURI===WORD&&parent.localName==='p')return false;parent=parent.parentElement}
      return true
    })
    return {nodes,text:nodes.map(node=>node.textContent).join('')}
  })
  return {
    text:paragraphs.map(paragraph=>paragraph.text).join('\n'),
    async serialize(value){
      const lines=value.replace(/\r\n?/g,'\n').split('\n')
      if(lines.length!==paragraphs.length)throw new Error('Keep the original paragraph breaks to retain Word formatting. Edit wording within each paragraph; add or remove paragraphs in Word.')
      const outputXml=xml.cloneNode(true),copies=new Map()
      const originalNodes=Array.from(xml.getElementsByTagNameNS(WORD,'t')),outputNodes=Array.from(outputXml.getElementsByTagNameNS(WORD,'t'))
      originalNodes.forEach((node,index)=>copies.set(node,outputNodes[index]))
      for(let index=0;index<paragraphs.length;index++){
        const {text}=paragraphs[index],nodes=paragraphs[index].nodes.map(node=>copies.get(node)),next=lines[index]
        if(text===next)continue
        if(!nodes.length)throw new Error('This empty paragraph has no original text style. Edit an existing paragraph to preserve formatting.')
        let start=0,end=text.length,nextEnd=next.length
        while(start<end&&start<nextEnd&&text[start]===next[start])start++
        while(end>start&&nextEnd>start&&text[end-1]===next[nextEnd-1]){end--;nextEnd--}
        let offset=0,inserted=false
        for(const node of nodes){
          const original=node.textContent,begin=offset,finish=offset+original.length
          offset=finish
          // Boundary insertions inherit the preceding text run's style.
          const touches=start===end?(!inserted&&start>=begin&&start<=finish):finish>start&&begin<end
          if(!touches)continue
          const prefix=original.slice(0,Math.max(0,start-begin))
          const suffix=original.slice(Math.max(0,end-begin))
          node.textContent=prefix+(!inserted?next.slice(start,nextEnd):'')+suffix
          node.setAttributeNS(XML,'xml:space','preserve');inserted=true
        }
        if(!inserted)throw new Error('Could not match this edit to its original Word text run.')
      }
      const outputZip=await JSZip.loadAsync(bytes)
      outputZip.file('word/document.xml',new XMLSerializer().serializeToString(outputXml))
      return outputZip.generateAsync({type:'blob',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',compression:'DEFLATE'})
    }
  }
}
