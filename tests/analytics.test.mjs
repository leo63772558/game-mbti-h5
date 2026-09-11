import test from 'node:test';
import assert from 'node:assert/strict';

import { flushAnalytics, initAnalytics, track } from '../src/analytics.mjs';

function createStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

function installBrowserGlobals({
  userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 MicroMessenger/8.0 Mobile',
  width = 390,
  height = 844,
  search = '?h5_channel=wechat_group',
  host = 'demo-phi-pearl.vercel.app',
  origin = 'https://demo-phi-pearl.vercel.app',
} = {}) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: createStorage() });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: createStorage() });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { referrer: 'https://referrer.example/path' } });
  Object.defineProperty(globalThis, 'location', { configurable: true, value: {
    host,
    origin,
    pathname: '/play/index.html',
    search,
  } });
  Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: height });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent } });
  Object.defineProperty(globalThis, 'fetch', { configurable: true, value: undefined });
}

test('initAnalytics creates persistent anon_id and session session_id', () => {
  installBrowserGlobals();

  const first = initAnalytics({ channel: 'wechat_group' });
  const second = initAnalytics({ channel: 'wechat_group' });

  assert.ok(first.anonId);
  assert.ok(first.sessionId);
  assert.equal(second.anonId, first.anonId);
  assert.equal(second.sessionId, first.sessionId);

  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: createStorage() });
  const third = initAnalytics({ channel: 'wechat_group' });
  assert.equal(third.anonId, first.anonId);
  assert.notEqual(third.sessionId, first.sessionId);
});

test('track fills public analytics fields and sends GPTI answer payload', async () => {
  installBrowserGlobals();

  let capturedBody = null;
  globalThis.navigator.sendBeacon = (_endpoint, body) => {
    capturedBody = body;
    return true;
  };

  initAnalytics({
    endpoint: 'https://analytics.example/collect',
    channel: 'wechat_group',
    appVersion: 'test-version',
    contentVersion: 'content-2026-06-10-gpti-scoring-calibration-a',
    batchSize: 10,
  });
  track('question_answer', {
    page_id: 'quiz',
    question_id: 'q01',
    question_index: 1,
    chapter: 1,
    option_id: 'a',
    keywords: ['莽', '效率', '速通'],
    poles: { A: 2, T: 2, B: 1 },
    time_spent_ms: 1234,
    is_change: false,
  });

  const result = await flushAnalytics();
  const payload = JSON.parse(await capturedBody.text());
  const event = payload.events[0];

  assert.equal(result.ok, true);
  assert.equal(payload.events.length, 1);
  assert.equal(event.event_name, 'question_answer');
  assert.equal(event.channel, 'wechat_group');
  assert.equal(event.page_id, 'quiz');
  assert.equal(event.path, '/play/index.html');
  assert.equal(event.query, '?h5_channel=wechat_group');
  assert.equal(event.referrer, 'https://referrer.example/path');
  assert.equal(event.host, 'demo-phi-pearl.vercel.app');
  assert.equal(event.origin, 'https://demo-phi-pearl.vercel.app');
  assert.equal(event.device_type, 'mobile');
  assert.deepEqual(event.viewport, { width: 390, height: 844 });
  assert.equal(event.viewport_width, 390);
  assert.equal(event.viewport_height, 844);
  assert.equal(event.browser_hint, 'wechat');
  assert.equal(event.app_version, 'test-version');
  assert.equal(event.content_version, 'content-2026-06-10-gpti-scoring-calibration-a');
  assert.ok(event.event_id);
  assert.ok(event.at);
  assert.ok(event.anon_id);
  assert.ok(event.session_id);
  assert.equal(event.payload.question_id, 'q01');
  assert.equal(event.payload.option_id, 'a');
  assert.deepEqual(event.payload.keywords, ['莽', '效率', '速通']);
  assert.deepEqual(event.payload.poles, { A: 2, T: 2, B: 1 });
  assert.equal(event.payload.time_spent_ms, 1234);
  assert.equal(event.payload.is_change, false);
  assert.equal(event.payload.dimension, undefined);
  assert.equal(event.payload.score, undefined);
});

