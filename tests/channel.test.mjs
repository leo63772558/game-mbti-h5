import test from 'node:test';
import assert from 'node:assert/strict';

import { getChannelFromSearch, mergeStateWithChannel } from '../src/channel.mjs';

test('getChannelFromSearch reads h5_channel and falls back to default_channel', () => {
  assert.equal(getChannelFromSearch('?h5_channel=wechat_group'), 'wechat_group');
  assert.equal(getChannelFromSearch('?utm_source=test'), 'default_channel');
});

test('getChannelFromSearch rejects unsafe or oversized h5_channel values', () => {
  assert.equal(getChannelFromSearch('?h5_channel=%3Cimg%20src=x%20onerror=alert(1)%3E'), 'default_channel');
  assert.equal(getChannelFromSearch('?h5_channel=Wechat_Group'), 'default_channel');
  assert.equal(getChannelFromSearch(`?h5_channel=${'a'.repeat(65)}`), 'default_channel');
});

test('mergeStateWithChannel lets an explicit URL channel override restored local state', () => {
  const restored = {
    view: 'quiz',
    currentIndex: 8,
    answers: [{ questionId: 'q01', score: -2 }],
    channel: 'friend_circle',
  };

  assert.deepEqual(mergeStateWithChannel(restored, '?h5_channel=xiaohongshu'), {
    ...restored,
    channel: 'xiaohongshu',
  });
});

test('mergeStateWithChannel keeps a safe restored channel only when URL has no h5_channel', () => {
  const restored = {
    view: 'home',
    currentIndex: 0,
    answers: [],
    channel: 'friend_circle',
  };

  assert.equal(mergeStateWithChannel(restored, '?utm_source=test').channel, 'friend_circle');
  assert.equal(mergeStateWithChannel(restored, '?h5_channel=<script>alert(1)</script>').channel, 'default_channel');
});

test('mergeStateWithChannel sanitizes restored channel from older localStorage data', () => {
  const restored = {
    view: 'home',
    currentIndex: 0,
    answers: [],
    channel: '<script>alert(1)</script>',
  };

  assert.equal(mergeStateWithChannel(restored, '').channel, 'default_channel');
});
