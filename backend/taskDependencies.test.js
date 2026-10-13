const test = require('node:test');
const assert = require('node:assert/strict');
const { dependencyChange } = require('./taskDependencies');
const beforeId = '0123456789abcdef01234567', afterId = '1123456789abcdef01234567';
test('dependency mutations validate direction, owner scope and atomic duplicate-safe updates', () => {
  const add = dependencyChange({ beforeId, afterId, linked: true }, 'owner');
  assert.deepEqual(add.owner, { user: 'owner', _id: { $in: [beforeId, afterId] } });
  assert.deepEqual(add.target, { user: 'owner', _id: afterId });
  assert.deepEqual(add.update, { $addToSet: { dependsOn: beforeId } });
  assert.deepEqual(dependencyChange({ beforeId, afterId, linked: false }, 'owner').update, { $pull: { dependsOn: beforeId } });
  for (const body of [{ beforeId, afterId: beforeId.toUpperCase(), linked: true }, { beforeId: { $ne: null }, afterId, linked: true }, { beforeId, afterId, linked: 'true' }, { beforeId, afterId: 'missing', linked: false }]) assert.throws(() => dependencyChange(body, 'owner'));
});
