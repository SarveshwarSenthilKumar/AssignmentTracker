export function captureScreen(root = document) {
  const chunks=[], seen=new Set()
  const visible=element=>{
    if(element.closest('[data-assistant-ui],script,style,[hidden],[aria-hidden="true"]'))return false
    const rect=element.getBoundingClientRect(),style=getComputedStyle(element)
    return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<window.innerHeight&&rect.right>0&&rect.left<window.innerWidth&&style.visibility!=='hidden'&&style.display!=='none'
  }
  const add=text=>{text=text.trim().replace(/\s+/g,' ');if(text&&!seen.has(text)){seen.add(text);chunks.push(text)}}
  const walker=root.createTreeWalker(root.body,NodeFilter.SHOW_TEXT)
  while(walker.nextNode()) {
    const node=walker.currentNode,element=node.parentElement
    if(element&&visible(element))add(node.textContent)
    if(chunks.join('\n').length>=10000)break
  }
  for(const field of root.querySelectorAll('textarea,input:not([type]),input[type="text"],input[type="url"],input[type="email"],input[type="number"],input[type="time"],input[type="datetime-local"],input[type="date"],select')) {
    const label=field.labels?.[0]?.textContent||field.getAttribute('aria-label')||field.placeholder||field.name||'Field'
    if(!visible(field)||/password|token|secret|api.?key|credential/i.test(`${label} ${field.name} ${field.id}`))continue
    if(field.value)add(`${label}: ${field.tagName==='SELECT'?field.selectedOptions?.[0]?.textContent:field.value}`)
  }
  const selection=window.getSelection()?.toString().trim()
  if(selection&&!root.querySelector('[data-assistant-ui]')?.contains(window.getSelection()?.anchorNode))add(`Selected text: ${selection.slice(0,2000)}`)
  return chunks.join('\n').slice(0,12000)
}
export function answerParts(text,sources=[]) {
  const parts=[],pattern=/\[\[(task|calendar|document):([a-f\d]{24})\]\]/gi
  let offset=0
  for(const match of text.matchAll(pattern)) {
    if(match.index>offset)parts.push({text:text.slice(offset,match.index)})
    const source=sources.find(source=>source.type===match[1].toLowerCase()&&source.id===match[2].toLowerCase())
    if(source)parts.push({source})
    offset=match.index+match[0].length
  }
  if(offset<text.length)parts.push({text:text.slice(offset)})
  return parts
}
export function chatHistory(messages) {
  const history=[];let length=0
  for(const message of messages.filter(message=>!message.failed).slice(-19).reverse()) {
    const content=message.content.slice(0,4000)
    if(length+content.length>40000)break
    length+=content.length;history.unshift({role:message.role,content})
  }
  return history
}
