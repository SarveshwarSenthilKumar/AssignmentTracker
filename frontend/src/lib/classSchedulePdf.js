import { shiftDay } from './calendar'
import { activeTimeZone, zonedLocal } from './timeZone'
import { saveDownload } from './download'

const clock = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
const minutesAt = value => Number(value.slice(11, 13)) * 60 + Number(value.slice(14, 16))
const printable = value => String(value || '').normalize('NFKD').replace(/\p{Mark}/gu, '').replace(/[^\x20-\x7E]/g, '?')

export async function downloadClassSchedule(entries, selectedDay) {
  const weekday = new Date(`${selectedDay}T12:00:00Z`).getUTCDay()
  const monday = shiftDay(selectedDay, -((weekday + 6) % 7))
  const days = Array.from({ length: 7 }, (_, index) => shiftDay(monday, index))
  const zone = activeTimeZone()
  const meetings = []
  for (const entry of entries) {
    if (entry.kind !== 'class') continue
    const start = entry.allDay ? entry.startDate : zonedLocal(entry.startAt, zone)
    const end = entry.allDay ? entry.endDate : zonedLocal(entry.endAt, zone)
    if (!start || !end) continue
    const first = start.slice(0, 10), last = end.slice(0, 10)
    days.forEach((day, column) => {
      if (day < first || day > last) return
      const from = entry.allDay || day !== first ? 0 : minutesAt(start)
      const to = entry.allDay || day !== last ? 1440 : minutesAt(end)
      if (to > from) meetings.push({ entry, day, column, from, to })
    })
  }
  if (!meetings.length) throw new Error('No saved classes in this week. Select a date during your term.')
  meetings.sort((a, b) => a.column - b.column || a.from - b.from)
  meetings.forEach((meeting, index) => { meeting.number = index + 1 })

  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(.12, .18, .25), line = rgb(.79, .84, .89), blue = rgb(.79, .89, .98)
  function write(page, value, x, y, size = 10, maxWidth = 780, font = regular) {
    if (maxWidth < 8) return
    let text = printable(value)
    if (font.widthOfTextAtSize(text, size) > maxWidth) {
      while (text.length && font.widthOfTextAtSize(text + '...', size) > maxWidth) text = text.slice(0, -1)
      text += '...'
    }
    page.drawText(text, { x, y, size, font, color: ink })
  }

  const page = pdf.addPage([842, 595])
  write(page, 'Class schedule', 32, 554, 25, 780, bold)
  write(page, `Week of ${monday} through ${days[6]}  |  ${zone}`, 32, 532, 11)
  const timed = meetings.filter(item => !item.entry.allDay)
  const firstHour = timed.length ? Math.floor(Math.min(...timed.map(item => item.from)) / 60) : 8
  const lastHour = timed.length ? Math.ceil(Math.max(...timed.map(item => item.to)) / 60) : 18
  const left = 77, top = 480, bottom = 45, columnWidth = 104
  const y = minute => top - (minute - firstHour * 60) * (top - bottom) / ((lastHour - firstHour) * 60)
  for (let hour = firstHour; hour <= lastHour; hour++) {
    const height = y(hour * 60)
    write(page, clock(hour * 60), 35, height - 3, 8)
    page.drawLine({ start: { x: left, y: height }, end: { x: left + 7 * columnWidth, y: height }, color: line, thickness: .5 })
  }
  days.forEach((day, column) => {
    const x = left + column * columnWidth
    write(page, `${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][column]} ${day.slice(5)}`, x + 4, 506, 10, columnWidth - 8, bold)
    const dayMeetings = meetings.filter(item => item.column === column)
    const allDay = dayMeetings.filter(item => item.entry.allDay)
    if (allDay.length) write(page, `All day: ${allDay.map(item => item.number).join(', ')}`, x + 4, 491, 8, columnWidth - 8)
    page.drawLine({ start: { x, y: bottom }, end: { x, y: top }, color: line, thickness: .5 })
    const lanes = []
    const blocks = dayMeetings.filter(item => !item.entry.allDay).map(item => {
      let lane = lanes.findIndex(end => end <= item.from)
      if (lane < 0) lane = lanes.length
      lanes[lane] = item.to
      return { ...item, lane }
    })
    const width = columnWidth / Math.max(1, lanes.length)
    for (const item of blocks) {
      const blockX = x + width * item.lane
      const height = y(item.from) - y(item.to)
      page.drawRectangle({ x: blockX, y: y(item.to), width: Math.max(.2, width - 1), height, color: blue, borderColor: line, borderWidth: .4 })
      if (height >= 10) write(page, `${item.number}. ${item.entry.title}`, blockX + 3, y(item.from) - 9, 8, width - 6, bold)
    }
  })
  write(page, 'See the meeting list for course names, rooms, and exact times.', 32, 23, 9)
  let list, rowY = 0
  for (const item of meetings) {
    if (rowY < 55) {
      list = pdf.addPage([842, 595])
      write(list, 'Meeting list', 32, 552, 20, 780, bold)
      rowY = 524
    }
    write(list, `${item.number}. ${item.entry.title}`, 32, rowY, 11, 778, bold)
    write(list, `${item.day}  |  ${item.entry.allDay ? 'All day' : `${clock(item.from)}-${clock(item.to)}`}${item.entry.location ? `  |  ${item.entry.location}` : ''}`, 48, rowY - 15, 9, 762)
    rowY -= 36
  }
  const bytes = await pdf.save()
  return saveDownload(new Blob([bytes], { type: 'application/pdf' }), `class-schedule-${monday}.pdf`)
}
