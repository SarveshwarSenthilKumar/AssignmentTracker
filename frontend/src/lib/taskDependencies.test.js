import test from 'node:test'
import assert from 'node:assert/strict'
import { dependencyEdges, dependencySummary, dependencyLayout } from './taskDependencies.js'
import { buildTaskGraph } from './taskVisualization.js'
const tasks = [{ _id: 'a', text: 'Research', status: 'completed' }, { _id: 'b', text: 'Draft', status: 'todo', dependsOn: ['a', 'a', 'missing', 'b'] }, { _id: 'c', text: 'Submit', status: 'completed', dependsOn: ['b'] }]
test('directed connections ignore deleted tasks, duplicates and self references', () => {
  assert.deepEqual(dependencyEdges(tasks), [{ beforeId: 'a', afterId: 'b' }, { beforeId: 'b', afterId: 'c' }])
  const summary = dependencySummary('b', tasks)
  assert.equal(summary.completed, 1); assert.equal(summary.open.length, 0); assert.equal(summary.following[0]._id, 'c')
  assert.equal(dependencySummary('c', tasks).open.length, 1)
  assert.equal(tasks[2].status, 'completed')
})
test('cycles are reported without mutating or enforcing statuses and graph arrows follow ordering', () => {
  const circular = [{ _id: 'a', dependsOn: ['c'] }, { _id: 'b', dependsOn: ['a'] }, { _id: 'c', dependsOn: ['b'] }]
  assert.equal(dependencySummary('a', circular).circular, true)
  assert.equal(dependencySummary('a', tasks).circular, false)
  const graph = buildTaskGraph(tasks, [], [])
  const edges = graph.edges.filter(edge => edge.type === 'dependency')
  assert.deepEqual(edges.map(edge => [edge.source, edge.target, edge.complete]), [['task:a','task:b',true],['task:b','task:c',false]])
  assert.equal(buildTaskGraph([tasks[1],tasks[2]], [], []).edges.filter(edge => edge.type === 'dependency').length, 1)
  assert.equal(dependencySummary('missing', tasks).prerequisites.length, 0)
})

test('sequence layout places chains in order and handles cycles and empty workspaces', () => {
  const layout = dependencyLayout(tasks)
  assert.ok(layout.positions.get('a').x < layout.positions.get('b').x)
  assert.ok(layout.positions.get('b').x < layout.positions.get('c').x)
  const graph = buildTaskGraph(tasks, [], [], 'sequence')
  assert.equal(graph.edges.length, 2)
  assert.equal(graph.nodes.filter(node => !node.hidden).length, 3)
  for (const node of graph.nodes.filter(node => !node.hidden)) assert.ok(node.x >= 0 && node.x <= graph.width && node.y >= 0 && node.y <= graph.height)
  assert.equal(dependencyLayout([]).positions.size, 0)
  assert.equal(dependencyLayout([{ _id: 'a', dependsOn: ['b'] }, { _id: 'b', dependsOn: ['a'] }]).positions.size, 2)
})
