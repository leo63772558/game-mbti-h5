import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  COLLECTIONS,
  buildDashboardResponse,
  hasDashboardSourceFilters,
  resolveDashboardRange,
} = require('../cloudbase/functions/dashboard_api/dashboard-data.js');

// Legacy aggregate fixtures intentionally keep the pre-GPTI analytics shape
// (`content-2026-05-21`, `dimension`, `score_*`) so dashboard aggregation
// remains compatible with historical rollup records. Current GPTI front-end
// payload assertions live in `tests/analytics.test.mjs`.
const LEGACY_CONTENT_VERSION = 'content-2026-05-21';
const GPTI_CONTENT_VERSION = 'content-2026-06-10-gpti-scoring-calibration-a';

test('buildDashboardResponse combines legacy aggregate records without exposing detail privacy fields', () => {
  const response = buildDashboardResponse({
    [COLLECTIONS.dailySummary]: [
      {
        date: '2026-05-20',
        channel: 'all',
        pv: 2,
        uv: 2,
        sessions: 2,
        page_view_sessions: 2,
        test_start_sessions: 1,
        test_complete_sessions: 1,
        result_view_sessions: 1,
        share_action_sessions: 1,
        test_complete_count: 1,
        avg_completion_duration_ms: 90000,
        event_counts: { page_view: 2, test_start: 1 },
        updated_at: '2026-05-20T12:00:00.000Z',
      },
    ],
    [COLLECTIONS.funnelDaily]: [
      {
        date: '2026-05-20',
        channel: 'all',
        steps: [
          { key: 'page_view', label: 'page_view', event_count: 2, session_count: 2 },
          { key: 'test_start', label: 'test_start', event_count: 1, session_count: 1 },
        ],
        updated_at: '2026-05-20T12:00:00.000Z',
      },
    ],
    [COLLECTIONS.questionDaily]: [
      {
        question_id: 'q01',
        question_index: 1,
        chapter: 1,
        dimension: 'EI',
        view_sessions: 2,
        answer_sessions: 1,
        avg_time_spent_ms: 5000,
        time_spent_count: 1,
        option_distribution: { score_2: 1 },
      },
    ],
    [COLLECTIONS.resultDaily]: [
      {
        result_type_internal: 'ESTP',
        result_name: '上头战神',
        complete_sessions: 1,
        confidence_count: 1,
        avg_confidence: 0.75,
      },
    ],
    [COLLECTIONS.shareDaily]: [
      {
        share_intent_count: 1,
        share_intent_sessions: 1,
        action_counts: { copy_share_click: 1 },
        action_sessions: { copy_share_click: 1 },
        platform_distribution: {},
      },
    ],
  }, {
    from: '2026-05-20',
    to: '2026-05-20',
    channel: 'all',
  });

  assert.equal(response.summary.pv, 2);
  assert.equal(response.summary.start_rate, 0.5);
  assert.equal(response.summary.completion_rate, 1);
  assert.equal(response.funnel[1].from_previous_rate, 0.5);
  assert.equal(response.questions[0].answer_rate, 0.5);
  assert.equal(response.results[0].share_of_completions, 1);
  assert.equal(response.share.action_counts.copy_share_click, 1);
  assert.equal(response.meta.source, 'aggregates');
  assert.doesNotMatch(JSON.stringify(response), /anon_id|session_id|payload/);
});

