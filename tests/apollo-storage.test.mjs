import test from 'node:test';
import assert from 'node:assert/strict';
import { guardedStorage } from '../learn/apollo-storage.js';
import { PROGRESS_KEY, freshProgress, readProgress, saveProgress, beginQuestion, recordAnswer } from '../learn/apollo-progress.js';
import { MISSION_KEY } from '../learn/apollo-mission-state.js';

function memoryStorage(entries = []) {
  const data = new Map(entries);
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: key => data.delete(key),
    clear: () => data.clear()
  };
}

test('a stale tab cannot erase another tab’s solved lesson', () => {
  const raw = memoryStorage([[PROGRESS_KEY, JSON.stringify(freshProgress(42))]]);
  const conflicts = [], tabA = guardedStorage(raw), tabB = guardedStorage(raw, event => conflicts.push(event));
  const progressA = readProgress(tabA), progressB = readProgress(tabB);
  beginQuestion(progressA, 'vectors', 4); recordAnswer(progressA, 'vectors', true);
  assert.equal(saveProgress(tabA, progressA), true);
  beginQuestion(progressB, 'orbits', 4);
  assert.equal(saveProgress(tabB, progressB), false);
  assert.equal(readProgress(raw).lessons.vectors.correct, 1);
  assert.equal(readProgress(raw).lessons.orbits, undefined);
  assert.deepEqual(conflicts, [{ key: PROGRESS_KEY }]);
  assert.equal(tabB.conflicted, true);
  assert.equal(saveProgress(tabB, progressB), false);
  assert.equal(conflicts.length, 1);
});

test('same-tab successive writes advance only that key’s baseline', () => {
  const raw = memoryStorage(), guard = guardedStorage(raw);
  assert.equal(guard.getItem(PROGRESS_KEY), null);
  assert.equal(guard.getItem(MISSION_KEY), null);
  for (const value of ['first', 'second', 'third']) {
    guard.setItem(PROGRESS_KEY, value);
    assert.equal(guard.check(PROGRESS_KEY), true);
    assert.equal(guard.getItem(PROGRESS_KEY), value);
  }
  guard.setItem(MISSION_KEY, 'flight');
  assert.equal(raw.getItem(PROGRESS_KEY), 'third');
  assert.equal(raw.getItem(MISSION_KEY), 'flight');
  assert.equal(guard.check(), true);
});

test('external reset, removal, and clear are detected without rebasing', () => {
  for (const change of ['reset', 'remove', 'clear']) {
    const raw = memoryStorage([[PROGRESS_KEY, 'original'], [MISSION_KEY, 'original flight']]);
    const events = [], guard = guardedStorage(raw, event => events.push(event));
    guard.getItem(PROGRESS_KEY); guard.getItem(MISSION_KEY);
    if (change === 'reset') raw.setItem(PROGRESS_KEY, 'reset');
    if (change === 'remove') raw.removeItem(PROGRESS_KEY);
    if (change === 'clear') raw.clear();
    const latest = raw.getItem(PROGRESS_KEY);
    assert.equal(guard.check(change === 'clear' ? null : PROGRESS_KEY), false);
    assert.equal(guard.check(PROGRESS_KEY), false);
    assert.throws(() => guard.setItem(PROGRESS_KEY, 'stale'), { code: 'APOLLO_STORAGE_CONFLICT' });
    assert.throws(() => guard.setItem(MISSION_KEY, 'stale flight'), { code: 'APOLLO_STORAGE_CONFLICT' });
    assert.equal(raw.getItem(PROGRESS_KEY), latest);
    assert.equal(events.length, 1);
  }
});

test('re-reading an externally changed record cannot silently authorize a stale write', () => {
  const raw = memoryStorage([[MISSION_KEY, 'old']]), guard = guardedStorage(raw);
  guard.getItem(MISSION_KEY);
  raw.setItem(MISSION_KEY, 'new flight');
  assert.throws(() => guard.getItem(MISSION_KEY), { code: 'APOLLO_STORAGE_CONFLICT' });
  assert.throws(() => guard.setItem(MISSION_KEY, 'old flight'), { code: 'APOLLO_STORAGE_CONFLICT' });
  assert.equal(raw.getItem(MISSION_KEY), 'new flight');
});

test('storage failures remain errors and failed writes do not advance the baseline', () => {
  const blocked = guardedStorage({ getItem() { throw new Error('blocked'); } });
  assert.throws(() => blocked.getItem(PROGRESS_KEY), /blocked/);
  assert.equal(readProgress(blocked, 7).seed, 7);
  assert.equal(saveProgress(blocked, freshProgress(7)), false);
  assert.equal(blocked.conflicted, false);
  const raw = memoryStorage([[PROGRESS_KEY, 'old']]);
  const guard = guardedStorage({ ...raw, setItem() { throw new Error('quota'); } });
  guard.getItem(PROGRESS_KEY);
  assert.throws(() => guard.setItem(PROGRESS_KEY, 'new'), /quota/);
  assert.equal(guard.check(PROGRESS_KEY), true);
  assert.equal(guard.getItem(PROGRESS_KEY), 'old');
  assert.equal(guard.conflicted, false);
});

test('unrelated keys and unchecked records cannot be written through the guard', () => {
  const raw = memoryStorage([['another.app', 'untouched']]), guard = guardedStorage(raw);
  assert.equal(guard.check('another.app'), true);
  assert.throws(() => guard.getItem('another.app'), RangeError);
  assert.throws(() => guard.setItem('another.app', 'changed'), RangeError);
  assert.throws(() => guard.setItem(PROGRESS_KEY, 'without a read'), /Read the Apollo record/);
  assert.equal(raw.getItem('another.app'), 'untouched');
  assert.equal(raw.getItem(PROGRESS_KEY), null);
});
