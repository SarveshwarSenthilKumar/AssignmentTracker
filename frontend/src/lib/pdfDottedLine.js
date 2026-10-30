// Conservatively recognize a short, recent sequence of separate pen dots.
// Keep each dot as an ordinary stroke so saving, moving and PDF export agree.
export function detectDottedLine(items, scale = 1) {
  const dots = []
  const latest = items[items.length - 1]
  if (!latest || latest.tool !== 'pen' || !latest.inkCreatedAt) return null
  for (let i = items.length - 1; i >= 0 && dots.length < 24; i--) {
    const item = items[i], points = item.points
    if (item.tool !== 'pen' || item.page !== latest.page || item.color !== latest.color || item.strokeWidth !== latest.strokeWidth || !item.inkCreatedAt || latest.inkCreatedAt - item.inkCreatedAt > 20000 || !points?.length) break
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length
    if (points.some(p => Math.hypot(p.x - x, p.y - y) * scale > Math.max(4, item.strokeWidth * scale))) break
    dots.unshift({ item, x, y })
  }
  if (dots.length < 4) return null
  const first = dots[0], last = dots[dots.length - 1]
  const length = Math.hypot(last.x - first.x, last.y - first.y)
  if (length * scale < 30) return null
  const dx = (last.x - first.x) / length, dy = (last.y - first.y) / length
  const spacing = length / (dots.length - 1)
  if (spacing * scale < 5 || spacing * scale > 90) return null
  if (dots.some((dot, index) => {
    const along = (dot.x - first.x) * dx + (dot.y - first.y) * dy
    const across = Math.abs((dot.x - first.x) * dy - (dot.y - first.y) * dx)
    return across > Math.min(6 / scale, spacing * .25) || Math.abs(along - index * spacing) > spacing * .35
  })) return null
  return dots.map((dot, index) => ({ original: dot.item, replacement: {
    ...dot.item, dottedLine: true,
    points: [{ x: first.x + dx * spacing * index, y: first.y + dy * spacing * index, pressure: .5 }],
  } }))
}
