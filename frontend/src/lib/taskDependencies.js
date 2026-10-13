const idOf = value => String(value?._id || value || '')
export function dependencyEdges(tasks) {
  const ids = new Set(tasks.map(task => idOf(task._id))), seen = new Set(), edges = []
  for (const task of tasks) for (const value of task.dependsOn || []) {
    const beforeId = idOf(value), afterId = idOf(task._id), key = `${beforeId}:${afterId}`
    if (!ids.has(beforeId) || beforeId === afterId || seen.has(key)) continue
    seen.add(key); edges.push({ beforeId, afterId })
  }
  return edges
}

export function dependencySummary(taskId, tasks) {
  const id = idOf(taskId), edges = dependencyEdges(tasks), lookup = new Map(tasks.map(task => [idOf(task._id), task]))
  const prerequisites = edges.filter(edge => edge.afterId === id).map(edge => lookup.get(edge.beforeId))
  const following = edges.filter(edge => edge.beforeId === id).map(edge => lookup.get(edge.afterId))
  const open = prerequisites.filter(task => task.status !== 'completed')
  const outgoing = new Map()
  for (const edge of edges) { if (!outgoing.has(edge.beforeId)) outgoing.set(edge.beforeId, []); outgoing.get(edge.beforeId).push(edge.afterId) }
  const visited = new Set(), queue = [...(outgoing.get(id) || [])]
  let circular = false
  while (queue.length) {
    const next = queue.pop()
    if (next === id) { circular = true; break }
    if (visited.has(next)) continue
    visited.add(next); queue.push(...(outgoing.get(next) || []))
  }
  return { prerequisites, following, open, completed: prerequisites.length - open.length, circular }
}

export function dependencyLayout(tasks) {
  const edges = dependencyEdges(tasks), degree = new Map(tasks.map(task => [idOf(task._id), 0])), stage = new Map(tasks.map(task => [idOf(task._id), 0])), outgoing = new Map()
  for (const edge of edges) {
    degree.set(edge.afterId, degree.get(edge.afterId) + 1)
    if (!outgoing.has(edge.beforeId)) outgoing.set(edge.beforeId, [])
    outgoing.get(edge.beforeId).push(edge.afterId)
  }
  const queue = [...degree.keys()].filter(id => degree.get(id) === 0), processed = new Set()
  for (let index = 0; index < queue.length; index++) {
    const id = queue[index]; processed.add(id)
    for (const next of outgoing.get(id) || []) {
      stage.set(next, Math.max(stage.get(next), stage.get(id) + 1))
      degree.set(next, degree.get(next) - 1)
      if (degree.get(next) === 0) queue.push(next)
    }
  }
  const cyclicStage = Math.max(0, ...stage.values()) + (processed.size ? 1 : 0)
  for (const id of degree.keys()) if (!processed.has(id)) stage.set(id, cyclicStage)
  const columns = new Map(), positions = new Map()
  for (const task of [...tasks].sort((a,b) => (a.text || '').localeCompare(b.text || ''))) {
    const column = stage.get(idOf(task._id))
    if (!columns.has(column)) columns.set(column, [])
    columns.get(column).push(idOf(task._id))
  }
  const width = Math.max(600, (Math.max(0, ...columns.keys()) + 1) * 260 + 80), height = Math.max(380, Math.max(0, ...[...columns.values()].map(ids => ids.length)) * 110 + 130)
  for (const [column, ids] of columns) ids.forEach((id, index) => positions.set(id, { x: 130 + column * 260, y: (height - (ids.length - 1) * 110)/2 + index * 110 }))
  return { positions, width, height }
}
