const { validDay } = require('./calendarEntries');
const date = value => value && Number.isFinite(Date.parse(value)) ? new Date(value) : null;
function canvasIdentity(userId, item, type) { return { user: userId, canvasId: String(item.id), canvasType: type }; }
function canvasTaskFields(item, type, courseName='') {
  const context=type==='assignment'?courseName:item.context_name;
  const result = { text: (type === 'assignment' ? item.name : item.title) || 'Canvas item', dueDate: date(type === 'assignment' ? item.due_at : item.start_at), calendarContext: typeof context==='string'?context:'' };
  if (type === 'calendar_event') {
    const start = result.dueDate, end = date(item.end_at), allDay = item.all_day === true;
    const startDay = validDay(item.all_day_date) ? item.all_day_date : null;
    let lastDay = null;
    if (allDay && startDay && end) {
      const endDay = item.end_at.slice(0,10);
      if (validDay(endDay)) {
        lastDay = /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.0+)?)?(?:Z|[+-])/.test(item.end_at) ? new Date(Date.parse(`${endDay}T12:00:00Z`)-86400000).toISOString().slice(0,10) : endDay;
        if (lastDay < startDay) lastDay = startDay;
      }
    }
    Object.assign(result, { calendarEndDate: start && end && end >= start ? end : null, calendarAllDay: allDay, calendarDate: startDay, calendarLastDate: lastDay, calendarLocation: [item.location_name,item.location_address].filter(value=>typeof value==='string'&&value).join(' · ') });
  }
  return result;
}
module.exports={canvasIdentity,canvasTaskFields};
