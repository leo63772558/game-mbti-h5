const COLLECTIONS = {
  dailySummary: 'analytics_daily_summary',
  funnelDaily: 'analytics_funnel_daily',
  questionDaily: 'analytics_question_daily',
  resultDaily: 'analytics_result_daily',
  shareDaily: 'analytics_share_daily',
  sourceDaily: 'analytics_source_daily',
};

const TIMEZONE = 'Asia/Shanghai';
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function buildDashboardResponse(recordsByCollection, params = {}) {
  const range = {
    from: params.from,
    to: params.to,
    channel: params.channel || 'all',
    host: params.host || '',
    contentVersion: params.contentVersion || '',
    timezone: TIMEZONE,
  };
  const summaryRecords = recordsByCollection[COLLECTIONS.dailySummary] ?? [];
  const funnelRecords = recordsByCollection[COLLECTIONS.funnelDaily] ?? [];
  const questionRecords = recordsByCollection[COLLECTIONS.questionDaily] ?? [];
  const resultRecords = recordsByCollection[COLLECTIONS.resultDaily] ?? [];
  const shareRecords = recordsByCollection[COLLECTIONS.shareDaily] ?? [];
  const sourceRecords = recordsByCollection[COLLECTIONS.sourceDaily] ?? [];
  const hasSourceFilters = hasDashboardSourceFilters(range);
  const standardSummary = combineSummary(summaryRecords);
  const sourceSummary = combineSummary(sourceRecords);
  const detailRecords = hasSourceFilters
    ? getSourceDetailRecords(sourceRecords)
    : {
        funnel: funnelRecords,
        questions: questionRecords,
        results: resultRecords,
        share: shareRecords,
      };
  const lastRollupRecords = hasSourceFilters
    ? sourceRecords
    : [
        ...summaryRecords,
        ...funnelRecords,
        ...questionRecords,
        ...resultRecords,
        ...shareRecords,
      ];

  return {
    ok: true,
    range,
    summary: hasSourceFilters ? sourceSummary : standardSummary,
    source_summary: sourceSummary,
    funnel: combineFunnel(detailRecords.funnel),
    questions: combineQuestions(detailRecords.questions),
    results: combineResults(detailRecords.results),
    share: combineShare(detailRecords.share),
    daily: {
      summary: summaryRecords.map(pickSummary),
    },
    source_daily: {
      summary: sourceRecords.map(pickSourceSummary),
    },
    meta: {
      source: 'aggregates',
      summary_scope: hasSourceFilters ? 'source_daily' : 'date_channel',
      detail_tables_scope: hasSourceFilters ? 'source_daily' : 'date_channel',
      source_detail_coverage: hasSourceFilters ? getSourceDetailCoverage(sourceRecords) : undefined,
      uv_scope: range.from === range.to ? 'daily_exact' : 'sum_of_daily_uniques',
      excluded_channel_prefixes: ['e2e_', 'debug_', 'test_'],
      last_rollup_at: findLastUpdatedAt(lastRollupRecords),
    },
  };
}

function getSourceDetailRecords(sourceRecords) {
  return {
    funnel: sourceRecords
      .filter((record) => Array.isArray(record?.funnel?.steps))
      .map((record) => ({ steps: record.funnel.steps, updated_at: record.updated_at })),
    questions: sourceRecords.flatMap((record) => (Array.isArray(record?.questions) ? record.questions : [])),
    results: sourceRecords.flatMap((record) => (Array.isArray(record?.results) ? record.results : [])),
    share: sourceRecords
      .filter((record) => record?.share && typeof record.share === 'object' && !Array.isArray(record.share))
      .map((record) => record.share),
  };
}

function getSourceDetailCoverage(sourceRecords) {
  if (!sourceRecords.length) return 'empty';
  const coverage = sourceRecords.map(hasCompleteSourceDetail);
  if (coverage.every(Boolean)) return 'full';
  if (coverage.some(Boolean)) return 'partial';
  return 'missing';
}

function hasCompleteSourceDetail(record) {
  return (
    Array.isArray(record?.funnel?.steps)
    && Array.isArray(record?.questions)
    && Array.isArray(record?.results)
    && record?.share
    && typeof record.share === 'object'
    && !Array.isArray(record.share)
  );
}

