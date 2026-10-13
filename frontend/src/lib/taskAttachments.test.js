import test from 'node:test'
import assert from 'node:assert/strict'
import { descriptionParts, documentTaskIds } from './taskAttachments.js'
import { buildTaskGraph } from './taskVisualization.js'

test('legacy and shared document associations remain unique', () => {
  assert.deepEqual(documentTaskIds({ todo: { _id: 'a' }, taskIds: ['a', 'b', null] }), ['a', 'b'])
  assert.deepEqual(documentTaskIds({}), [])
  const graph = buildTaskGraph([{ _id: 'a', text: 'A' }, { _id: 'b', text: 'B' }], [], [{ _id: 'd', taskIds: ['a', 'b'] }])
  assert.equal(graph.edges.filter(edge => edge.type === 'document').length, 2)
  assert.equal(new Set(graph.nodes.map(node => node.id)).size, graph.nodes.length)
})

test('description references preserve surrounding text without interpreting markup or URLs', () => {
  const id = '0123456789abcdef01234567'
  assert.deepEqual(descriptionParts(`Before\n[[document:${id}]] after`), [{ text: 'Before\n' }, { documentId: id }, { text: ' after' }])
  assert.deepEqual(descriptionParts('<script>bad()</script> [[document:invalid]]'), [{ text: '<script>bad()</script> [[document:invalid]]' }])
  assert.deepEqual(descriptionParts(`[[document:${id}]][[document:${id}]]`).length, 2)
  assert.deepEqual(descriptionParts(''), [])
})
