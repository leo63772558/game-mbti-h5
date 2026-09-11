import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  COLLECTIONS,
  aggregateEvents,
  resolveRollupRange,
} = require('../cloudbase/functions/analytics_rollup/rollup-core.js');

// Legacy fixtures intentionally keep the pre-GPTI analytics shape
// (`content-2026-05-21`, `dimension`, `score_*`) to verify rollup
// compatibility with historical data. Current GPTI payload coverage lives in
// `tests/analytics.test.mjs`.
const LEGACY_CONTENT_VERSION = 'content-2026-05-21';
const GPTI_CONTENT_VERSION = 'content-2026-06-10-gpti-scoring-calibration-a';

function createEvent(eventName, payload = {}, overrides = {}) {
  return {
    event_id: overrides.event_id ?? `${eventName}-${payload.question_index ?? payload.platform ?? payload.result_name ?? 'x'}`,
    event_name: eventName,
    at: overrides.at ?? '2026-05-20T04:00:00.000Z',
    session_id: overrides.session_id ?? 'session-1',
    anon_id: overrides.anon_id ?? 'anon-1',
    channel: overrides.channel ?? 'wechat_group',
    host: overrides.host ?? 'demo-phi-pearl.vercel.app',
    origin: overrides.origin ?? 'https://demo-phi-pearl.vercel.app',
    content_version: overrides.content_version ?? LEGACY_CONTENT_VERSION,
    payload,
  };
}

test('aggregateEvents writes all-channel and per-channel daily summary while excluding test channels', () => {
  const records = aggregateEvents([
    createEvent('page_view', { page_id: 'home' }),
    createEvent('test_start', { page_id: 'home' }),
    createEvent('test_complete', {
      result_type_internal: 'ESTP',
      result_name: '上头战神',
      confidence_avg: 0.75,
      duration_ms: 120000,
    }),
    createEvent('result_view', {
      result_type_internal: 'ESTP',
      result_name: '上头战神',
      confidence_avg: 0.75,
    }),
    createEvent('platform_share_click', {
      platform: 'xiaohongshu',
      result_name: '上头战神',
    }),
    createEvent('page_view', { page_id: 'home' }, {
      event_id: 'test-channel-event',
      session_id: 'session-test',
      anon_id: 'anon-test',
      channel: 'e2e_20260520',
    }),
  ], { updatedAt: '2026-05-20T12:00:00.000Z' });

  const summaries = records[COLLECTIONS.dailySummary];
  const all = summaries.find((item) => item.channel === 'all');
  const wechat = summaries.find((item) => item.channel === 'wechat_group');

  assert.equal(summaries.length, 2);
  assert.equal(all.pv, 1);
  assert.equal(all.uv, 1);
  assert.equal(all.sessions, 1);
  assert.equal(all.test_start_sessions, 1);
  assert.equal(all.test_complete_sessions, 1);
  assert.equal(all.completion_rate, 1);
  assert.equal(all.share_action_sessions, 1);
  assert.equal(wechat.pv, 1);
  assert.deepEqual(all.excluded_channel_prefixes, ['e2e_', 'debug_', 'test_']);
});

