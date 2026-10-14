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
export async function readAssistantResponse(response) {
  let data
  try {data=await response.json()} catch {
    const error=new Error('The backend returned an unreadable response. Check that /api is routed to the backend.')
    error.diagnostics={category:'backend_response',source:'browser',httpStatus:response.status,retryable:true,timestamp:new Date().toISOString()};throw error
  }
  if(!response.ok) {
    const error=new Error(data.message||`The backend returned HTTP ${response.status}.`)
    error.diagnostics=data.diagnostics||{category:[401,403].includes(response.status)?'session':'backend_error',source:'application',httpStatus:response.status,traceId:response.headers?.get?.('x-assistant-trace-id'),retryable:response.status>=500,timestamp:new Date().toISOString(),action:[401,403].includes(response.status)?'Sign in again, then retry.':'Check the backend connection and try again.'}
    throw error
  }
  return data
}
export const retryLabel = seconds => seconds>=60?`${Math.floor(seconds/60)}m ${seconds%60}s`:`${seconds}s`
export function diagnosticRetryWindows(report,now=Date.now()) {
  if(!report?.retryable||!(report.retryAfterSeconds>0))return {}
  const until=(Date.parse(report.timestamp)||now)+report.retryAfterSeconds*1000
  return {chatUntil:report.category==='test_limit'?undefined:until,testUntil:report.category==='app_limit'?undefined:until}
}
export function clientFailure(error) {
  if(error.diagnostics)return error
  if(error.name==='TypeError'&&/fetch|network|load failed/i.test(error.message)) {
    const failure=new Error('Could not reach the backend. Check the app server and your connection, then retry.')
    failure.diagnostics={category:'backend_network',source:'browser',retryable:true,timestamp:new Date().toISOString(),action:'Check that the backend is running and the /api proxy points to it.'};return failure
  }
  return error
}
export function diagnosticExport(status,result) {
  const keys=['category','source','model','providerStatus','httpStatus','code','type','parameter','stage','providerRequestId','traceId','networkCode','elapsedMs','totalElapsedMs','inputTokens','outputTokens','requestBytes','workspaceCharacters','screenCharacters','historyMessages','fileBytes','retryable','retryAfterSeconds','timestamp','kind']
  const scrub=value=>typeof value==='string'?value.replace(/\bsk-[a-zA-Z0-9_.*-]+/g,'[redacted key]').replace(/\bBearer\s+[^\s"',;]+/gi,'Bearer [redacted]'):value
  const diagnostics=Object.fromEntries(keys.filter(key=>result?.[key]!==undefined).map(key=>[key,scrub(result[key])]))
  const limits=status?.limits?Object.fromEntries(['used','limit','windowSeconds','resetAt','inProgress'].map(key=>[key,status.limits[key]])):undefined
  return {configured:!!status?.configured,model:scrub(status?.model),applicationLimits:limits,diagnostics}
}
