import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bump, nextVersion } from './next-version.mjs';

test('gitmoji decide the bump', () => {
  assert.deepEqual(bump([1, 3, 1], ['🐛 Fix', '🎨 Tidy']), [1, 3, 2]);
  assert.deepEqual(bump([1, 3, 1], ['🐛 Fix', '✨ (phase 5)']), [1, 4, 0]);
  assert.deepEqual(bump([1, 3, 1], ['✨ New', '💥 Drop old API']), [2, 0, 0]);
});

test('starts from the newest of the tags and package.json, and repeats a version with nothing new', () => {
  const since = (map) => (tag) => map[tag ?? 'none'];
  // An old tag behind package.json: bump package.json's version
  assert.deepEqual(nextVersion(['1.0.0'], '1.3.1', since({ '1.0.0': ['✨ (phase 5)'] })), { version: '1.4.0', isNew: true });
  // Tags made by the workflow take over
  assert.deepEqual(nextVersion(['1.0.0', '1.4.0', 'not-a-version'], '1.3.1', since({ '1.4.0': ['🐛 Fix'] })), { version: '1.4.1', isNew: true });
  assert.deepEqual(nextVersion(['1.4.0'], '1.3.1', since({ '1.4.0': [] })), { version: '1.4.0', isNew: false });
  // No tags yet
  assert.deepEqual(nextVersion([], '0.0.0', since({ none: ['🎉 First'] })), { version: '0.1.0', isNew: true });
});
