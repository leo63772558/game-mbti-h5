import test from 'node:test';
import assert from 'node:assert/strict';

import {
  markChapterCompleteTracked,
  markTestCompleteTracked,
} from '../src/tracking-state.mjs';

test('markChapterCompleteTracked marks each chapter only once', () => {
  const initial = {
    view: 'chapter',
    trackedChapterCompletes: [],
  };

  const first = markChapterCompleteTracked(initial, 1);
  const second = markChapterCompleteTracked(first.state, 1);

  assert.equal(first.shouldTrack, true);
  assert.deepEqual(first.state.trackedChapterCompletes, [1]);
  assert.equal(second.shouldTrack, false);
  assert.deepEqual(second.state.trackedChapterCompletes, [1]);
});

test('markChapterCompleteTracked normalizes existing chapter ids', () => {
  const result = markChapterCompleteTracked({
    trackedChapterCompletes: [2, '2', 0, 'bad', 3],
  }, 4);

  assert.equal(result.shouldTrack, true);
  assert.deepEqual(result.state.trackedChapterCompletes, [2, 3, 4]);
});

test('markTestCompleteTracked marks completion only once', () => {
  const first = markTestCompleteTracked({ view: 'generating', testCompleteTracked: false });
  const second = markTestCompleteTracked(first.state);

  assert.equal(first.shouldTrack, true);
  assert.equal(first.state.testCompleteTracked, true);
  assert.equal(second.shouldTrack, false);
  assert.equal(second.state.testCompleteTracked, true);
});
