import test from 'node:test'
import assert from 'node:assert/strict'
import { calendarItems,calendarDay,monthDays,shiftMonth,itemsOnDay,itemsInMonth,entryDraft,entryPayload } from './calendar.js'
process.env.TZ='America/Chicago'
test('month grids start on Monday and handle leap years and year changes',()=>{
 const days=monthDays('2028-02-10');assert.equal(days.length,42);assert.equal(new Date(`${days[0]}T12:00:00Z`).getUTCDay(),1);assert.ok(days.includes('2028-02-29'));
 assert.equal(shiftMonth('2026-12-31',1),'2027-01-01');assert.equal(shiftMonth('2026-01-31',-1),'2025-12-01');
});
test('tasks map once with live completion, local deadlines and authoritative all-day Canvas dates',()=>{
 const tasks=[{_id:'a',text:'Due',dueDate:'2026-10-14T01:00:00Z',status:'completed'},{_id:'b',text:'Undated'},{_id:'c',text:'Canvas day',dueDate:'2026-11-01T05:00:00Z',calendarEndDate:'2026-11-02T06:00:00Z',calendarAllDay:true,calendarDate:'2026-11-01',calendarLastDate:'2026-11-01',canvasType:'calendar_event'}];
 const items=calendarItems(tasks,[]);assert.equal(items.length,2);assert.equal(items[0].startDate,'2026-10-13');assert.equal(items[0].done,true);assert.equal(items[1].source,'canvas');assert.equal(items[1].endDate,'2026-11-01');assert.equal(calendarDay(null),null);
 assert.equal(itemsOnDay(items,'2026-11-02').length,0);
});
test('personal ranges span months while midnight end times exclude the following day',()=>{
 const entries=[{_id:'m',title:'Break',kind:'marker',allDay:true,startDate:'2026-10-30',endDate:'2026-11-02'},{_id:'a',title:'Evening',kind:'appointment',allDay:false,startAt:'2026-10-14T03:00:00Z',endAt:'2026-10-14T05:00:00Z'}];
 const items=calendarItems([],entries);assert.equal(itemsOnDay(items,'2026-10-13').length,1);assert.equal(itemsOnDay(items,'2026-10-14').length,0);assert.equal(itemsInMonth(items,'2026-11-01').length,1);assert.equal(itemsOnDay(items,'2026-11-02').length,1);
});
test('appointment forms convert local times to UTC and preserve date-only markers',()=>{
 const draft=entryDraft('2026-10-13');assert.equal(entryPayload({...draft,title:'Meeting'}).startAt,'2026-10-13T14:00:00.000Z');
 const marker=entryPayload({...entryDraft('2026-10-13','marker'),title:'Important day'});assert.equal(marker.startDate,'2026-10-13');assert.equal(marker.allDay,true);assert.equal(marker.startAt,undefined);
 const linked=entryPayload({...draft,title:'Review',done:true,taskIds:['111111111111111111111111'],documentIds:['222222222222222222222222']});assert.deepEqual(linked.taskIds,['111111111111111111111111']);assert.deepEqual(linked.documentIds,['222222222222222222222222']);assert.equal(linked.done,true);
 assert.throws(()=>entryPayload({...draft,title:'Meeting',endLocal:draft.startLocal}));
 assert.throws(()=>entryPayload({...draft,title:''}));
 assert.throws(()=>entryPayload({...entryDraft('2026-10-13','marker'),title:'Marker',endDate:'2026-10-12'}));
 assert.throws(()=>entryPayload({...draft,title:'Clock change',startLocal:'2026-03-08T02:30',endLocal:'2026-03-08T04:00'}));
 const edit=entryDraft('2026-10-13','marker',{title:'Break',kind:'marker',allDay:true,startDate:'2026-10-13',endDate:'2026-10-14',startAt:null,endAt:null});assert.equal(edit.startLocal,'2026-10-13T09:00');
 const late=entryDraft('2026-10-13','appointment',{title:'Evening',kind:'appointment',allDay:false,startDate:'2026-10-14',endDate:'2026-10-14',startAt:'2026-10-14T03:00:00Z',endAt:'2026-10-14T05:00:00Z'});assert.equal(entryPayload({...late,allDay:true}).startDate,'2026-10-13');assert.equal(late.endDate,'2026-10-13');
});