test('buildDashboardResponse can use legacy source daily records for host and content version filters', () => {
  const response = buildDashboardResponse({
    [COLLECTIONS.dailySummary]: [
      {
        date: '2026-05-20',
        channel: 'all',
        pv: 99,
        uv: 80,
        sessions: 70,
        page_view_sessions: 70,
        test_start_sessions: 50,
        test_complete_sessions: 25,
        result_view_sessions: 24,
        share_action_sessions: 12,
        updated_at: '2026-05-20T12:00:00.000Z',
      },
    ],
    [COLLECTIONS.funnelDaily]: [
      {
        steps: [
          { key: 'page_view', label: 'page_view', event_count: 99, session_count: 99 },
        ],
      },
    ],
    [COLLECTIONS.questionDaily]: [
      {
        question_id: 'q99',
        question_index: 99,
        view_sessions: 99,
        answer_sessions: 99,
      },
    ],
    [COLLECTIONS.resultDaily]: [
      {
        result_type_internal: 'MIXED',
        result_name: '混入口径',
        complete_sessions: 99,
      },
    ],
    [COLLECTIONS.shareDaily]: [
      {
        share_intent_count: 99,
        share_intent_sessions: 99,
        action_counts: { copy_share_click: 99 },
        action_sessions: { copy_share_click: 99 },
      },
    ],
    [COLLECTIONS.sourceDaily]: [
      {
        date: '2026-05-20',
        channel: 'all',
        host: 'demo-phi-pearl.vercel.app',
        content_version: LEGACY_CONTENT_VERSION,
        pv: 3,
        uv: 2,
        sessions: 2,
        page_view_sessions: 2,
        test_start_sessions: 2,
        test_complete_sessions: 1,
        result_view_sessions: 1,
        share_action_sessions: 1,
        source_event_count: 6,
        event_counts: { page_view: 3, test_start: 2, test_complete: 1 },
        funnel: {
          steps: [
            { key: 'page_view', label: 'page_view', event_count: 3, session_count: 2 },
            { key: 'test_start', label: 'test_start', event_count: 2, session_count: 2 },
          ],
        },
        questions: [
          {
            question_id: 'q01',
            question_index: 1,
            chapter: 1,
            dimension: 'EI',
            view_sessions: 2,
            answer_sessions: 1,
            avg_time_spent_ms: 5000,
            time_spent_count: 1,
            option_distribution: { score_2: 1 },
          },
        ],
        results: [
          {
            result_type_internal: 'ESTP',
            result_name: '上头战神',
            complete_sessions: 1,
            confidence_count: 1,
            avg_confidence: 0.75,
          },
        ],
        share: {
          share_intent_count: 1,
          share_intent_sessions: 1,
          action_counts: { save_image_click: 1 },
          action_sessions: { save_image_click: 1 },
          platform_distribution: {},
          result_distribution: { 上头战神: 1 },
        },
        updated_at: '2026-05-20T13:00:00.000Z',
      },
    ],
  }, {
    from: '2026-05-20',
    to: '2026-05-20',
    channel: 'all',
    host: 'demo-phi-pearl.vercel.app',
    contentVersion: LEGACY_CONTENT_VERSION,
  });

  assert.equal(response.range.host, 'demo-phi-pearl.vercel.app');
  assert.equal(response.range.contentVersion, LEGACY_CONTENT_VERSION);
  assert.equal(response.summary.pv, 3);
  assert.equal(response.summary.completion_rate, 0.5);
  assert.equal(response.source_summary.pv, 3);
  assert.equal(response.funnel[0].session_count, 2);
  assert.deepEqual(response.questions.map((question) => question.question_id), ['q01']);
  assert.equal(response.results[0].result_name, '上头战神');
  assert.equal(response.share.action_counts.save_image_click, 1);
  assert.equal(response.share.action_counts.copy_share_click, undefined);
  assert.equal(response.source_daily.summary.length, 1);
  assert.equal(response.source_daily.summary[0].source_event_count, 6);
  assert.equal(response.meta.summary_scope, 'source_daily');
  assert.equal(response.meta.detail_tables_scope, 'source_daily');
  assert.equal(response.meta.source_detail_coverage, 'full');
  assert.doesNotMatch(JSON.stringify(response), /anon_id|session_id|payload/);
});

test('buildDashboardResponse combines current GPTI aggregate records', () => {
  const response = buildDashboardResponse({
    [COLLECTIONS.dailySummary]: [{
      date: '2026-05-23',
      channel: 'wechat_group',
      pv: 1,
      uv: 1,
      sessions: 1,
      page_view_sessions: 1,
      test_start_sessions: 1,
      test_complete_sessions: 1,
      result_view_sessions: 1,
      share_action_sessions: 0,
      test_complete_count: 1,
      avg_completion_duration_ms: 93000,
      event_counts: { page_view: 1, test_start: 1, test_complete: 1 },
      updated_at: '2026-05-23T12:00:00.000Z',
    }],
    [COLLECTIONS.funnelDaily]: [{
      date: '2026-05-23',
      channel: 'wechat_group',
      steps: [
        { key: 'page_view', label: 'page_view', event_count: 1, session_count: 1 },
        { key: 'question_answer_1', label: 'question_answer_1', event_count: 1, session_count: 1 },
        { key: 'test_complete', label: 'test_complete', event_count: 1, session_count: 1 },
      ],
      updated_at: '2026-05-23T12:00:00.000Z',
    }],
    [COLLECTIONS.questionDaily]: [{
      question_id: 'q01',
      question_index: 1,
      chapter: 1,
      dimension: '',
      view_count: 1,
      view_sessions: 1,
      answer_count: 1,
      answer_sessions: 1,
      answer_rate: 1,
      avg_time_spent_ms: 4800,
      time_spent_count: 1,
      option_distribution: { a: 1 },
    }],
    [COLLECTIONS.resultDaily]: [{
      result_type_internal: 'ATRB',
      result_name: '狂战士',
      complete_count: 1,
      complete_sessions: 1,
      result_view_count: 1,
      result_view_sessions: 1,
      share_of_completions: 1,
      avg_confidence: 0.62,
      confidence_count: 1,
      avg_duration_ms: 93000,
      duration_count: 1,
    }],
    [COLLECTIONS.shareDaily]: [],
    [COLLECTIONS.sourceDaily]: [],
  }, {
    from: '2026-05-23',
    to: '2026-05-23',
    days: 1,
    channel: 'wechat_group',
    host: '',
    contentVersion: '',
    timezone: 'Asia/Shanghai',
  });

  assert.equal(response.ok, true);
  assert.equal(response.summary.completion_rate, 1);
  assert.deepEqual(response.questions[0].option_distribution, { a: 1 });
  assert.equal(response.questions[0].dimension, '');
  assert.equal(response.results[0].result_type_internal, 'ATRB');
  assert.equal(response.results[0].result_name, '狂战士');
  assert.equal(response.results[0].avg_confidence, 0.62);
});

