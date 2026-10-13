import test from 'node:test'
import assert from 'node:assert/strict'
import {SHORTCUTS, matchesShortcut, isTyping} from './shortcuts.js'
const event=(key,options={})=>({key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,...options})
test('platform and editor shortcuts distinguish modifiers and preserve typing shortcuts',()=>{
 const save=SHORTCUTS.find(item=>item.id==='save'),download=SHORTCUTS.find(item=>item.id==='download')
 assert.ok(matchesShortcut(event('s',{ctrlKey:true}),save));assert.ok(matchesShortcut(event('S',{metaKey:true}),save));assert.ok(!matchesShortcut(event('s'),save));assert.ok(!matchesShortcut(event('s',{ctrlKey:true,shiftKey:true}),save));assert.ok(matchesShortcut(event('s',{metaKey:true,shiftKey:true}),download))
 assert.ok(matchesShortcut(event('¡',{altKey:true,code:'Digit1'}),SHORTCUTS.find(item=>item.id==='nav-tasks')))
 assert.ok(matchesShortcut(event('?',{shiftKey:true}),SHORTCUTS.find(item=>item.id==='help')))
 assert.ok(isTyping({closest:()=>({tagName:'INPUT'})}));assert.equal(isTyping({closest:()=>null}),false)
})
test('shortcut ids and chords remain unique within their context',()=>{
 assert.equal(new Set(SHORTCUTS.map(item=>item.id)).size,SHORTCUTS.length)
 const signatures=SHORTCUTS.map(item=>`${item.scope}:${item.key}:${!!item.mod}:${!!item.shift}:${!!item.alt}`)
 assert.equal(new Set(signatures).size,signatures.length)
 assert.ok(!SHORTCUTS.some(item=>item.key==='Tab'))
})
