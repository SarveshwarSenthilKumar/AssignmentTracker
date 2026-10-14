const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10) === value;
const instant = value => typeof value === 'string' && validDay(value.slice(0,10)) && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
function calendarEntry(body) {
  if (!body || typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 200) throw new Error('Enter a title of up to 200 characters.');
  if (!['appointment','marker'].includes(body.kind) || typeof body.allDay !== 'boolean') throw new Error('Choose an appointment or date marker.');
  for (const [key, limit] of [['notes',4000],['location',300]]) if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > limit)) throw new Error(`${key === 'notes' ? 'Notes' : 'Location'} is too long or invalid.`);
  if (body.done !== undefined && typeof body.done !== 'boolean') throw new Error('Invalid completion state.');
  const result = { title: body.title.trim(), kind: body.kind, notes: body.notes?.trim() || '', location: body.location?.trim() || '', allDay: body.kind === 'marker' || body.allDay, done: body.done ?? false };
  for (const key of ['taskIds','documentIds']) {
    if (body[key] === undefined) continue;
    if (!Array.isArray(body[key]) || body[key].length > 100 || body[key].some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) throw new Error('Choose up to 100 valid task or document links.');
    result[key] = [...new Set(body[key].map(id => id.toLowerCase()))];
  }
  if (result.allDay) {
    if (!validDay(body.startDate) || !validDay(body.endDate || body.startDate)) throw new Error('Choose valid calendar dates.');
    if ((body.endDate || body.startDate) < body.startDate) throw new Error('The end date must be on or after the start date.');
    Object.assign(result, { startDate: body.startDate, endDate: body.endDate || body.startDate, startAt: null, endAt: null });
  } else {
    if (!instant(body.startAt) || !instant(body.endAt)) throw new Error('Choose valid start and end times.');
    if (Date.parse(body.endAt) <= Date.parse(body.startAt)) throw new Error('The end time must be after the start time.');
    Object.assign(result, { startAt: new Date(body.startAt), endAt: new Date(body.endAt), startDate: body.startAt.slice(0,10), endDate: body.endAt.slice(0,10) });
  }
  return result;
}
module.exports = { calendarEntry, validDay };
