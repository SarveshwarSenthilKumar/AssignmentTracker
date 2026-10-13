import test from 'node:test'
import assert from 'node:assert/strict'
import { moveInsert, resizeFromCorner } from './insertGeometry.js'
const item = {x:100,y:100}, size = {width:200,height:100}, page = {w:600,h:800}
test('move preserves grab offset and clamps all sides', () => {
  assert.deepEqual(moveInsert(item,size,{x:250,y:230},{x:20,y:30},page),{x:230,y:200})
  assert.deepEqual(moveInsert(item,size,{x:900,y:900},{x:20,y:30},page),{x:400,y:700})
  assert.deepEqual(moveInsert(item,size,{x:-100,y:-100},{x:20,y:30},page),{x:0,y:0})
})
test('every resize corner preserves aspect ratio and opposite anchor', () => {
  for (const [corner,point,expected] of [['se',{x:500,y:300},{x:100,y:100}],['nw',{x:-100,y:0},{x:0,y:50}],['ne',{x:500,y:0},{x:100,y:0}],['sw',{x:-100,y:300},{x:0,y:100}]]) {
    const result = resizeFromCorner(item,size,point,corner,page)
    assert.equal(result.width/result.height,2)
    assert.equal(result.x,expected.x); assert.equal(result.y,expected.y)
    assert.ok(result.x>=0 && result.y>=0 && result.x+result.width<=page.w && result.y+result.height<=page.h)
  }
})
test('crossing the anchor cannot invert or collapse an insert', () => {
  const result = resizeFromCorner(item,size,{x:0,y:0},'se',page)
  assert.ok(result.width>=12 && result.height>=12)
  assert.equal(result.x,100); assert.equal(result.y,100)
})
test('text resizing respects font bounds and page bounds', () => {
  assert.equal(resizeFromCorner(item,size,{x:1000,y:1000},'se',page,{min:.5,max:1.5}).ratio,1.5)
  assert.equal(resizeFromCorner(item,size,{x:0,y:0},'se',page,{min:.5,max:1.5}).ratio,.5)
})
