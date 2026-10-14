const test=require('node:test'),assert=require('node:assert/strict');
const {canvasIdentity,canvasTaskFields}=require('./canvasTasks');
test('Canvas identities distinguish assignments and events with the same id; sync preserves local task state',()=>{
 const item={id:42,name:'Updated assignment',due_at:'2026-10-20T18:00:00Z'};
 assert.notDeepEqual(canvasIdentity('owner',item,'assignment'),canvasIdentity('owner',item,'calendar_event'));
 assert.equal(canvasIdentity('owner',item,'assignment').user,'owner');
 const task={status:'completed',description:'My notes',dependsOn:['prerequisite'],folder:'f'};
 Object.assign(task,canvasTaskFields(item,'assignment','CS101'));assert.equal(task.calendarContext,'CS101');
 assert.equal(task.status,'completed');assert.equal(task.description,'My notes');assert.deepEqual(task.dependsOn,['prerequisite']);assert.equal(task.dueDate.getTime(),Date.parse(item.due_at));
 assert.equal(canvasTaskFields({name:'Undated',due_at:null},'assignment').dueDate,null);
});
test('all-day Canvas events retain date-only boundaries across daylight saving time',()=>{
 const fields=canvasTaskFields({title:'Workshop',start_at:'2026-11-01T00:00:00-05:00',end_at:'2026-11-02T00:00:00-06:00',all_day:true,all_day_date:'2026-11-01',location_name:'Library'},'calendar_event');
 assert.equal(fields.calendarDate,'2026-11-01');assert.equal(fields.calendarLastDate,'2026-11-01');assert.equal(fields.calendarLocation,'Library');assert.equal(fields.calendarAllDay,true);
});
