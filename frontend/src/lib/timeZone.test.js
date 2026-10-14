import test from 'node:test'
import assert from 'node:assert/strict'
import {setTimeZone,activeTimeZone,zonedLocal,localToInstant} from './timeZone.js'
import {calendarDay,entryDraft,entryPayload,taskDueLabel} from './calendar.js'
test('account zone changes displayed days and input conversion without moving stored instants',()=>{
  setTimeZone('Asia/Tokyo')
  assert.equal(activeTimeZone(),'Asia/Tokyo')
  assert.equal(calendarDay('2026-10-14T01:00:00Z'),'2026-10-14')
  assert.equal(zonedLocal('2026-10-14T01:00:00Z'),'2026-10-14T10:00')
  assert.equal(localToInstant('2026-10-14T10:00'),'2026-10-14T01:00:00.000Z')
  assert.equal(entryPayload({...entryDraft('2026-10-14'),title:'Meeting'}).startAt,'2026-10-14T00:00:00.000Z')
  assert.match(taskDueLabel({calendarAllDay:true,calendarDate:'2026-10-13'}),/13/)
  setTimeZone('America/New_York')
  assert.equal(calendarDay('2026-10-14T01:00:00Z'),'2026-10-13')
  assert.throws(()=>localToInstant('2026-03-08T02:30'))
  assert.equal(localToInstant('2026-11-01T01:30'),'2026-11-01T05:30:00.000Z')
  setTimeZone('')
})
