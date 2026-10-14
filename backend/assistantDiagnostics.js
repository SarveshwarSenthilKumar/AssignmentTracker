const { randomUUID } = require('node:crypto');
const safeToken = value => typeof value === 'string' ? value.replace(/[^a-zA-Z0-9_.:\[\]-]/g,'').slice(0,150)||null : null;
function safeMessage(value, secrets=[]) {
  let text=typeof value==='string'?value:'';
  for(const secret of secrets.filter(Boolean)) text=text.split(secret).join('[redacted]');
  return text.replace(/\bAIza[a-zA-Z0-9_-]+/g,'[redacted key]').replace(/([?&]key=)[^&\s]+/gi,'$1[redacted]').replace(/\bsk-[a-zA-Z0-9_.*-]+/g,'[redacted key]').replace(/\bBearer\s+[^\s"',;]+/gi,'Bearer [redacted]').replace(/\b(?:org|proj|project)-[a-zA-Z0-9_-]+/g,'[redacted project]').replace(/data:[^\s"']+/g,'[redacted file data]').slice(0,600);
}
function durationSeconds(value) {
  if(typeof value!=='string'||!value)return null;
  if(/^\d+(?:\.\d+)?$/.test(value))return Math.ceil(Number(value));
  const matches=[...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)];
  if(!matches.length||matches.map(match=>match[0]).join('')!==value)return null;
  return Math.ceil(matches.reduce((sum,match)=>sum+Number(match[1])*({ms:.001,s:1,m:60,h:3600}[match[2]]),0));
}
function retrySeconds(headers,now=Date.now(),data={}) {
  const raw=headers?.get?.('retry-after');
  if(raw){const seconds=durationSeconds(raw);if(seconds!==null)return Math.max(0,seconds);const date=Date.parse(raw);if(Number.isFinite(date))return Math.max(0,Math.ceil((date-now)/1000));}
  const retry=(data?.error?.details||[]).find(item=>item['@type']?.endsWith('RetryInfo'));
  return durationSeconds(retry?.retryDelay);
}
function diagnostic(category,message,action,extra={}) {
  return {category,message,action,source:'application',retryable:false,retryAfterSeconds:null,traceId:randomUUID(),timestamp:new Date().toISOString(),...extra};
}
function providerDiagnostic(status,data,headers,extra={},secrets=[]) {
  const error=data?.error||{},details=Array.isArray(error.details)?error.details:[];
  const info=details.find(item=>item['@type']?.endsWith('ErrorInfo'));
  const code=safeToken(safeMessage(info?.reason||error.status||String(error.code||''),secrets)),type=safeToken(error.status),reason=safeMessage(error.message,secrets);
  const quotaDetails=details.filter(item=>item['@type']?.endsWith('QuotaFailure')).flatMap(item=>item.violations||[]).slice(0,10).map(item=>({metric:safeMessage(item.quotaMetric,secrets),id:safeMessage(item.quotaId,secrets),value:safeMessage(String(item.quotaValue??''),secrets)}));
  const common={source:'gemini',providerStatus:status,code,type,providerMessage:reason,providerRequestId:safeToken(headers?.get?.('x-goog-request-id')||headers?.get?.('x-request-id')||data?.responseId),quotaDetails,...extra};
  const wait=retrySeconds(headers,Date.now(),data),quotaText=[code,reason,...quotaDetails.flatMap(item=>[item.metric,item.id])].join(' ');
  if(status===401||/API_KEY_INVALID|API_KEY_EXPIRED|API key not valid|invalid api key/i.test(quotaText))return diagnostic('authentication','Gemini rejected the API key.','Check GEMINI_API_KEY on the backend and restart it. Use an active Google AI Studio API key.',{...common,actionUrl:'https://aistudio.google.com/apikey'});
  if(status===404)return diagnostic('model_access','The configured Gemini model is unavailable.','Check GEMINI_MODEL and the model’s availability for this key and API version.',{...common,actionUrl:'https://ai.google.dev/gemini-api/docs/models'});
  if(status===403)return diagnostic('permission','Google denied access to Gemini.','Check the key’s API restrictions, project permissions, billing and regional availability. Review the provider reason.',common);
  if(status===429||type==='RESOURCE_EXHAUSTED') {
    const daily=/per.?day|daily|billing|quota_exceeded/i.test(quotaText)||quotaDetails.some(item=>item.value==='0')||/limit:\s*0\b/i.test(reason);
    if(!daily&&(wait!==null||/per.?minute|rate_limit_exceeded/i.test(quotaText)))return diagnostic('rate_limit','Gemini temporarily rate-limited this request.','Wait for the retry timer, then send again. Large files and workspace context consume token limits.',{...common,retryable:true,retryAfterSeconds:wait??60,actionUrl:'https://ai.google.dev/gemini-api/docs/rate-limits'});
    return diagnostic('quota','The Gemini project or model quota is exhausted or unavailable.','Review Google AI Studio usage, billing and model limits. Daily or zero quotas need a reset or configuration change; repeated retries will not resolve them.',{...common,actionUrl:'https://aistudio.google.com/usage'});
  }
  if(/context length|token count.*exceed|too many tokens|request too large|payload.*large/i.test(reason)||status===413)return diagnostic('context_too_large','The Gemini request contains too much context.','Start a new chat or turn off open-file/workspace context, then resend a smaller request.',common);
  if(status>=500)return diagnostic('provider_unavailable','Gemini could not process this request.','Wait briefly and retry. Review Gemini troubleshooting if failures continue.',{...common,retryable:true,retryAfterSeconds:wait??15,actionUrl:'https://ai.google.dev/gemini-api/docs/troubleshooting'});
  return diagnostic('invalid_request','Gemini rejected the request or an included file.','Review the provider reason. Try turning off open-file context and check the model’s supported inputs.',common);
}
class AssistantAPIError extends Error {
  constructor(diagnostics,status=502){super(diagnostics.message);this.diagnostics=diagnostics;this.status=status;}
}
async function callAssistantAPI(payload,{apiKey,signal,fetcher=fetch,traceId=randomUUID(),metadata={}}={}) {
  const {model,...body}=payload,started=Date.now(),base={traceId,model:safeMessage(model,[apiKey]),stage:'gemini',...metadata};
  let response;
  try {
    response=await fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//,''))}:generateContent`,{method:'POST',headers:{'x-goog-api-key':apiKey.trim(),'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  } catch(error) {
    const stopped=signal?.aborted;
    throw new AssistantAPIError(diagnostic(stopped?'timeout':'network',stopped?'The AI request timed out or was stopped.':'The backend could not reach Gemini.',stopped?'Retry the question, or reduce the included context.':'Check the backend’s internet access, DNS, proxy and TLS connection.',{...base,source:'network',retryable:true,elapsedMs:Date.now()-started,networkCode:safeToken(error.cause?.code||error.code)}));
  }
  let data;
  try {data=await response.json();} catch {
    if(!response.ok)throw new AssistantAPIError(providerDiagnostic(response.status,null,response.headers,{...base,elapsedMs:Date.now()-started},[apiKey]));
    throw new AssistantAPIError(diagnostic('invalid_response','Gemini returned an unreadable response.','Try again and check the backend connection if this continues.',{...base,source:'gemini',providerStatus:response.status,elapsedMs:Date.now()-started,retryable:true}));
  }
  if(!response.ok||data.error)throw new AssistantAPIError(providerDiagnostic(response.status,data,response.headers,{...base,elapsedMs:Date.now()-started},[apiKey]));
  const report={...base,source:'gemini',providerStatus:response.status,providerRequestId:safeToken(data.responseId||response.headers?.get?.('x-goog-request-id')||response.headers?.get?.('x-request-id')),elapsedMs:Date.now()-started,inputTokens:data.usageMetadata?.promptTokenCount??null,outputTokens:data.usageMetadata?.candidatesTokenCount??null,thoughtTokens:data.usageMetadata?.thoughtsTokenCount??null};
  if(data.promptFeedback?.blockReason||['SAFETY','RECITATION','BLOCKLIST','PROHIBITED_CONTENT','SPII','IMAGE_SAFETY'].includes(data.candidates?.[0]?.finishReason))throw new AssistantAPIError(diagnostic('blocked','Gemini could not answer this request.','Try rephrasing the question or removing the included file.',{...report,code:safeToken(data.promptFeedback?.blockReason||data.candidates[0].finishReason)}));
  return {data,diagnostics:diagnostic('success','Gemini connection succeeded.','',report)};
}
module.exports={diagnostic,providerDiagnostic,callAssistantAPI,AssistantAPIError,safeMessage,retrySeconds,durationSeconds};
