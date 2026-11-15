const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function moveInsert(item, size, point, offset, page) {
  return { x: clamp(point.x - offset.x, 0, Math.max(0, page.w - size.width)), y: clamp(point.y - offset.y, 0, Math.max(0, page.h - size.height)) }
}

export function snapInsert(position, size, page, neighbors, tolerance) {
  const snapAxis = (origin, length, limit, startsAndSizes) => {
    const offsets = [0, length / 2, length]
    let best = { position: origin, guide: null }
    let distance = tolerance
    const consider = (guide, offset) => {
      const position = guide - offset
      const delta = Math.abs(position - origin)
      if (position < 0 || position > limit - length || delta > distance || (delta === distance && best.guide !== null)) return
      best = { position, guide }
      distance = delta
    }
    ;[0, limit / 2, limit].forEach((guide, index) => consider(guide, offsets[index]))
    for (const [start, span] of startsAndSizes) {
      for (const guide of [start, start + span / 2, start + span]) {
        for (const offset of offsets) consider(guide, offset)
      }
    }
    return best
  }
  const x = snapAxis(position.x, size.width, page.w, neighbors.map(item => [item.x, item.width]))
  const y = snapAxis(position.y, size.height, page.h, neighbors.map(item => [item.y, item.height]))
  return { position: { x: x.position, y: y.position }, guides: { x: x.guide, y: y.guide } }
}

// Keep the opposite corner fixed and preserve the content's aspect ratio.
export function resizeFromCorner(item, size, point, corner, page, limits = {}) {
  const left = corner.includes('w'), top = corner.includes('n')
  const anchorX = left ? item.x + size.width : item.x
  const anchorY = top ? item.y + size.height : item.y
  const dx = (point.x - anchorX) * (left ? -1 : 1)
  const dy = (point.y - anchorY) * (top ? -1 : 1)
  const proposed = (dx * size.width + dy * size.height) / (size.width ** 2 + size.height ** 2)
  const max = Math.min((left ? anchorX : page.w - anchorX) / size.width, (top ? anchorY : page.h - anchorY) / size.height, limits.max ?? Infinity)
  const min = Math.min(max, limits.min ?? Math.max(12 / size.width, 12 / size.height))
  const ratio = clamp(proposed, min, max)
  const width = size.width * ratio, height = size.height * ratio
  return { x: left ? anchorX - width : anchorX, y: top ? anchorY - height : anchorY, width, height, ratio }
}
