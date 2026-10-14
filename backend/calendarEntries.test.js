const test=require('node:test'),assert=require('node:assert/strict');
const {calendarEntry}=require('./calendarEntries');
test('personal date markers preserve inclusive dates and ignore injected ownership',()=>{
 const entry=calendarEntry({title:'  Reading week ',kind:'marker',allDay:false,startDate:'2026-10-12',endDate:'2026-10-16',user:'another-account',notes:'Plan',done:true});
 assert.equal(entry.title,'Reading week');assert.equal(entry.allDay,true);assert.equal(entry.endDate,'2026-10-16');assert.equal(entry.startAt,null);assert.equal(entry.user,undefined);assert.equal(entry.done,true);
});
test('timed appointments preserve UTC instants across midnight and validate ranges',()=>{
 const entry=calendarEntry({title:'Review',kind:'appointment',allDay:false,startAt:'2026-10-13T23:00:00-05:00',endAt:'2026-10-14T01:00:00-05:00'});
 assert.equal(entry.startAt.toISOString(),'2026-10-14T04:00:00.000Z');assert.equal(entry.endAt.toISOString(),'2026-10-14T06:00:00.000Z');
 for(const body of [{title:'',kind:'marker',allDay:true,startDate:'2026-01-01'},{title:'Bad',kind:'marker',allDay:true,startDate:'2026-02-30'},{title:'Bad',kind:'marker',allDay:true,startDate:'2026-10-20',endDate:'2026-10-10'},{title:'Bad',kind:'appointment',allDay:false,startAt:'2026-10-13T12:00',endAt:'2026-10-13T13:00'},{title:'Bad',kind:'appointment',allDay:false,startAt:'2026-02-30T12:00:00Z',endAt:'2026-03-01T13:00:00Z'},{title:'Bad',kind:'appointment',allDay:false,startAt:'2026-10-13T13:00:00Z',endAt:'2026-10-13T13:00:00Z'}])assert.throws(()=>calendarEntry(body));
});
