function taskDueDate(body){
  if(body.calendarAllDay!==undefined&&typeof body.calendarAllDay!=='boolean')throw new Error('Choose a date-only or timed deadline.');
  if(body.calendarAllDay){
    const day=body.calendarDate;
    if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isFinite(Date.parse(day+'T12:00:00Z'))||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)throw new Error('Choose a valid due date.');
    return {dueDate:new Date(day+'T12:00:00Z'),calendarAllDay:true,calendarDate:day,calendarEndDate:null,calendarLastDate:null};
  }
  if(body.dueDate!=null&&(typeof body.dueDate!=='string'||!Number.isFinite(Date.parse(body.dueDate))))throw new Error('Choose a valid deadline.');
  return {dueDate:body.dueDate||null,calendarAllDay:false,calendarDate:null,calendarEndDate:null,calendarLastDate:null};
}
module.exports=taskDueDate;