test('aggregateEvents builds funnel, question, result, and share aggregate records for legacy payloads', () => {
  const events = [
    createEvent('page_view', { page_id: 'home' }),
    createEvent('test_start', { page_id: 'home' }),
    createEvent('question_view', {
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      dimension: 'EI',
    }),
    createEvent('question_answer', {
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      dimension: 'EI',
      option_id: 'score_2',
      score: 2,
      time_spent_ms: 5000,
      is_change: false,
    }),
    createEvent('question_answer', { question_id: 'q08', question_index: 8 }),
    createEvent('question_answer', { question_id: 'q16', question_index: 16 }),
    createEvent('question_answer', { question_id: 'q24', question_index: 24 }),
    createEvent('test_complete', {
      result_type_internal: 'ESTP',
      result_name: '上头战神',
      confidence_avg: 0.75,
      duration_ms: 120000,
    }),
    createEvent('result_view', {
      result_type_internal: 'ESTP',
      result_name: '上头战神',
    }),
    createEvent('copy_share_click', { result_name: '上头战神' }),
  ];
  const records = aggregateEvents(events, { updatedAt: '2026-05-20T12:00:00.000Z' });

  const funnel = records[COLLECTIONS.funnelDaily].find((item) => item.channel === 'all');
  const question = records[COLLECTIONS.questionDaily].find((item) => item.channel === 'all' && item.question_id === 'q01');
  const result = records[COLLECTIONS.resultDaily].find((item) => item.channel === 'all' && item.result_name === '上头战神');
  const share = records[COLLECTIONS.shareDaily].find((item) => item.channel === 'all');

  assert.equal(funnel.steps.find((step) => step.key === 'question_answer_24').session_count, 1);
  assert.equal(question.view_sessions, 1);
  assert.equal(question.answer_sessions, 1);
  assert.equal(question.answer_rate, 1);
  assert.equal(question.avg_time_spent_ms, 5000);
  assert.deepEqual(question.option_distribution, { score_2: 1 });
  assert.equal(result.complete_sessions, 1);
  assert.equal(result.avg_confidence, 0.75);
  assert.equal(share.action_counts.copy_share_click, 1);
  assert.equal(share.share_intent_sessions, 1);
});

