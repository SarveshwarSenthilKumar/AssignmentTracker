const test = require('node:test');
const assert = require('node:assert/strict');
const { registerWorkspaceSettings } = require('./workspaceSettings');

test('workspace server saves new tools and rejects invalid panes and stale revisions', async () => {
  const routes = new Map();
  const app = { get() {}, put(path, auth, handler) { routes.set(path, handler); } };
  let saved;
  let revision = 0;
  const User = {
    findOneAndUpdate(filter, update) {
      const match = revision === 0 ? Boolean(filter.$or) : filter.workflowRevision === revision;
      return { select: async () => {
        if (!match) return null;
        saved = update.$set.workflowLayout;
        revision = update.$set.workflowRevision;
        return { _id: filter._id };
      } };
    },
  };
  registerWorkspaceSettings(app, () => {}, User);
  const put = async body => {
    const result = { code: 200 };
    const res = { set() {}, status(code) { result.code = code; return this; }, json(data) { result.data = data; } };
    await routes.get('/api/account/workspace-layout')({ user: { userId: 'fixture' }, body }, res);
    return result;
  };
  const layout = {
    activeTabId: 'tab',
    tabs: [{ id: 'tab', title: 'Work', activeWindowId: 'window', windows: [{
      id: 'window', activePaneId: 'canvas', x: 0, y: 0, width: 400, height: 300,
      panes: [{ id: 'canvas', type: 'canvas' }, { id: 'bookmarks', type: 'bookmarks' }, { id: 'notes', type: 'notes', note: 'saved note' }],
    }] }],
  };
  assert.deepEqual(await put({ revision: 0, layout }), { code: 200, data: { revision: 1 } });
  assert.deepEqual(saved.tabs[0].windows[0].panes.map(pane => pane.type), ['canvas', 'bookmarks', 'notes']);
  assert.equal(saved.tabs[0].windows[0].panes[2].note, 'saved note');
  assert.equal((await put({ revision: 0, layout })).code, 409);
  layout.tabs[0].windows[0].panes[0].type = 'invalid-tool';
  assert.equal((await put({ revision: 1, layout })).code, 400);
  assert.equal(revision, 1);
});
