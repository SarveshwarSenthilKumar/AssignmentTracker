import test from 'node:test'
import assert from 'node:assert/strict'
import {answerParts,chatHistory,readAssistantResponse,diagnosticRetryWindows,clientFailure,diagnosticExport} from './assistant.js'
import {SHORTCUTS,matchesShortcut} from './shortcuts.js'
test('AI citations become links only for returned sources and arbitrary HTML remains plain text',()=>{
  const id='111111111111111111111111',source={type:'task',id,title:'Essay'}
  const parts=answerParts(`<script>bad()</script> [[task:${id}]] [[document:222222222222222222222222]]`,[source])
  assert.equal(parts[0].text,'<script>bad()</script> ');assert.deepEqual(parts[1].source,source);assert.ok(!parts.some(part=>part.source?.type==='document'))
})
test('assistant shortcut works while typing and handles alternate keyboard layouts',()=>{
  const shortcut=SHORTCUTS.find(shortcut=>shortcut.id==='assistant-toggle')
  assert.equal(shortcut.typing,true)
  assert.equal(matchesShortcut({key:'j',code:'KeyJ',altKey:true},shortcut),true)
  assert.equal(matchesShortcut({key:'∆',code:'KeyJ',altKey:true},shortcut),true)
  assert.equal(matchesShortcut({key:'j',altKey:true,ctrlKey:true},shortcut),false)
})
test('long chats send bounded history and exclude failed questions',()=>{
 const messages=Array.from({length:31},(_,index)=>({role:index%2?'assistant':'user',content:'x'.repeat(5000)}))
 const history=chatHistory(messages);assert.equal(history.length,10);assert.equal(history.at(-1).role,'user');assert.equal(history.reduce((total,item)=>total+item.content.length,0),40000)
 assert.deepEqual(chatHistory([{role:'user',content:'Failed',failed:true},{role:'user',content:'Retry'}]),[{role:'user',content:'Retry'}])
})
test('API failures preserve detailed provider diagnostics and classify unreadable backend responses',async()=>{
 const report={category:'quota',code:'credit_balance_exhausted',retryable:false}
 await assert.rejects(readAssistantResponse({ok:false,status:502,json:async()=>({message:'Credits exhausted.',diagnostics:report})}),error=>error.message==='Credits exhausted.'&&error.diagnostics===report)
 await assert.rejects(readAssistantResponse({ok:true,status:200,json:async()=>{throw new Error('HTML')}}),error=>error.diagnostics.category==='backend_response')
 await assert.rejects(readAssistantResponse({ok:false,status:403,json:async()=>({message:'Expired session'})}),error=>error.diagnostics.category==='session')
 assert.equal(clientFailure(new TypeError('Failed to fetch')).diagnostics.category,'backend_network')
})
test('cooldowns respect the original provider timestamp and keep test/chat limits separate',()=>{
 const timestamp='2026-10-14T12:00:00Z',now=Date.parse(timestamp)
 assert.deepEqual(diagnosticRetryWindows({category:'quota',retryable:false,retryAfterSeconds:60,timestamp},now),{})
 assert.equal(diagnosticRetryWindows({category:'rate_limit',retryable:true,retryAfterSeconds:60,timestamp},now+30000).chatUntil,now+60000)
 assert.equal(diagnosticRetryWindows({category:'app_limit',retryable:true,retryAfterSeconds:60,timestamp},now).testUntil,undefined)
 assert.equal(diagnosticRetryWindows({category:'test_limit',retryable:true,retryAfterSeconds:60,timestamp},now).chatUntil,undefined)
})
test('copyable diagnostics whitelist support fields and omit key, prompt and provider message bodies',()=>{
 const output=diagnosticExport({configured:true,model:'gpt-4.1-mini',apiKey:'secret',limits:{used:1,limit:20,unknown:'private'}},{category:'quota',code:'credit_balance_exhausted',providerRequestId:'req_test',providerMessage:'private-reason',requestBody:'private-prompt',apiKey:'private-key',model:'sk-proj-hidden'})
 const text=JSON.stringify(output);for(const privateValue of ['private-reason','private-prompt','private-key','sk-proj-hidden','private'])assert.ok(!text.includes(privateValue));assert.equal(output.diagnostics.providerRequestId,'req_test');assert.equal(output.diagnostics.code,'credit_balance_exhausted')
})
