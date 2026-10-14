import test from 'node:test'
import assert from 'node:assert/strict'
import {answerParts,chatHistory} from './assistant.js'
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
