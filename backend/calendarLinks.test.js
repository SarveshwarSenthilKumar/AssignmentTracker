const test = require('node:test');
const assert = require('node:assert/strict');
const { calendarEntry } = require('./calendarEntries');
const { calendarLinksOwned } = require('./calendarLinks');
test('calendar links validate IDs, deduplicate and ignore injected ownership', () => {
  const base={title:'Review',kind:'marker',allDay:true,startDate:'2026-10-14'};
  const id='ABCDEF012345678901234567';
  const entry=calendarEntry({...base,taskIds:[id,id.toLowerCase()],documentIds:[],user:'other'});
  assert.deepEqual(entry.taskIds,[id.toLowerCase()]);assert.equal(entry.user,undefined);
  assert.throws(()=>calendarEntry({...base,taskIds:['invalid']}));
  assert.throws(()=>calendarEntry({...base,documentIds:Array(101).fill(id)}));
  assert.equal(calendarEntry(base).taskIds,undefined);
});
test('new links require owner-scoped active documents while previously missing links remain editable', async () => {
  const seen=[];
  const models={Todo:{countDocuments:async query=>{seen.push(query);return query.user==='owner'?query._id.$in.length:0}},PDF:{countDocuments:async query=>{seen.push(query);return query._id.$in.includes('trashed')?0:query._id.$in.length}}};
  assert.equal(await calendarLinksOwned({taskIds:['task'],documentIds:['doc']},'owner',{},models),true);
  assert.equal(seen[0].user,'owner');assert.equal(seen[1].deletedAt,null);
  assert.equal(await calendarLinksOwned({taskIds:['task']},'other',{},models),false);
  assert.equal(await calendarLinksOwned({documentIds:['trashed']},'owner',{},models),false);
  const count=seen.length;
  assert.equal(await calendarLinksOwned({taskIds:['deleted'],documentIds:['missing']},'owner',{taskIds:['deleted'],documentIds:['missing']},models),true);
  assert.equal(seen.length,count);
});
