const test = require('node:test');
const assert = require('node:assert/strict');
const { resetAccountWorkspace } = require('./accountReset');

function database({ fail = false, failCalendar = false, missingUser = false } = {}) {
  const initial = { calendarEntries: [{ user: 'a' }, { user: 'b' }], tasks: [{ user: 'a' }, { user: 'b' }], documents: [{ user: 'a', deletedAt: 'date', pdfData: 'backup' }, { user: 'b' }], taskFolders: [{ user: 'a' }, { user: 'b' }], documentFolders: [{ user: 'a' }, { user: 'b' }], users: [{ _id: 'a', email: 'a@test', password: 'hashed', canvasToken: 'secret', canvasUrl: 'url', lastCanvasSync: 'date' }, { _id: 'b', canvasToken: 'other' }] };
  let saved = structuredClone(initial), staged, ended = false;
  const session = { async withTransaction(callback) { staged = structuredClone(saved); await callback(); saved = staged }, async endSession() { ended = true } };
  const model = key => ({ async deleteMany(owner, options) {
    assert.deepEqual(owner, { user: 'a' }); assert.equal(options.session, session);
    if ((fail && key === 'taskFolders') || (failCalendar && key === 'calendarEntries')) throw new Error('Database failure');
    const before = staged[key].length; staged[key] = staged[key].filter(row => row.user !== owner.user);
    return { deletedCount: before - staged[key].length };
  } });
  const models = { CalendarEntry: model('calendarEntries'), Todo: model('tasks'), PDF: model('documents'), Folder: model('taskFolders'), PDFFolder: model('documentFolders'), User: { async updateOne(owner, update, options) {
    assert.deepEqual(owner, { _id: 'a' }); assert.equal(options.session, session);
    if (missingUser) return { matchedCount: 0 };
    Object.assign(staged.users[0], update.$set); return { matchedCount: 1 };
  } } };
  return { input: { userId: 'a', models, startSession: async () => session }, saved: () => saved, initial, ended: () => ended };
}

test('reset deletes only the owner workspace including Trash and preserves login', async () => {
  const db = database();
  assert.deepEqual(await resetAccountWorkspace(db.input), { tasks: 1, documents: 1, taskFolders: 1, documentFolders: 1, calendarEntries: 1 });
  for (const key of ['tasks','documents','taskFolders','documentFolders','calendarEntries']) assert.deepEqual(db.saved()[key], [{ user: 'b' }]);
  assert.deepEqual(db.saved().users[0], { _id: 'a', email: 'a@test', password: 'hashed', canvasToken: null, canvasUrl: null, lastCanvasSync: null });
  assert.deepEqual(db.saved().users[1], db.initial.users[1]); assert.equal(db.ended(), true);
});

test('failure rolls back all staged deletions and always ends the session', async () => {
  for (const options of [{ fail: true }, { failCalendar: true }, { missingUser: true }]) {
    const db = database(options);
    await assert.rejects(resetAccountWorkspace(db.input));
    assert.deepEqual(db.saved(), db.initial); assert.equal(db.ended(), true);
  }
});