test('track carries GPTI completion and result payload fields', async () => {
  installBrowserGlobals();

  let capturedBody = null;
  globalThis.navigator.sendBeacon = (_endpoint, body) => {
    capturedBody = body;
    return true;
  };

  initAnalytics({
    endpoint: 'https://analytics.example/collect',
    channel: 'wechat_group',
    appVersion: 'test-version',
    contentVersion: 'content-2026-06-10-gpti-scoring-calibration-a',
    batchSize: 10,
  });
  track('test_complete', {
    page_id: 'generating',
    duration_ms: 120000,
    result_type_internal: 'ATRB',
    result_name: '狂战士',
    hidden_trait_id: 'scripted_gambler',
    hidden_trait_name: '脚本赌徒',
    confidence_avg: 0.62,
    low_confidence_count: 1,
  });
  track('result_view', {
    page_id: 'result',
    result_type_internal: 'ATRB',
    result_name: '狂战士',
    hidden_trait_id: 'scripted_gambler',
    hidden_trait_name: '脚本赌徒',
    archive_code: 'ARCHIVE-024',
    confidence_avg: 0.62,
  });

  await flushAnalytics();
  const payload = JSON.parse(await capturedBody.text());
  const [complete, resultView] = payload.events;

  assert.equal(payload.events.length, 2);
  assert.equal(complete.event_name, 'test_complete');
  assert.equal(complete.content_version, 'content-2026-06-10-gpti-scoring-calibration-a');
  assert.equal(complete.payload.result_type_internal, 'ATRB');
  assert.equal(complete.payload.result_name, '狂战士');
  assert.equal(complete.payload.hidden_trait_id, 'scripted_gambler');
  assert.equal(complete.payload.hidden_trait_name, '脚本赌徒');
  assert.equal(complete.payload.confidence_avg, 0.62);
  assert.equal(complete.payload.low_confidence_count, 1);
  assert.equal(resultView.event_name, 'result_view');
  assert.equal(resultView.payload.result_type_internal, 'ATRB');
  assert.equal(resultView.payload.result_name, '狂战士');
  assert.equal(resultView.payload.hidden_trait_id, 'scripted_gambler');
  assert.equal(resultView.payload.hidden_trait_name, '脚本赌徒');
  assert.equal(resultView.payload.archive_code, 'ARCHIVE-024');
  assert.equal(resultView.payload.confidence_avg, 0.62);
});

test('track ignores events outside the whitelist', async () => {
  installBrowserGlobals();

  let calls = 0;
  globalThis.navigator.sendBeacon = () => {
    calls += 1;
    return true;
  };

  initAnalytics({ endpoint: 'https://analytics.example/collect' });
  const accepted = track('not_allowed_event', { page_id: 'quiz' });
  const result = await flushAnalytics();

  assert.equal(accepted, false);
  assert.equal(result.ok, true);
  assert.equal(result.sent, 0);
  assert.equal(calls, 0);
});

test('track does not throw without endpoint and logs locally', async () => {
  installBrowserGlobals();

  const logs = [];
  const originalInfo = console.info;
  console.info = (...args) => logs.push(args);

  try {
    initAnalytics({ channel: 'friend_circle' });
    assert.doesNotThrow(() => track('page_view', { page_id: 'home' }));
    const result = await flushAnalytics();

    assert.equal(result.ok, true);
    assert.equal(result.sent, 1);
    assert.equal(result.local, true);
    assert.equal(logs.length, 1);
    assert.equal(logs[0][0], '[analytics]');
    assert.equal((await flushAnalytics()).sent, 0);
  } finally {
    console.info = originalInfo;
  }
});

test('queue keeps at most the configured maximum number of events', async () => {
  installBrowserGlobals();

  let capturedBody = null;
  globalThis.navigator.sendBeacon = (_endpoint, body) => {
    capturedBody = body;
    return true;
  };

  initAnalytics({
    endpoint: 'https://analytics.example/collect',
    maxQueueSize: 3,
    batchSize: 99,
    batchMaxEvents: 99,
  });

  for (let index = 1; index <= 5; index += 1) {
    track('question_view', {
      page_id: 'quiz',
      question_id: `q0${index}`,
      question_index: index,
    });
  }

  await flushAnalytics();
  const payload = JSON.parse(await capturedBody.text());

  assert.deepEqual(
    payload.events.map((event) => event.payload.question_id),
    ['q03', 'q04', 'q05'],
  );
});

test('flushAnalytics falls back to fetch keepalive when sendBeacon is unavailable', async () => {
  installBrowserGlobals({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0 Safari/537.36',
    width: 1280,
    height: 720,
  });

  let fetchOptions = null;
  globalThis.fetch = async (_endpoint, options) => {
    fetchOptions = options;
    return { ok: true };
  };

  initAnalytics({
    endpoint: 'https://analytics.example/collect',
    channel: 'default_channel',
  });
  track('page_view', { page_id: 'home' });

  await flushAnalytics();
  const payload = JSON.parse(fetchOptions.body);

  assert.equal(fetchOptions.method, 'POST');
  assert.equal(fetchOptions.keepalive, true);
  assert.equal(payload.events[0].device_type, 'desktop');
  assert.equal(payload.events[0].browser_hint, 'chrome');
});

test('concurrent flushAnalytics calls send a queued batch only once', async () => {
  installBrowserGlobals();

  let sendCount = 0;
  globalThis.navigator.sendBeacon = undefined;
  globalThis.fetch = async () => {
    sendCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true };
  };

  initAnalytics({
    endpoint: 'https://analytics.example/collect',
    batchSize: 10,
  });
  track('page_view', { page_id: 'home' });

  const [first, second] = await Promise.all([flushAnalytics(), flushAnalytics()]);

  assert.equal(sendCount, 1);
  assert.equal(first.sent, 1);
  assert.equal(second.sent, 1);
  assert.equal((await flushAnalytics()).sent, 0);
});