test('buildDashboardResponse does not fallback to unfiltered details for legacy summary-only source records', () => {
  const response = buildDashboardResponse({
    [COLLECTIONS.dailySummary]: [],
    [COLLECTIONS.funnelDaily]: [
      {
        steps: [
          { key: 'page_view', label: 'page_view', event_count: 99, session_count: 99 },
        ],
      },
    ],
    [COLLECTIONS.questionDaily]: [
      {
        question_id: 'q99',
        question_index: 99,
        view_sessions: 99,
        answer_sessions: 99,
      },
    ],
    [COLLECTIONS.resultDaily]: [
      {
        result_type_internal: 'MIXED',
        result_name: '混入口径',
        complete_sessions: 99,
      },
    ],
    [COLLECTIONS.shareDaily]: [
      {
        share_intent_count: 99,
        share_intent_sessions: 99,
        action_counts: { copy_share_click: 99 },
        action_sessions: { copy_share_click: 99 },
      },
    ],
    [COLLECTIONS.sourceDaily]: [
      {
        date: '2026-05-20',
        channel: 'all',
        host: 'demo-phi-pearl.vercel.app',
        content_version: LEGACY_CONTENT_VERSION,
        pv: 1,
        uv: 1,
        sessions: 1,
        page_view_sessions: 1,
        test_start_sessions: 1,
        source_event_count: 2,
        event_counts: { page_view: 1, test_start: 1 },
        updated_at: '2026-05-20T13:00:00.000Z',
      },
    ],
  }, {
    from: '2026-05-20',
    to: '2026-05-20',
    channel: 'all',
    host: 'demo-phi-pearl.vercel.app',
  });

  assert.equal(response.summary.pv, 1);
  assert.deepEqual(response.funnel, []);
  assert.deepEqual(response.questions, []);
  assert.deepEqual(response.results, []);
  assert.equal(response.share.share_intent_count, 0);
  assert.equal(response.share.action_counts.copy_share_click, undefined);
  assert.equal(response.meta.detail_tables_scope, 'source_daily');
  assert.equal(response.meta.source_detail_coverage, 'missing');
});

test('resolveDashboardRange validates date range and channel', () => {
  const range = resolveDashboardRange({
    from: '2026-05-19',
    to: '2026-05-20',
    channel: 'wechat_group',
    host: 'demo-phi-pearl.vercel.app',
    contentVersion: LEGACY_CONTENT_VERSION,
  });

  assert.deepEqual(range.days, ['2026-05-19', '2026-05-20']);
  assert.equal(range.channel, 'wechat_group');
  assert.equal(range.host, 'demo-phi-pearl.vercel.app');
  assert.equal(range.contentVersion, LEGACY_CONTENT_VERSION);
  assert.throws(() => resolveDashboardRange({ from: '2026-05-21', to: '2026-05-20' }), /from/);
  assert.equal(resolveDashboardRange({ channel: '<script>' }).channel, 'all');
  assert.equal(resolveDashboardRange({ host: '<script>' }).host, '');
});

test('hasDashboardSourceFilters gates source daily reads to explicit filters', () => {
  assert.equal(hasDashboardSourceFilters({ channel: 'all' }), false);
  assert.equal(hasDashboardSourceFilters({ host: 'demo-phi-pearl.vercel.app' }), true);
  assert.equal(hasDashboardSourceFilters({ contentVersion: LEGACY_CONTENT_VERSION }), true);
});
