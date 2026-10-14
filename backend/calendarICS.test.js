const test=require('node:test'),assert=require('node:assert/strict');
const {icsDate,parseCalendarICS}=require('./calendarICS');
test('ICS UTC, named time zones, date-only dates and invalid values are handled correctly',()=>{
 assert.equal(icsDate('20261013T150000Z').date.toISOString(),'2026-10-13T15:00:00.000Z');
 assert.equal(icsDate('20261013T090000','America/Chicago').date.toISOString(),'2026-10-13T14:00:00.000Z');
 assert.equal(icsDate('20261013').allDay,true);assert.equal(icsDate('20260230'),null);assert.equal(icsDate('invalid'),null);
 assert.equal(icsDate('20260308T023000','America/Chicago'),null);
});
test('ICS unfolding, UID and exclusive all-day end dates survive import',()=>{
 const events=parseCalendarICS('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:reading-week\r\nSUMMARY:Reading\r\n week\r\nDTSTART;VALUE=DATE:20261012\r\nDTEND;VALUE=DATE:20261017\r\nDESCRIPTION:Review\\nPrepare\r\nEND:VEVENT\r\nEND:VCALENDAR');
 assert.equal(events.length,1);assert.equal(events[0].uid,'reading-week');assert.equal(events[0].summary,'Readingweek');assert.equal(events[0].calendarDate,'2026-10-12');assert.equal(events[0].calendarLastDate,'2026-10-16');assert.equal(events[0].description,'Review\nPrepare');
 assert.equal(parseCalendarICS('BEGIN:VEVENT\nSUMMARY:Invalid\nDTSTART:bad\nEND:VEVENT').length,0);
});
