// Recognize a short, recent sequence of separate pen dots with human jitter.
// Keep each dot as an ordinary stroke so saving, moving and PDF export agree.
export function detectDottedLine(items, scale = 1) {
  const dots = []
  const latest = items[items.length - 1]
  if (!latest || latest.tool !== 'pen' || !latest.inkCreatedAt) return null
  const baseWidth = item => item.dottedBaseWidth ?? item.strokeWidth ?? 2
  for (let i = items.length - 1; i >= 0 && dots.length < 24; i--) {
    const item = items[i], points = item.points
    if (item.tool !== 'pen' || item.page !== latest.page || item.color !== latest.color || baseWidth(item) !== baseWidth(latest) || !item.inkCreatedAt || latest.inkCreatedAt - item.inkCreatedAt > 20000 || !points?.length) break
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length
    if (points.some(p => Math.hypot(p.x - x, p.y - y) * scale > Math.max(4, item.strokeWidth * scale))) break
    dots.unshift({ item, x, y })
  }
  if (dots.length < 4) return null
  // Fit the entire row instead of trusting the first and last dot, which can
  // themselves be misplaced. Principal-axis fitting works at any orientation.
  const center = dots.reduce((sum, dot) => ({ x: sum.x + dot.x / dots.length, y: sum.y + dot.y / dots.length }), { x: 0, y: 0 })
  let xx = 0, xy = 0, yy = 0
  for (const dot of dots) {
    const x = dot.x - center.x, y = dot.y - center.y
    xx += x * x; xy += x * y; yy += y * y
  }
  const angle = .5 * Math.atan2(2 * xy, xx - yy)
  let dx = Math.cos(angle), dy = Math.sin(angle)
  const first = dots[0], last = dots[dots.length - 1]
  if ((last.x - first.x) * dx + (last.y - first.y) * dy < 0) { dx = -dx; dy = -dy }
  const projected = dots.map(dot => (dot.x - center.x) * dx + (dot.y - center.y) * dy)
  const start = Math.min(...projected), end = Math.max(...projected), length = end - start
  if (length * scale < 30) return null
  const spacing = length / (dots.length - 1)
  if (spacing * scale < 5 || spacing * scale > 90) return null
  const offsets = dots.map(dot => Math.abs((dot.x - center.x) * dy - (dot.y - center.y) * dx))
  const tolerance = Math.min(18 / scale, Math.max(7 / scale, spacing * .6))
  const rms = Math.sqrt(offsets.reduce((sum, offset) => sum + offset * offset, 0) / dots.length)
  // Allow a wobbly row and irregular gaps, but reject broad clusters, sharp
  // turns, overlapping taps and sequences that double back substantially.
  if (Math.sqrt((xx + yy) / dots.length) < rms * 2.5 || rms > tolerance * .75 || offsets.some(offset => offset > tolerance)) return null
  for (let index = 1; index < projected.length; index++) {
    const gap = projected[index] - projected[index - 1]
    if (gap < -spacing * .15 || gap > spacing * 2.5) return null
    if (Math.hypot(dots[index].x - dots[index - 1].x, dots[index].y - dots[index - 1].y) < Math.max(baseWidth(latest), 2 / scale)) return null
  }
  const origin = { x: center.x + dx * start, y: center.y + dy * start }
  // Collapsing a small pen mark to one point used to shrink its visible ink.
  // Preserve its footprint and give dots a fuller diameter in preview/export.
  const diameter = Math.max(baseWidth(latest) * 1.8, ...dots.map(dot => {
    const radius = Math.max(...dot.item.points.map(p => Math.hypot(p.x - dot.x, p.y - dot.y)))
    return Math.max(dot.item.strokeWidth || 2, Math.min(spacing * .55, radius * 2 + baseWidth(dot.item)))
  }))
  const group = dots.find(dot => dot.item.dottedGroup)?.item.dottedGroup || `dots:${first.item.id}`
  return dots.map((dot, index) => ({ original: dot.item, replacement: {
    ...dot.item, dottedLine: true, dottedGroup: group,
    dottedBaseWidth: baseWidth(dot.item), strokeWidth: diameter,
    points: [{ x: origin.x + dx * spacing * index, y: origin.y + dy * spacing * index, pressure: .5 }],
  } }))
}