function combineSummary(records) {
  const eventCounts = {};
  const summary = {
    pv: 0,
    uv: 0,
    sessions: 0,
    page_view_sessions: 0,
    test_start_count: 0,
    test_start_sessions: 0,
    test_complete_count: 0,
    test_complete_sessions: 0,
    result_view_count: 0,
    result_view_sessions: 0,
    share_action_count: 0,
    share_action_sessions: 0,
    avg_completion_duration_ms: 0,
    event_counts: eventCounts,
  };
  let durationWeightedSum = 0;
  let durationWeight = 0;

  for (const record of records) {
    summary.pv += number(record.pv);
    summary.uv += number(record.uv);
    summary.sessions += number(record.sessions);
    summary.page_view_sessions += number(record.page_view_sessions);
    summary.test_start_count += number(record.test_start_count);
    summary.test_start_sessions += number(record.test_start_sessions);
    summary.test_complete_count += number(record.test_complete_count);
    summary.test_complete_sessions += number(record.test_complete_sessions);
    summary.result_view_count += number(record.result_view_count);
    summary.result_view_sessions += number(record.result_view_sessions);
    summary.share_action_count += number(record.share_action_count);
    summary.share_action_sessions += number(record.share_action_sessions);
    mergeNumberMap(eventCounts, record.event_counts);

    const durationCount = number(record.test_complete_count);
    if (durationCount && number(record.avg_completion_duration_ms)) {
      durationWeightedSum += number(record.avg_completion_duration_ms) * durationCount;
      durationWeight += durationCount;
    }
  }

  summary.start_rate = ratio(summary.test_start_sessions, summary.page_view_sessions);
  summary.completion_rate = ratio(summary.test_complete_sessions, summary.test_start_sessions);
  summary.result_share_rate = ratio(summary.share_action_sessions, summary.result_view_sessions);
  summary.avg_completion_duration_ms = average(durationWeightedSum, durationWeight);
  return summary;
}

function combineFunnel(records) {
  const steps = new Map();

  for (const record of records) {
    for (const step of Array.isArray(record.steps) ? record.steps : []) {
      if (!steps.has(step.key)) {
        steps.set(step.key, {
          key: step.key,
          label: step.label || step.key,
          event_count: 0,
          session_count: 0,
        });
      }
      const target = steps.get(step.key);
      target.event_count += number(step.event_count);
      target.session_count += number(step.session_count);
    }
  }

  const ordered = [...steps.values()];
  const firstSessionCount = ordered[0]?.session_count ?? 0;
  return ordered.map((step, index) => {
    const previous = ordered[index - 1];
    return {
      ...step,
      from_previous_rate: index === 0 ? 1 : ratio(step.session_count, previous?.session_count ?? 0),
      from_start_rate: index === 0 ? 1 : ratio(step.session_count, firstSessionCount),
    };
  });
}

function combineQuestions(records) {
  const byQuestion = new Map();

  for (const record of records) {
    const key = record.question_id || 'unknown';
    if (!byQuestion.has(key)) {
      byQuestion.set(key, {
        question_id: key,
        question_index: number(record.question_index),
        chapter: record.chapter ?? null,
        dimension: String(record.dimension ?? ''),
        view_count: 0,
        view_sessions: 0,
        answer_count: 0,
        answer_sessions: 0,
        change_count: 0,
        time_spent_weighted_sum: 0,
        time_spent_weight: 0,
        option_distribution: {},
      });
    }
    const item = byQuestion.get(key);
    item.question_index = item.question_index || number(record.question_index);
    item.chapter = item.chapter ?? record.chapter ?? null;
    item.dimension = item.dimension || String(record.dimension ?? '');
    item.view_count += number(record.view_count);
    item.view_sessions += number(record.view_sessions);
    item.answer_count += number(record.answer_count);
    item.answer_sessions += number(record.answer_sessions);
    item.change_count += number(record.change_count);
    mergeNumberMap(item.option_distribution, record.option_distribution);

    const timeCount = number(record.time_spent_count);
    if (timeCount && number(record.avg_time_spent_ms)) {
      item.time_spent_weighted_sum += number(record.avg_time_spent_ms) * timeCount;
      item.time_spent_weight += timeCount;
    }
  }

  return [...byQuestion.values()]
    .map((item) => ({
      question_id: item.question_id,
      question_index: item.question_index,
      chapter: item.chapter,
      dimension: item.dimension,
      view_count: item.view_count,
      view_sessions: item.view_sessions,
      answer_count: item.answer_count,
      answer_sessions: item.answer_sessions,
      answer_rate: ratio(item.answer_sessions, item.view_sessions),
      avg_time_spent_ms: average(item.time_spent_weighted_sum, item.time_spent_weight),
      change_count: item.change_count,
      option_distribution: item.option_distribution,
    }))
    .sort((a, b) => (a.question_index || 999) - (b.question_index || 999) || a.question_id.localeCompare(b.question_id));
}

function combineResults(records) {
  const byResult = new Map();

  for (const record of records) {
    const key = `${record.result_type_internal || 'unknown'}__${record.result_name || '未知结果'}`;
    if (!byResult.has(key)) {
      byResult.set(key, {
        result_type_internal: record.result_type_internal || 'unknown',
        result_name: record.result_name || '未知结果',
        complete_count: 0,
        complete_sessions: 0,
        result_view_count: 0,
        result_view_sessions: 0,
        confidence_weighted_sum: 0,
        confidence_weight: 0,
        duration_weighted_sum: 0,
        duration_weight: 0,
      });
    }

    const item = byResult.get(key);
    item.complete_count += number(record.complete_count);
    item.complete_sessions += number(record.complete_sessions);
    item.result_view_count += number(record.result_view_count);
    item.result_view_sessions += number(record.result_view_sessions);

    const confidenceCount = number(record.confidence_count);
    if (confidenceCount && number(record.avg_confidence)) {
      item.confidence_weighted_sum += number(record.avg_confidence) * confidenceCount;
      item.confidence_weight += confidenceCount;
    }

    const durationCount = number(record.duration_count);
    if (durationCount && number(record.avg_duration_ms)) {
      item.duration_weighted_sum += number(record.avg_duration_ms) * durationCount;
      item.duration_weight += durationCount;
    }
  }

  const totalSessions = [...byResult.values()].reduce((sum, item) => sum + item.complete_sessions, 0);
  return [...byResult.values()]
    .map((item) => ({
      result_type_internal: item.result_type_internal,
      result_name: item.result_name,
      complete_count: item.complete_count,
      complete_sessions: item.complete_sessions,
      result_view_count: item.result_view_count,
      result_view_sessions: item.result_view_sessions,
      share_of_completions: ratio(item.complete_sessions, totalSessions),
      avg_confidence: average(item.confidence_weighted_sum, item.confidence_weight),
      avg_duration_ms: average(item.duration_weighted_sum, item.duration_weight),
    }))
    .sort((a, b) => b.complete_sessions - a.complete_sessions || a.result_name.localeCompare(b.result_name));
}

