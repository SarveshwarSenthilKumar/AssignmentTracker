let preferredZone = ''
export const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone
export const activeTimeZone = () => preferredZone || deviceTimeZone()
export function setTimeZone(zone) { preferredZone = zone || '' }
export function zonedParts(value, zone = activeTimeZone()) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(part=>[part.type,part.value]))
}
export function zonedLocal(value, zone = activeTimeZone()) {
  if(value == null) return ''
  const p=zonedParts(value,zone)
  return p ? `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}` : ''
}
export function localToInstant(value, zone = activeTimeZone()) {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Choose a valid date and time.')
  const wall=Date.parse(`${value}:00Z`)
  let instant=wall
  for(let i=0;i<4;i++) {
    const represented=Date.parse(`${zonedLocal(instant,zone)}:00Z`)
    if(represented===wall) return new Date(instant).toISOString()
    instant+=wall-represented
  }
  throw new Error('That local time does not exist in your time zone. Choose another time.')
}
