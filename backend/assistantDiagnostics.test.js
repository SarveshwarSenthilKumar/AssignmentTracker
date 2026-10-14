const test=require('node:test');
const assert=require('node:assert/strict');
const {providerDiagnostic,callAssistantAPI,AssistantAPIError,safeMessage,retrySeconds,durationSeconds}=require('./assistantDiagnostics');
const headers=values=>({get:key=>values[key]??null});
test('exhausted API credits are not temporary rate limits and never recommend timed retries',()=>{
 const report=providerDiagnostic(429,{error:{code:'credit_balance_exhausted',type:'insufficient_quota',message:'No credits remaining.'}},headers({'retry-after':'60','x-request-id':'req_test'}));
 assert.equal(report.category,'quota');assert.equal(report.code,'credit_balance_exhausted');assert.equal(report.retryable,false);assert.equal(report.retryAfterSeconds,null);assert.match(report.message,/credits are exhausted/);assert.equal(report.providerRequestId,'req_test');
 const project=providerDiagnostic(429,{error:{code:'project_spend_limit_exceeded',type:'insufficient_quota'}},headers({}));assert.match(project.message,/project spend limit/);
 const generic=providerDiagnostic(429,{error:{type:'insufficient_quota'}},headers({}));assert.equal(generic.category,'quota');
});
test('actual throttling and overload honor retry headers and token reset durations',()=>{
 const report=providerDiagnostic(429,{error:{code:'slow_down',type:'rate_limit_error'}},headers({'retry-after':'45'}));assert.equal(report.category,'rate_limit');assert.equal(report.retryAfterSeconds,45);assert.equal(report.retryable,true);
 assert.equal(durationSeconds('1m500ms'),61);assert.equal(durationSeconds('bad'),null);
 assert.equal(retrySeconds(headers({'x-ratelimit-remaining-tokens':'0','x-ratelimit-reset-tokens':'6m0s'})),360);
 const now=Date.parse('2026-10-14T12:00:00Z');assert.equal(retrySeconds(headers({'retry-after':'Wed, 14 Oct 2026 12:00:30 GMT'}),now),30);
 assert.equal(providerDiagnostic(503,{error:{code:'server_is_overloaded'}},headers({'retry-after':'10'})).retryAfterSeconds,10);
});
test('oversized context, authentication, permissions and model access get distinct recovery actions',()=>{
 assert.equal(providerDiagnostic(429,{error:{code:'rate_limit_exceeded',message:'Request too large for the tokens per minute limit.'}},headers({})).category,'context_too_large');
 assert.equal(providerDiagnostic(401,{error:{code:'invalid_api_key'}},headers({})).category,'authentication');
 assert.equal(providerDiagnostic(403,{error:{code:'permission_denied'}},headers({})).category,'permission');
 assert.equal(providerDiagnostic(404,{error:{code:'model_not_found'}},headers({})).category,'model_access');
 assert.equal(providerDiagnostic(400,{error:{code:'invalid_value',param:'input[0].content'}},headers({})).category,'invalid_request');
});
test('provider messages and metadata redact keys, authorization and project identifiers',()=>{
 const key='sk-proj-secret_api_key';
 const report=providerDiagnostic(401,{error:{code:'invalid_api_key',message:`Incorrect key: ${key} Bearer private-token org-private-id`}},headers({}),{},[key]);
 const text=JSON.stringify(report);assert.ok(!text.includes(key));assert.ok(!text.includes('private-token'));assert.ok(!text.includes('org-private-id'));
 assert.ok(!safeMessage('sk-proj-abcd***wxyz').includes('abcd'));
});
test('API transport exposes safe diagnostics, request IDs and codes instead of generic busy errors',async()=>{
 const key='sk-proj-secret_key';
 await assert.rejects(callAssistantAPI({model:'gpt-4.1-mini',input:'Reply OK',store:false},{apiKey:key,traceId:'trace-test',fetcher:async(url,options)=>{
   assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers['X-Client-Request-Id'],'trace-test');assert.equal(options.headers.Authorization,`Bearer ${key}`);
   return {ok:false,status:429,headers:headers({'x-request-id':'req_provider'}),json:async()=>({error:{code:'credit_balance_exhausted',type:'insufficient_quota'}})};
 }}),error=>error instanceof AssistantAPIError&&error.diagnostics.category==='quota'&&error.diagnostics.providerRequestId==='req_provider'&&error.diagnostics.traceId==='trace-test'&&!JSON.stringify(error.diagnostics).includes(key));
 const success=await callAssistantAPI({model:'gpt-4.1-mini'},{apiKey:key,fetcher:async()=>({ok:true,status:200,headers:headers({}),json:async()=>({status:'completed',usage:{input_tokens:8,output_tokens:1}})})});assert.equal(success.diagnostics.inputTokens,8);assert.equal(success.diagnostics.category,'success');
});
test('network, timeout and malformed provider responses keep distinct diagnostic categories',async()=>{
 const settings={apiKey:'secret',fetcher:async()=>{const error=new Error('Connection failed');error.cause={code:'ENOTFOUND'};throw error}};
 await assert.rejects(callAssistantAPI({model:'test'},settings),error=>error.diagnostics.category==='network'&&error.diagnostics.networkCode==='ENOTFOUND');
 const controller=new AbortController();controller.abort();await assert.rejects(callAssistantAPI({model:'test'},{...settings,signal:controller.signal}),error=>error.diagnostics.category==='timeout');
 await assert.rejects(callAssistantAPI({model:'test'},{apiKey:'secret',fetcher:async()=>({ok:true,status:200,headers:headers({}),json:async()=>{throw new Error('invalid JSON')}})}),error=>error.diagnostics.category==='invalid_response');
 await assert.rejects(callAssistantAPI({model:'test'},{apiKey:'secret',fetcher:async()=>({ok:true,status:200,headers:headers({}),json:async()=>({status:'failed',error:{code:'insufficient_quota'}})})}),error=>error.diagnostics.category==='quota');
});