test('aggregateEvents builds aggregate records for current GPTI payloads', () => {
  const records = aggregateEvents([
    createEvent('page_view', { page_id: 'home' }, {
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('test_start', { page_id: 'home' }, {
      event_id: 'gpti-start',
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('question_view', {
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      option_count: 4,
    }, {
      event_id: 'gpti-question-view',
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('question_answer', {
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      option_id: 'a',
      keywords: ['莽', '效率', '速通'],
      poles: { A: 2, T: 2, B: 1 },
      time_spent_ms: 4800,
      is_change: false,
    }, {
      event_id: 'gpti-question-answer',
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('test_complete', {
      duration_ms: 93000,
      result_type_internal: 'ATRB',
      result_name: '狂战士',
      hidden_trait_id: 'scripted_gambler',
      hidden_trait_name: '脚本赌徒',
      confidence_avg: 0.62,
      low_confidence_count: 1,
    }, {
      event_id: 'gpti-complete',
      content_version: GPTI_CONTENT_VERSION,
    }),
    createEvent('result_view', {
      result_type_internal: 'ATRB',
      result_name: '狂战士',
      hidden_trait_id: 'scripted_gambler',
      hidden_trait_name: '脚本赌徒',
      archive_code: 'ARCHIVE-024',
      confidence_avg: 0.62,
    }, {
      event_id: 'gpti-result-view',
      content_version: GPTI_CONTENT_VERSION,
    }),
  ], { updatedAt: '2026-05-23T12:00:00.000Z' });

  const question = records[COLLECTIONS.questionDaily].find((item) => item.channel === 'all' && item.question_id === 'q01');
  const result = records[COLLECTIONS.resultDaily].find((item) => item.channel === 'all' && item.result_type_internal === 'ATRB');
  const source = records[COLLECTIONS.sourceDaily].find((item) => (
    item.channel === 'all'
    && item.host === 'demo-phi-pearl.vercel.app'
    && item.content_version === GPTI_CONTENT_VERSION
  ));

  assert.equal(question.dimension, '');
  assert.deepEqual(question.option_distribution, { a: 1 });
  assert.equal(question.avg_time_spent_ms, 4800);
  assert.equal(result.result_name, '狂战士');
  assert.equal(result.avg_confidence, 0.62);
  assert.equal(result.avg_duration_ms, 93000);
  assert.equal(source.questions[0].dimension, '');
  assert.deepEqual(source.questions[0].option_distribution, { a: 1 });
  assert.equal(source.results[0].result_type_internal, 'ATRB');
  assert.equal(source.results[0].result_name, '狂战士');
});

test('aggregateEvents deduplicates repeated event_id values', () => {
  const duplicate = createEvent('page_view', { page_id: 'home' }, { event_id: 'same-id' });
  const records = aggregateEvents([duplicate, duplicate]);
  const all = records[COLLECTIONS.dailySummary].find((item) => item.channel === 'all');

  assert.equal(all.pv, 1);
});

test('aggregateEvents builds legacy source daily records by host and content version', () => {
  const records = aggregateEvents([
    createEvent('page_view', { page_id: 'home' }, {
      event_id: 'demo-content21-view',
      session_id: 'session-demo-21',
      anon_id: 'anon-demo-21',
      host: 'demo-phi-pearl.vercel.app',
      content_version: 'content-2026-05-21',
    }),
    createEvent('test_start', { page_id: 'home' }, {
      event_id: 'demo-content21-start',
      session_id: 'session-demo-21',
      anon_id: 'anon-demo-21',
      host: 'demo-phi-pearl.vercel.app',
      content_version: 'content-2026-05-21',
    }),
    createEvent('test_complete', { page_id: 'generating', duration_ms: 90000 }, {
      event_id: 'demo-content21-complete',
      session_id: 'session-demo-21',
      anon_id: 'anon-demo-21',
      host: 'demo-phi-pearl.vercel.app',
      content_version: 'content-2026-05-21',
    }),
    createEvent('page_view', { page_id: 'home' }, {
      event_id: 'cloudbase-content21-view',
      session_id: 'session-cloudbase-21',
      anon_id: 'anon-cloudbase-21',
      host: 'test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com',
      content_version: 'content-2026-05-21',
    }),
    createEvent('page_view', { page_id: 'home' }, {
      event_id: 'demo-content22-view',
      session_id: 'session-demo-22',
      anon_id: 'anon-demo-22',
      host: 'demo-phi-pearl.vercel.app',
      content_version: 'content-2026-05-22',
    }),
  ], { updatedAt: '2026-05-20T12:00:00.000Z' });

  const sourceRecords = records[COLLECTIONS.sourceDaily];
  const demoContent21 = sourceRecords.find((item) => (
    item.channel === 'all'
    && item.host === 'demo-phi-pearl.vercel.app'
    && item.content_version === 'content-2026-05-21'
  ));
  const demoContent22 = sourceRecords.find((item) => (
    item.channel === 'all'
    && item.host === 'demo-phi-pearl.vercel.app'
    && item.content_version === 'content-2026-05-22'
  ));
  const cloudbaseContent21 = sourceRecords.find((item) => (
    item.channel === 'all'
    && item.host === 'test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com'
    && item.content_version === 'content-2026-05-21'
  ));

  assert.equal(sourceRecords.length, 6);
  assert.equal(demoContent21.pv, 1);
  assert.equal(demoContent21.sessions, 1);
  assert.equal(demoContent21.test_start_sessions, 1);
  assert.equal(demoContent21.test_complete_sessions, 1);
  assert.equal(demoContent21.completion_rate, 1);
  assert.equal(demoContent22.pv, 1);
  assert.equal(cloudbaseContent21.pv, 1);
});

test('aggregateEvents embeds legacy source detail snapshots without cross-host mixing', () => {
  const records = aggregateEvents([
    createEvent('page_view', { page_id: 'home' }, {
      event_id: 'demo-view',
      session_id: 'session-demo',
      anon_id: 'anon-demo',
      host: 'demo-phi-pearl.vercel.app',
    }),
    createEvent('test_start', { page_id: 'home' }, {
      event_id: 'demo-start',
      session_id: 'session-demo',
      anon_id: 'anon-demo',
      host: 'demo-phi-pearl.vercel.app',
    }),
    createEvent('question_view', {
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      dimension: 'EI',
    }, {
      event_id: 'demo-question-view',
      session_id: 'session-demo',
      anon_id: 'anon-demo',
      host: 'demo-phi-pearl.vercel.app',
    }),
    createEvent('question_answer', {
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      dimension: 'EI',
      option_id: 'score_2',
      time_spent_ms: 5000,
    }, {
      event_id: 'demo-question-answer',
      session_id: 'session-demo',
      anon_id: 'anon-demo',
      host: 'demo-phi-pearl.vercel.app',
    }),
    createEvent('test_complete', {
      result_type_internal: 'ESTP',
      result_name: '上头战神',
      confidence_avg: 0.75,
      duration_ms: 120000,
    }, {
      event_id: 'demo-complete',
      session_id: 'session-demo',
      anon_id: 'anon-demo',
      host: 'demo-phi-pearl.vercel.app',
    }),
    createEvent('copy_share_click', { result_name: '上头战神' }, {
      event_id: 'demo-share',
      session_id: 'session-demo',
      anon_id: 'anon-demo',
      host: 'demo-phi-pearl.vercel.app',
    }),
    createEvent('page_view', { page_id: 'home' }, {
      event_id: 'cloud-view',
      session_id: 'session-cloud',
      anon_id: 'anon-cloud',
      host: 'test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com',
    }),
    createEvent('question_view', {
      question_id: 'q02',
      question_index: 2,
      chapter: 1,
      dimension: 'EI',
    }, {
      event_id: 'cloud-question-view',
      session_id: 'session-cloud',
      anon_id: 'anon-cloud',
      host: 'test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com',
    }),
    createEvent('question_answer', {
      question_id: 'q02',
      question_index: 2,
      chapter: 1,
      dimension: 'EI',
      option_id: 'score_-2',
      time_spent_ms: 3000,
    }, {
      event_id: 'cloud-question-answer',
      session_id: 'session-cloud',
      anon_id: 'anon-cloud',
      host: 'test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com',
    }),
  ], { updatedAt: '2026-05-20T12:00:00.000Z' });

  const demo = records[COLLECTIONS.sourceDaily].find((item) => (
    item.channel === 'all'
    && item.host === 'demo-phi-pearl.vercel.app'
    && item.content_version === 'content-2026-05-21'
  ));
  const cloud = records[COLLECTIONS.sourceDaily].find((item) => (
    item.channel === 'all'
    && item.host === 'test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com'
    && item.content_version === 'content-2026-05-21'
  ));

  assert.equal(demo.pv, 1);
  assert.equal(demo.summary.pv, 1);
  assert.equal(demo.funnel.steps.find((step) => step.key === 'question_answer_1').session_count, 1);
  assert.deepEqual(demo.questions.map((question) => question.question_id), ['q01']);
  assert.equal(demo.questions[0].answer_sessions, 1);
  assert.equal(demo.questions[0].avg_time_spent_ms, 5000);
  assert.equal(demo.results[0].result_name, '上头战神');
  assert.equal(demo.results[0].complete_sessions, 1);
  assert.equal(demo.share.action_counts.copy_share_click, 1);

  assert.deepEqual(cloud.questions.map((question) => question.question_id), ['q02']);
  assert.equal(cloud.questions[0].option_distribution['score_-2'], 1);
  assert.equal(cloud.share.share_intent_count, 0);
  assert.equal(JSON.stringify(demo).includes('session-demo'), false);
});

test('aggregateEvents maps missing source dimensions to unknown and excludes debug channels', () => {
  const records = aggregateEvents([
    createEvent('page_view', { page_id: 'home' }, {
      event_id: 'legacy-source',
      session_id: 'session-legacy',
      anon_id: 'anon-legacy',
      host: '',
      content_version: '',
    }),
    createEvent('page_view', { page_id: 'home' }, {
      event_id: 'debug-source',
      session_id: 'session-debug',
      anon_id: 'anon-debug',
      channel: 'debug_verify',
      host: 'demo-phi-pearl.vercel.app',
      content_version: 'content-2026-05-21',
    }),
  ]);

  const sourceRecords = records[COLLECTIONS.sourceDaily];
  const unknown = sourceRecords.find((item) => item.channel === 'all' && item.host === 'unknown' && item.content_version === 'unknown');

  assert.equal(sourceRecords.length, 2);
  assert.equal(unknown.pv, 1);
  assert.ok(!sourceRecords.some((item) => item.channel === 'debug_verify'));
});

test('resolveRollupRange uses Asia/Shanghai natural-day UTC boundaries', () => {
  const range = resolveRollupRange({ from: '2026-05-20', to: '2026-05-20' });

  assert.equal(range.startIso, '2026-05-19T16:00:00.000Z');
  assert.equal(range.endIso, '2026-05-20T16:00:00.000Z');
  assert.deepEqual(range.days, ['2026-05-20']);
});
