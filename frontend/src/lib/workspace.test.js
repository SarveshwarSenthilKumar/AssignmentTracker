import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultWorkspace, importWorkspace, TOOLS, windowFor } from './workspace.js'
import { featureVisible, shortcutVisible } from './featureVisibility.js'
import { SHORTCUTS } from './shortcuts.js'

test('new Workspace tools survive export and import and existing notes stay intact', () => {
  const layout = defaultWorkspace()
  const first = layout.tabs[0]
  first.windows.find(win => win.panes[0].type === 'notes').panes[0].note = 'Keep this'
  const types = ['canvas', 'bookmarks', 'detective-wall', 'whiteboards', 'study', 'account']
  first.windows.push(...types.map(type => windowFor(type)))
  const imported = importWorkspace(JSON.parse(JSON.stringify(layout)))
  assert.deepEqual(imported.tabs[0].windows.slice(-types.length).map(win => win.panes[0].type), types)
  assert.equal(imported.tabs[0].windows.find(win => win.panes[0].type === 'notes').panes[0].note, 'Keep this')
  assert.ok(types.every(type => TOOLS[type].route === type))
  layout.tabs[0].windows.at(-1).panes[0].type = 'unknown'
  assert.throws(() => importWorkspace(layout), /Invalid workspace tool/)
})

test('hidden destinations are unavailable through aliases and registered shortcuts', () => {
  const hidden = ['tasks', 'documents', 'calendar', 'workspace', 'global-search']
  for (const route of ['tasks', 'calendar-tab', 'shared-calendar-event', 'documents/folder/inbox', 'whiteboards']) {
    assert.equal(featureVisible(hidden, route), false, route)
  }
  for (const id of ['nav-tasks', 'nav-calendar', 'nav-workspace', 'global-search']) {
    assert.equal(shortcutVisible(hidden, SHORTCUTS.find(item => item.id === id)), false, id)
  }
  assert.equal(featureVisible(hidden, 'account'), true)
})
