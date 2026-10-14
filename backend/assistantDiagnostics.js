const { randomUUID } = require('node:crypto');
const safeToken = value => typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_.:\[\]-]/g,'').slice(0,150)||null : null;
function safeMessage(value, secrets=[]) {
  let text=typeof value==='string'?value:'';
  for(const secret of secrets.filter(Boolean)) text=text.split(secret).join('[redacted]');
  return text.replace(/\bsk-[a-zA-Z0-9_.*-]+/g,'[redacted key]').replace(/\bBearer\s+[^\s"',;]+/gi,'Bearer [redacted]').replace(/\b(?:org|proj|project)-[a-zA-Z0-9_-]+/g,'[redacted project]').replace(/data:[^\s"']+/g,'[redacted file data]').slice(0,600);
}
function durationSeconds(value) {
  if(typeof value!=='string'||!value)return null;
  if(/^\d+(?:\.\d+)?$/.test(value))return Math.ceil(Number(value));
  const matches=[...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)];
  if(!matches.length||matches.map(match=>match[0]).join('')!==value)return null;
  return Math.ceil(matches.reduce((sum,match)=>sum+Number(match[1])*({ms:.001,s:1,m:60,h:3600}[match[2]]),0));
}
function retrySeconds(headers,now=Date.now()) {
  const raw=headers?.get?.('retry-after');
  if(raw){const seconds=durationSeconds(raw);if(seconds!==null)return Math.max(0,seconds);const date=Date.parse(raw);if(Number.isFinite(date))return Math.max(0,Math.ceil((date-now)/1000));}
  const waits=['requests','tokens','project-tokens'].filter(key=>headers?.get?.(`x-ratelimit-remaining-${key}`)==='0').map(key=>durationSeconds(headers.get(`x-ratelimit-reset-${key}`))).filter(value=>value!==null);
  return waits.length?Math.max(...waits):null;
}
const quotaActions={
  credit_balance_exhausted:['OpenAI API credits are exhausted.','Add API credits in the OpenAI billing settings for the organization that owns this key. Retrying will not restore credits.'],
  project_spend_limit_exceeded:['The OpenAI project spend limit was reached.','Review the project’s API spend limit or wait for its billing period to reset.'],
  organization_spend_limit_exceeded:['The OpenAI organization spend limit was reached.','Review the organization’s API spend limit or wait for its billing period to reset.'],
  organization_usage_limit_exceeded:['The OpenAI organization usage limit was reached.','Review the approved usage limit in OpenAI settings or contact OpenAI support.'],
  insufficient_quota:['OpenAI API quota or billing is unavailable.','Check API billing, remaining credits, and the project or organization limits. Retrying alone will not fix this.'],
  billing_hard_limit_reached:['The OpenAI API billing limit was reached.','Review the API billing limit and remaining credits before retrying.'],
};
function diagnostic(category,message,action,extra={}) {
  return {category,message,action,source:'application',retryable:false,retryAfterSeconds:null,traceId:randomUUID(),timestamp:new Date().toISOString(),...extra};
}
function providerDiagnostic(status,data,headers,extra={},secrets=[]) {
  const error=data?.error||{},code=safeToken(safeMessage(error.code,secrets)),type=safeToken(safeMessage(error.type,secrets)),reason=safeMessage(error.message,secrets);
  const common={source:'openai',providerStatus:status,code,type,parameter:safeToken(safeMessage(error.param,secrets)),providerMessage:reason,providerRequestId:safeToken(safeMessage(headers?.get?.('x-request-id'),secrets)),rateLimits:Object.fromEntries(['limit-requests','remaining-requests','reset-requests','limit-tokens','remaining-tokens','reset-tokens','limit-project-tokens','remaining-project-tokens','reset-project-tokens'].map(key=>[key,safeToken(headers?.get?.(`x-ratelimit-${key}`))]).filter(([,value])=>value!==null)),...extra};
  if(quotaActions[code] || type==='insufficient_quota') {
    const [message,action]=quotaActions[code]||quotaActions.insufficient_quota;
    return diagnostic('quota',message,action,{...common,actionUrl:'https://platform.openai.com/settings/organization/billing/overview'});
  }
  if(code==='context_length_exceeded'||/request too large|maximum context length|context length exceeded/i.test(reason))return diagnostic('context_too_large','The AI request contains too much context.','Start a new chat or turn off open-file/workspace context, then resend a smaller request.',common);
  if(status===429)return diagnostic('rate_limit','OpenAI temporarily rate-limited this request.','Wait for the retry timer, then send again. Large files and long workspace context can use the token limit quickly.',{...common,retryable:true,retryAfterSeconds:retrySeconds(headers)??30});
  if(status===401)return diagnostic('authentication','OpenAI rejected the API key.','Check OPENAI_API_KEY on the backend and restart the backend after changing it. Verify that the key is active.',common);
  if(code==='model_not_found'||status===404)return diagnostic('model_access','The configured AI model is unavailable for this API key.','Check OPENAI_MODEL on the backend and the key’s access to that model.',common);
  if(status===403)return diagnostic('permission','OpenAI denied access to this request.','Check the key’s permissions, project settings, and any region or network restrictions. See the provider reason below.',common);
  if(status>=500)return diagnostic('provider_unavailable','The OpenAI service could not process this request.','Wait briefly, then retry. Check OpenAI’s service status if the failure continues.',{...common,retryable:true,retryAfterSeconds:retrySeconds(headers)??15,actionUrl:'https://status.openai.com/'});
  return diagnostic('invalid_request','OpenAI rejected the request format or an included file.','Review the provider code, parameter and reason below. Try turning off open-file context, or check the configured model’s supported inputs.',common);
}
class AssistantAPIError extends Error {
  constructor(diagnostics,status=502){super(diagnostics.message);this.diagnostics=diagnostics;this.status=status;}
}
async function callAssistantAPI(payload,{apiKey,signal,fetcher=fetch,traceId=randomUUID(),metadata={}}={}) {
  const started=Date.now(),base={traceId,model:safeMessage(payload.model,[apiKey]),stage:'openai',...metadata};
  let response;
  try {
    response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey.trim()}`,'Content-Type':'application/json','X-Client-Request-Id':traceId},body:JSON.stringify(payload),signal});
  } catch(error) {
    const stopped=signal?.aborted;
    throw new AssistantAPIError(diagnostic(stopped?'timeout':'network',stopped?'The AI request timed out or was stopped.':'The backend could not reach OpenAI.',stopped?'Retry the question, or reduce the included context if it takes too long.':'Check the backend’s internet access, DNS, proxy, and TLS connection.',{...base,source:'network',retryable:true,elapsedMs:Date.now()-started,networkCode:safeToken(error.cause?.code||error.code)}));
  }
  let data;
  try {data=await response.json();} catch {
    if(!response.ok)throw new AssistantAPIError(providerDiagnostic(response.status,null,response.headers,{...base,elapsedMs:Date.now()-started},[apiKey]));
    throw new AssistantAPIError(diagnostic('invalid_response','OpenAI returned an unreadable response.','Try again. If this continues, check the backend connection and configured model.',{...base,source:'openai',providerStatus:response.status,providerRequestId:safeToken(response.headers?.get?.('x-request-id')),elapsedMs:Date.now()-started,retryable:true}));
  }
  if(!response.ok||data.error||data.status==='failed')throw new AssistantAPIError(providerDiagnostic(response.status,data,response.headers,{...base,elapsedMs:Date.now()-started},[apiKey]));
  return {data,diagnostics:diagnostic('success','OpenAI connection succeeded.','',{...base,source:'openai',providerStatus:response.status,providerRequestId:safeToken(response.headers?.get?.('x-request-id')),elapsedMs:Date.now()-started,inputTokens:data.usage?.input_tokens??null,outputTokens:data.usage?.output_tokens??null})};
}
module.exports={diagnostic,providerDiagnostic,callAssistantAPI,AssistantAPIError,safeMessage,retrySeconds,durationSeconds};