function combineShare(records) {
  const actionCounts = {};
  const actionSessions = {};
  const platformDistribution = {};
  const resultDistribution = {};
  const share = {
    share_intent_count: 0,
    share_intent_sessions: 0,
    action_counts: actionCounts,
    action_sessions: actionSessions,
    platform_distribution: platformDistribution,
    result_distribution: resultDistribution,
  };

  for (const record of records) {
    share.share_intent_count += number(record.share_intent_count);
    share.share_intent_sessions += number(record.share_intent_sessions);
    mergeNumberMap(actionCounts, record.action_counts);
    mergeNumberMap(actionSessions, record.action_sessions);
    mergeNumberMap(platformDistribution, record.platform_distribution);
    mergeNumberMap(resultDistribution, record.result_distribution);
  }

  return share;
}

function resolveDashboardRange(input = {}, options = {}) {
  const maxDays = Number(options.maxDays ?? 31);
  const today = options.today ?? getShanghaiDate(new Date());
  const to = assertDate(input.to || today, 'to');
  const from = assertDate(input.from || to, 'from');
  const days = listDates(from, to);

  if (!days.length) throw createInputError('invalid_date_range', '`from` must be before or equal to `to`.');
  if (days.length > maxDays) throw createInputError('date_range_too_large', `Date range cannot exceed ${maxDays} days.`);

  return {
    from,
    to,
    days,
    channel: normalizeChannel(input.channel || 'all'),
    host: normalizeSourceFilter(input.host),
    contentVersion: normalizeSourceFilter(input.contentVersion),
    timezone: TIMEZONE,
  };
}

function pickSummary(record) {
  return {
    date: record.date,
    channel: record.channel,
    pv: number(record.pv),
    uv: number(record.uv),
    sessions: number(record.sessions),
    test_start_sessions: number(record.test_start_sessions),
    test_complete_sessions: number(record.test_complete_sessions),
    result_view_sessions: number(record.result_view_sessions),
    share_action_sessions: number(record.share_action_sessions),
    completion_rate: number(record.completion_rate),
    result_share_rate: number(record.result_share_rate),
    updated_at: record.updated_at || '',
  };
}

function pickSourceSummary(record) {
  return {
    ...pickSummary(record),
    host: record.host || 'unknown',
    content_version: record.content_version || 'unknown',
    source_event_count: number(record.source_event_count),
  };
}

function findLastUpdatedAt(records) {
  return records
    .map((record) => String(record.updated_at || ''))
    .filter(Boolean)
    .sort()
    .at(-1) || '';
}

function normalizeChannel(value) {
  const channel = String(value || 'all').trim();
  return /^[a-z0-9_-]{1,48}$/.test(channel) ? channel : 'all';
}

function normalizeSourceFilter(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  return /^[\w.:-]{1,120}$/.test(text) ? text : '';
}

function hasDashboardSourceFilters(range = {}) {
  return Boolean(range.host || range.contentVersion);
}

function listDates(from, to) {
  const dates = [];
  let cursor = assertDate(from, 'from');
  const end = assertDate(to, 'to');
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function addDays(dateText, amount) {
  const time = Date.parse(`${dateText}T00:00:00.000Z`);
  return new Date(time + amount * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getShanghaiDate(value) {
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(String(value ?? ''));
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + SHANGHAI_OFFSET_MS).toISOString().slice(0, 10);
}

function assertDate(value, fieldName) {
  const text = String(value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00.000Z`))) {
    throw createInputError('invalid_date', `Invalid ${fieldName}. Expected YYYY-MM-DD.`);
  }
  return text;
}

function mergeNumberMap(target, source) {
  if (!source || typeof source !== 'object') return;
  for (const [key, value] of Object.entries(source)) target[key] = (target[key] ?? 0) + number(value);
}

function number(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function average(sum, count) {
  if (!count) return 0;
  return Number((sum / count).toFixed(2));
}

function createInputError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

module.exports = {
  COLLECTIONS,
  TIMEZONE,
  buildDashboardResponse,
  getShanghaiDate,
  hasDashboardSourceFilters,
  resolveDashboardRange,
};
