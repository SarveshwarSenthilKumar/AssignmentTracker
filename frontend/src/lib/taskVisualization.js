import { dependencyEdges, dependencyLayout } from './taskDependencies.js'
import { documentTaskIds } from './taskAttachments.js'
export const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', completed: 'Completed' }
export const taskStatus = task => task.status === 'completed' || task.status === 'in-progress' ? task.status : 'todo'
export const referenceId = value => value && typeof value === 'object' ? String(value._id || '') : String(value || '')
export function dayKey(value, zone = 'America/Chicago') {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).map(part => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
export function addDays(day, count) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10) }
export const isOverdue = (task, now) => taskStatus(task) !== 'completed' && task.dueDate && Number.isFinite(new Date(task.dueDate).getTime()) && new Date(task.dueDate).getTime() < new Date(now).getTime()
export function taskMetrics(tasks, now = new Date()) {
  const time = new Date(now).getTime(), weekEnd = time + 7 * 86400000
  const counts = { todo: 0, 'in-progress': 0, completed: 0 }
  let overdue = 0, dueSoon = 0, undated = 0
  for (const task of tasks) {
    counts[taskStatus(task)]++
    const day = task.dueDate ? dayKey(task.dueDate) : null
    if (!day) undated++
    if (isOverdue(task, now)) overdue++
    if (taskStatus(task) !== 'completed' && day && new Date(task.dueDate).getTime() >= time && new Date(task.dueDate).getTime() <= weekEnd) dueSoon++
  }
  return { total: tasks.length, counts, overdue, dueSoon, undated, completion: tasks.length ? Math.round(counts.completed / tasks.length * 100) : 0 }
}
export function deadlineSeries(tasks, now = new Date(), days = 14) {
  const today = dayKey(now)
  const series = Array.from({ length: days }, (_, index) => ({ day: addDays(today, index), todo: 0, 'in-progress': 0, completed: 0 }))
  const lookup = new Map(series.map(bin => [bin.day, bin]))
  for (const task of tasks) { const key = task.dueDate ? dayKey(task.dueDate) : null; const bin = lookup.get(key); if (bin) bin[taskStatus(task)]++ }
  return series
}
export function buildTaskGraph(tasks, folders, documents = [], mode = 'folder') {
  const locations = new Map(folders.map(folder => [String(folder._id), folder.name]))
  const grouped = new Map()
  for (const task of tasks) {
    const folder = referenceId(task.folder), key = mode === 'status' ? taskStatus(task) : locations.has(folder) ? folder : 'inbox'
    if (!grouped.has(key)) grouped.set(key, { id: `group:${key}`, value: key, label: mode === 'status' ? STATUS_LABELS[key] : locations.get(key) || 'Inbox', tasks: [] })
    grouped.get(key).tasks.push(task)
  }
  const groups = [...grouped.values()].sort((a, b) => a.label.localeCompare(b.label))
  const maxCount = Math.max(1, ...groups.map(group => group.tasks.length))
  const outer = 105 + Math.ceil(Math.sqrt(maxCount)) * 16
  const orbit = groups.length <= 1 ? 0 : Math.max(250, outer / Math.sin(Math.PI / Math.max(2, groups.length)) + 60)
  const size = Math.ceil((orbit + outer + 150) * 2), center = size / 2
  const nodes = [{ id: 'root', type: 'root', label: 'Task workspace', x: center, y: center }], edges = []
  const taskNodes = new Map()
  groups.forEach((group, index) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / groups.length
    const x = center + Math.cos(angle) * orbit, y = center + Math.sin(angle) * orbit
    nodes.push({ ...group, type: 'group', x, y })
    if (groups.length > 1) edges.push({ source: 'root', target: group.id, type: 'group' })
    else nodes[0].hidden = true
    const sorted = [...group.tasks].sort((a,b) => (a.text || '').localeCompare(b.text || ''))
    let ring = 0, offset = 0
    while (offset < sorted.length) {
      const radius = 95 + ring * 38, capacity = Math.max(12, Math.floor(2 * Math.PI * radius / 48)), count = Math.min(capacity, sorted.length - offset)
      for (let i = 0; i < count; i++) {
        const task = sorted[offset + i], theta = -Math.PI / 2 + i / count * Math.PI * 2 + ring * .22
        const node = { id: `task:${task._id}`, type: 'task', label: task.text || 'Untitled task', task, group: group.id, x: x + Math.cos(theta) * radius, y: y + Math.sin(theta) * radius }
        nodes.push(node); taskNodes.set(String(task._id), node)
        edges.push({ source: group.id, target: node.id, type: 'membership' })
      }
      offset += count; ring++
    }
  })
  let graphWidth = size, graphHeight = size
  if (mode === 'sequence') {
    const layout = dependencyLayout(tasks); graphWidth = layout.width; graphHeight = layout.height
    edges.length = 0
    for (const node of nodes) {
      if (node.type !== 'task') node.hidden = true
      else Object.assign(node, layout.positions.get(String(node.task._id)))
    }
  }
  for (const edge of dependencyEdges(tasks)) edges.push({ source: `task:${edge.beforeId}`, target: `task:${edge.afterId}`, type: 'dependency', complete: taskNodes.get(edge.beforeId).task.status === 'completed' })
  const linked = new Map()
  documents.filter(file => !file.deletedAt).forEach(file => {
    documentTaskIds(file).forEach(id => {
    const parent = taskNodes.get(id)
    if (!parent) return
    const index = linked.get(id) || 0; linked.set(id, index + 1)
    const node = { id: `file:${file._id}:${id}`, type: 'file', label: file.name || file.originalName, file, parent: parent.id, x: parent.x + 22 + index * 12, y: parent.y + 26 + index * 9 }
    nodes.push(node); edges.push({ source: parent.id, target: node.id, type: 'document' })
    })
  })
  return { nodes, edges, groups, width: graphWidth, height: graphHeight, linkedFiles: [...linked.values()].reduce((a,b)=>a+b,0) }
}
