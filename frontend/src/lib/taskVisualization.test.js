import test from 'node:test'
import assert from 'node:assert/strict'
import {buildTaskGraph, deadlineSeries, taskMetrics, dayKey} from './taskVisualization.js'
const now=new Date('2026-10-13T18:00:00Z')
const tasks=[{_id:'a',text:'Overdue',folder:'f',status:'todo',dueDate:'2026-10-12T18:00:00Z'},{_id:'b',text:'Upcoming',folder:'f',status:'in-progress',dueDate:'2026-10-14T18:00:00Z'},{_id:'c',text:'Finished',status:'completed',dueDate:'2026-10-11T18:00:00Z'},{_id:'d',text:'No deadline',folder:'missing',status:'todo'}]
test('all tasks are mapped with real group membership and associated active documents',()=>{
 const graph=buildTaskGraph(tasks,[{_id:'f',name:'Coursework'}],[{_id:'doc',name:'Notes',todo:'b'},{_id:'trash',todo:'b',deletedAt:'date'},{_id:'other',todo:'unknown'}])
 assert.equal(graph.nodes.filter(node=>node.type==='task').length,4)
 assert.equal(graph.nodes.filter(node=>node.type==='file').length,1)
 assert.equal(graph.groups.length,2)
 assert.ok(graph.edges.some(edge=>edge.source==='task:b'&&edge.target==='file:doc'))
 assert.equal(graph.edges.filter(edge=>edge.type==='membership').length,4)
 assert.ok(graph.nodes.every(node=>Number.isFinite(node.x)&&Number.isFinite(node.y)))
})
test('status layout and empty datasets have valid finite geometry',()=>{
 assert.equal(buildTaskGraph(tasks,[],[],'status').groups.length,3)
 const empty=buildTaskGraph([],[],[])
 assert.equal(empty.edges.length,0);assert.ok(empty.width>0)
 const large=buildTaskGraph(Array.from({length:350},(_,index)=>({_id:String(index),text:`Task ${index}`})),[],[])
 assert.equal(large.nodes.filter(node=>node.type==='task').length,350)
 assert.ok(large.nodes.every(node=>node.x>=0&&node.y>=0&&node.x<=large.width&&node.y<=large.height))
})
test('metrics exclude completed tasks from overdue and upcoming counts',()=>{
 const metrics=taskMetrics(tasks,now)
 assert.deepEqual(metrics.counts,{todo:2,'in-progress':1,completed:1});assert.equal(metrics.overdue,1);assert.equal(metrics.dueSoon,1);assert.equal(metrics.undated,1);assert.equal(metrics.completion,25)
 assert.equal(taskMetrics([],now).completion,0)
})
test('deadline bins use Chicago dates including UTC midnight and month boundaries',()=>{
 assert.equal(dayKey('2026-10-14T01:00:00Z'),'2026-10-13')
 const series=deadlineSeries([{_id:'x',status:'todo',dueDate:'2026-11-01T01:00:00Z'}],new Date('2026-10-31T18:00:00Z'),3)
 assert.equal(series[0].day,'2026-10-31');assert.equal(series[0].todo,1);assert.equal(series[1].day,'2026-11-01')
 assert.equal(deadlineSeries(tasks,now)[1]['in-progress'],1)
})
