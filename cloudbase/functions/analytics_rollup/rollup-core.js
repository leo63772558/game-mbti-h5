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
const DEFAULT_EXCLUDED_CHANNEL_PREFIXES = ['e2e_', 'debug_', 'test_'];
const SHARE_EVENT_NAMES = [
  'generate_share_image_click',
  'save_image_click',
  'copy_share_click',
  'copy_test_link_click',
  'platform_share_click',
];

const FUNNEL_STEPS = [
  { key: 'page_view', label: 'page_view' },
  { key: 'test_start', label: 'test_start' },
  { key: 'question_answer_1', label: 'question_answer_1' },
  { key: 'question_answer_8', label: 'question_answer_8' },
  { key: 'question_answer_16', label: 'question_answer_16' },
  { key: 'question_answer_24', label: 'question_answer_24' },
  { key: 'test_complete', label: 'test_complete' },
  { key: 'result_view', label: 'result_view' },
  { key: 'share_actions', label: 'share_actions' },
];

function aggregateEvents(events, options = {}) {
  const includeTest = Boolean(options.includeTest);
  const excludedPrefixes = options.excludedChannelPrefixes ?? DEFAULT_EXCLUDED_CHANNEL_PREFIXES;
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const seenEventIds = new Set();
  const buckets = new Map();
  const sourceBuckets = new Map();

  for (const event of Array.isArray(events) ? events : []) {
    if (!event || typeof event !== 'object') continue;
    if (event.event_id && seenEventIds.has(event.event_id)) continue;
    if (event.event_id) seenEventIds.add(event.event_id);

    const channel = normalizeChannel(event.channel);
    if (!includeTest && isExcludedChannel(channel, excludedPrefixes)) continue;

    const date = getShanghaiDate(event.at ?? event.received_at);
    if (!date || !event.event_name) continue;

    const bucketChannels = channel === 'all' ? ['all'] : ['all', channel];
    const host = normalizeSourceValue(event.host);
    const contentVersion = normalizeSourceValue(event.content_version);
    for (const bucketChannel of bucketChannels) {
      const bucket = getBucket(buckets, date, bucketChannel);
      updateBucket(bucket, event);

      const sourceBucket = getSourceBucket(sourceBuckets, date, bucketChannel, host, contentVersion);
      updateSourceBucket(sourceBucket, event);
    }
  }

  return finalizeBuckets([...buckets.values()], [...sourceBuckets.values()], { updatedAt, includeTest, excludedPrefixes });
}

function getBucket(buckets, date, channel) {
  const key = `${date}__${channel}`;
  if (!buckets.has(key)) buckets.set(key, createBucket(date, channel));
  return buckets.get(key);
}

function createBucket(date, channel) {
  return {
    date,
    channel,
    summary: createSummaryState(),
    funnel: new Map(FUNNEL_STEPS.map((step) => [step.key, { ...step, eventCount: 0, sessions: new Set() }])),
    questions: new Map(),
    results: new Map(),
    share: {
      actionCounts: {},
      actionSessions: new Map(),
      shareSessions: new Set(),
      platformDistribution: {},
      resultDistribution: {},
    },
  };
}

function createSummaryState() {
  return {
    eventCounts: {},
    sourceEventCount: 0,
    anonIds: new Set(),
    sessionIds: new Set(),
    pageViewSessions: new Set(),
    testStartSessions: new Set(),
    testCompleteSessions: new Set(),
    resultViewSessions: new Set(),
    shareSessions: new Set(),
    completionDurationSum: 0,
    completionDurationCount: 0,
  };
}

function getSourceBucket(sourceBuckets, date, channel, host, contentVersion) {
  const key = `${date}__${channel}__${host}__${contentVersion}`;
  if (!sourceBuckets.has(key)) sourceBuckets.set(key, createSourceBucket(date, channel, host, contentVersion));
  return sourceBuckets.get(key);
}

function createSourceBucket(date, channel, host, contentVersion) {
  return {
    ...createBucket(date, channel),
    host,
    content_version: contentVersion,
  };
}

function updateBucket(bucket, event) {
  const eventName = event.event_name;
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const sessionId = typeof event.session_id === 'string' ? event.session_id : '';
  const anonId = typeof event.anon_id === 'string' ? event.anon_id : '';

  bucket.summary.sourceEventCount += 1;
  increment(bucket.summary.eventCounts, eventName);
  if (anonId) bucket.summary.anonIds.add(anonId);
  if (sessionId) bucket.summary.sessionIds.add(sessionId);

  updateSummary(bucket.summary, eventName, sessionId, payload);
  updateFunnel(bucket.funnel, eventName, sessionId, payload);
  updateQuestion(bucket.questions, eventName, sessionId, payload);
  updateResult(bucket.results, eventName, sessionId, payload);
  updateShare(bucket.share, eventName, sessionId, payload);
}

function updateSourceBucket(bucket, event) {
  updateBucket(bucket, event);
}

function updateSummary(summary, eventName, sessionId, payload) {
  if (eventName === 'page_view' && sessionId) summary.pageViewSessions.add(sessionId);
  if (eventName === 'test_start' && sessionId) summary.testStartSessions.add(sessionId);
  if (eventName === 'test_complete') {
    if (sessionId) summary.testCompleteSessions.add(sessionId);
    const duration = toFiniteNumber(payload.duration_ms);
    if (duration !== null) {
      summary.completionDurationSum += duration;
      summary.completionDurationCount += 1;
    }
  }
  if (eventName === 'result_view' && sessionId) summary.resultViewSessions.add(sessionId);
  if (SHARE_EVENT_NAMES.includes(eventName) && sessionId) summary.shareSessions.add(sessionId);
}

function updateFunnel(funnel, eventName, sessionId, payload) {
  markFunnelStep(funnel, eventName, sessionId);

  if (eventName === 'question_answer') {
    const questionIndex = Number(payload.question_index);
    if ([1, 8, 16, 24].includes(questionIndex)) {
      markFunnelStep(funnel, `question_answer_${questionIndex}`, sessionId);
    }
  }

  if (SHARE_EVENT_NAMES.includes(eventName)) markFunnelStep(funnel, 'share_actions', sessionId);
}

function markFunnelStep(funnel, stepKey, sessionId) {
  const step = funnel.get(stepKey);
  if (!step) return;
  step.eventCount += 1;
  if (sessionId) step.sessions.add(sessionId);
}

function updateQuestion(questions, eventName, sessionId, payload) {
  if (eventName !== 'question_view' && eventName !== 'question_answer') return;
  const questionIndex = Number(payload.question_index);
  const questionId = normalizeIdentifier(payload.question_id || (questionIndex ? `q${String(questionIndex).padStart(2, '0')}` : 'unknown'));
  const item = getQuestionBucket(questions, questionId);

  if (questionIndex) item.question_index = questionIndex;
  if (payload.chapter !== undefined) item.chapter = payload.chapter;
  if (payload.dimension !== undefined) item.dimension = String(payload.dimension);

  if (eventName === 'question_view') {
    item.view_count += 1;
    if (sessionId) item.view_sessions.add(sessionId);
    return;
  }

  item.answer_count += 1;
  if (sessionId) item.answer_sessions.add(sessionId);
  increment(item.option_distribution, normalizeIdentifier(payload.option_id || `score_${payload.score ?? 'unknown'}`));
  if (payload.is_change === true) item.change_count += 1;

  const timeSpent = toFiniteNumber(payload.time_spent_ms);
  if (timeSpent !== null) {
    item.time_spent_sum += timeSpent;
    item.time_spent_count += 1;
  }
}

function getQuestionBucket(questions, questionId) {
  if (!questions.has(questionId)) {
    questions.set(questionId, {
      question_id: questionId,
      question_index: 0,
      chapter: null,
      dimension: '',
      view_count: 0,
      view_sessions: new Set(),
      answer_count: 0,
      answer_sessions: new Set(),
      change_count: 0,
      time_spent_sum: 0,
      time_spent_count: 0,
      option_distribution: {},
    });
  }
  return questions.get(questionId);
}

function updateResult(results, eventName, sessionId, payload) {
  if (eventName !== 'test_complete' && eventName !== 'result_view') return;
  const resultName = normalizeDisplayValue(payload.result_name || '未知结果');
  const resultType = normalizeDisplayValue(payload.result_type_internal || 'unknown');
  const key = `${resultType}__${resultName}`;
  const item = getResultBucket(results, key, resultType, resultName);

  if (eventName === 'test_complete') {
    item.complete_count += 1;
    if (sessionId) item.complete_sessions.add(sessionId);

    const confidence = toFiniteNumber(payload.confidence_avg);
    if (confidence !== null) {
      item.confidence_sum += confidence;
      item.confidence_count += 1;
    }

    const duration = toFiniteNumber(payload.duration_ms);
    if (duration !== null) {
      item.duration_sum += duration;
      item.duration_count += 1;
    }
    return;
  }

  item.result_view_count += 1;
  if (sessionId) item.result_view_sessions.add(sessionId);
}

function getResultBucket(results, key, resultType, resultName) {
  if (!results.has(key)) {
    results.set(key, {
      result_type_internal: resultType,
      result_name: resultName,
      complete_count: 0,
      complete_sessions: new Set(),
      result_view_count: 0,
      result_view_sessions: new Set(),
      confidence_sum: 0,
      confidence_count: 0,
      duration_sum: 0,
      duration_count: 0,
    });
  }
  return results.get(key);
}

function updateShare(share, eventName, sessionId, payload) {
  if (!SHARE_EVENT_NAMES.includes(eventName)) return;

  increment(share.actionCounts, eventName);
  if (!share.actionSessions.has(eventName)) share.actionSessions.set(eventName, new Set());
  if (sessionId) {
    share.actionSessions.get(eventName).add(sessionId);
    share.shareSessions.add(sessionId);
  }

  if (eventName === 'platform_share_click') {
    increment(share.platformDistribution, normalizeIdentifier(payload.platform || 'unknown'));
  }
  if (payload.result_name) increment(share.resultDistribution, normalizeDisplayValue(payload.result_name));
}

function finalizeBuckets(buckets, sourceBuckets, options) {
  const dailySummary = [];
  const funnelDaily = [];
  const questionDaily = [];
  const resultDaily = [];
  const shareDaily = [];
  const sourceDaily = [];

  for (const bucket of buckets.sort(compareBucket)) {
    dailySummary.push(finalizeSummary(bucket, options));
    funnelDaily.push(finalizeFunnel(bucket, options));
    questionDaily.push(...finalizeQuestions(bucket, options));
    resultDaily.push(...finalizeResults(bucket, options));
    shareDaily.push(finalizeShare(bucket, options));
  }

  for (const bucket of sourceBuckets.sort(compareSourceBucket)) {
    sourceDaily.push(finalizeSourceSummary(bucket, options));
  }

  return {
    [COLLECTIONS.dailySummary]: dailySummary,
    [COLLECTIONS.funnelDaily]: funnelDaily,
    [COLLECTIONS.questionDaily]: questionDaily,
    [COLLECTIONS.resultDaily]: resultDaily,
    [COLLECTIONS.shareDaily]: shareDaily,
    [COLLECTIONS.sourceDaily]: sourceDaily,
  };
}

function finalizeSummary(bucket, options) {
  return {
    _id: makeDocId('summary', bucket.date, bucket.channel),
    date: bucket.date,
    channel: bucket.channel,
    timezone: TIMEZONE,
    ...buildSummaryMetrics(bucket.summary),
    excluded_channel_prefixes: options.includeTest ? [] : [...options.excludedPrefixes],
    updated_at: options.updatedAt,
  };
}

function finalizeSourceSummary(bucket, options) {
  const metrics = buildSummaryMetrics(bucket.summary);
  const funnel = finalizeFunnel(bucket, options);
  const questions = finalizeQuestions(bucket, options).map(stripEmbeddedRecord);
  const results = finalizeResults(bucket, options).map(stripEmbeddedRecord);
  const share = stripEmbeddedRecord(finalizeShare(bucket, options));

  return {
    _id: makeDocId('source', bucket.date, bucket.channel, bucket.host, bucket.content_version),
    date: bucket.date,
    channel: bucket.channel,
    host: bucket.host,
    content_version: bucket.content_version,
    timezone: TIMEZONE,
    ...metrics,
    summary: {
      ...metrics,
      event_counts: { ...metrics.event_counts },
    },
    funnel: {
      steps: funnel.steps,
    },
    questions,
    results,
    share,
    excluded_channel_prefixes: options.includeTest ? [] : [...options.excludedPrefixes],
    updated_at: options.updatedAt,
  };
}

function buildSummaryMetrics(summary) {
  const pageViewCount = summary.eventCounts.page_view ?? 0;
  const shareActionCount = SHARE_EVENT_NAMES.reduce((sum, name) => sum + (summary.eventCounts[name] ?? 0), 0);

  return {
    pv: pageViewCount,
    uv: summary.anonIds.size,
    sessions: summary.sessionIds.size,
    page_view_sessions: summary.pageViewSessions.size,
    test_start_count: summary.eventCounts.test_start ?? 0,
    test_start_sessions: summary.testStartSessions.size,
    test_complete_count: summary.eventCounts.test_complete ?? 0,
    test_complete_sessions: summary.testCompleteSessions.size,
    result_view_count: summary.eventCounts.result_view ?? 0,
    result_view_sessions: summary.resultViewSessions.size,
    share_action_count: shareActionCount,
    share_action_sessions: summary.shareSessions.size,
    start_rate: ratio(summary.testStartSessions.size, summary.pageViewSessions.size),
    completion_rate: ratio(summary.testCompleteSessions.size, summary.testStartSessions.size),
    result_share_rate: ratio(summary.shareSessions.size, summary.resultViewSessions.size),
    avg_completion_duration_ms: average(summary.completionDurationSum, summary.completionDurationCount),
    event_counts: { ...summary.eventCounts },
    source_event_count: summary.sourceEventCount,
  };
}

function stripEmbeddedRecord(record) {
  const {
    _id,
    date,
    channel,
    timezone,
    updated_at,
    ...rest
  } = record;
  return rest;
}

function finalizeFunnel(bucket, options) {
  const steps = FUNNEL_STEPS.map((step, index) => {
    const item = bucket.funnel.get(step.key);
    const previous = index > 0 ? bucket.funnel.get(FUNNEL_STEPS[index - 1].key) : null;
    const first = bucket.funnel.get(FUNNEL_STEPS[0].key);
    const sessionCount = item?.sessions.size ?? 0;
    return {
      key: step.key,
      label: step.label,
      event_count: item?.eventCount ?? 0,
      session_count: sessionCount,
      from_previous_rate: index === 0 ? 1 : ratio(sessionCount, previous?.sessions.size ?? 0),
      from_start_rate: index === 0 ? 1 : ratio(sessionCount, first?.sessions.size ?? 0),
    };
  });

  return {
    _id: makeDocId('funnel', bucket.date, bucket.channel),
    date: bucket.date,
    channel: bucket.channel,
    timezone: TIMEZONE,
    steps,
    updated_at: options.updatedAt,
  };
}

function finalizeQuestions(bucket, options) {
  return [...bucket.questions.values()]
    .sort((a, b) => (a.question_index || 999) - (b.question_index || 999) || a.question_id.localeCompare(b.question_id))
    .map((item) => ({
      _id: makeDocId('question', bucket.date, bucket.channel, item.question_id),
      date: bucket.date,
      channel: bucket.channel,
      timezone: TIMEZONE,
      question_id: item.question_id,
      question_index: item.question_index,
      chapter: item.chapter,
      dimension: item.dimension,
      view_count: item.view_count,
      view_sessions: item.view_sessions.size,
      answer_count: item.answer_count,
      answer_sessions: item.answer_sessions.size,
      answer_rate: ratio(item.answer_sessions.size, item.view_sessions.size),
      avg_time_spent_ms: average(item.time_spent_sum, item.time_spent_count),
      time_spent_count: item.time_spent_count,
      change_count: item.change_count,
      option_distribution: { ...item.option_distribution },
      updated_at: options.updatedAt,
    }));
}

function finalizeResults(bucket, options) {
  const totalCompleteSessions = [...bucket.results.values()].reduce((sum, item) => sum + item.complete_sessions.size, 0);

  return [...bucket.results.values()]
    .sort((a, b) => b.complete_sessions.size - a.complete_sessions.size || a.result_name.localeCompare(b.result_name))
    .map((item) => ({
      _id: makeDocId('result', bucket.date, bucket.channel, item.result_type_internal, item.result_name),
      date: bucket.date,
      channel: bucket.channel,
      timezone: TIMEZONE,
      result_type_internal: item.result_type_internal,
      result_name: item.result_name,
      complete_count: item.complete_count,
      complete_sessions: item.complete_sessions.size,
      result_view_count: item.result_view_count,
      result_view_sessions: item.result_view_sessions.size,
      share_of_completions: ratio(item.complete_sessions.size, totalCompleteSessions),
      avg_confidence: average(item.confidence_sum, item.confidence_count),
      confidence_count: item.confidence_count,
      avg_duration_ms: average(item.duration_sum, item.duration_count),
      duration_count: item.duration_count,
      updated_at: options.updatedAt,
    }));
}

function finalizeShare(bucket, options) {
  const actionSessions = {};
  for (const [name, sessions] of bucket.share.actionSessions.entries()) actionSessions[name] = sessions.size;

  return {
    _id: makeDocId('share', bucket.date, bucket.channel),
    date: bucket.date,
    channel: bucket.channel,
    timezone: TIMEZONE,
    share_intent_count: Object.values(bucket.share.actionCounts).reduce((sum, count) => sum + count, 0),
    share_intent_sessions: bucket.share.shareSessions.size,
    action_counts: { ...bucket.share.actionCounts },
    action_sessions: actionSessions,
    platform_distribution: { ...bucket.share.platformDistribution },
    result_distribution: { ...bucket.share.resultDistribution },
    updated_at: options.updatedAt,
  };
}

function resolveRollupRange(input = {}, options = {}) {
  const maxDays = Number(options.maxDays ?? 31);
  const today = options.today ?? getShanghaiDate(new Date());
  const requestedDays = Math.max(1, Math.min(Number(input.days ?? 2) || 2, maxDays));
  const to = assertDate(input.to || today, 'to');
  const from = assertDate(input.from || addDays(to, -(requestedDays - 1)), 'from');
  const days = listDates(from, to);

  if (!days.length) throw createInputError('invalid_date_range', '`from` must be before or equal to `to`.');
  if (days.length > maxDays) throw createInputError('date_range_too_large', `Date range cannot exceed ${maxDays} days.`);

  return {
    from,
    to,
    days,
    startIso: toUtcIsoForShanghaiDate(from),
    endIso: toUtcIsoForShanghaiDate(addDays(to, 1)),
    timezone: TIMEZONE,
  };
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

function toUtcIsoForShanghaiDate(dateText) {
  return new Date(Date.parse(`${assertDate(dateText, 'date')}T00:00:00+08:00`)).toISOString();
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

function isExcludedChannel(channel, prefixes = DEFAULT_EXCLUDED_CHANNEL_PREFIXES) {
  return prefixes.some((prefix) => channel.startsWith(prefix));
}

function normalizeChannel(value) {
  const channel = String(value || 'default_channel').trim();
  return /^[a-z0-9_-]{1,48}$/.test(channel) ? channel : 'default_channel';
}

function normalizeIdentifier(value) {
  return String(value || 'unknown').trim().slice(0, 80) || 'unknown';
}

function normalizeDisplayValue(value) {
  return String(value || 'unknown').trim().slice(0, 120) || 'unknown';
}

function normalizeSourceValue(value) {
  const text = String(value ?? '').trim();
  if (!text || !/^[\w.:-]{1,120}$/.test(text)) return 'unknown';
  return text;
}

function increment(target, key, amount = 1) {
  const safeKey = normalizeIdentifier(key);
  target[safeKey] = (target[safeKey] ?? 0) + amount;
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function average(sum, count) {
  if (!count) return 0;
  return Number((sum / count).toFixed(2));
}

function makeDocId(prefix, date, channel, ...parts) {
  return [prefix, date, channel, ...parts].map((part) => encodeDocIdPart(part)).join('__');
}

function encodeDocIdPart(value) {
  return String(value ?? 'unknown')
    .trim()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '_')
    .slice(0, 80) || 'unknown';
}

function compareBucket(a, b) {
  return a.date.localeCompare(b.date) || a.channel.localeCompare(b.channel);
}

function compareSourceBucket(a, b) {
  return (
    a.date.localeCompare(b.date)
    || a.channel.localeCompare(b.channel)
    || a.host.localeCompare(b.host)
    || a.content_version.localeCompare(b.content_version)
  );
}

function createInputError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = 400;
  return error;
}

module.exports = {
  COLLECTIONS,
  DEFAULT_EXCLUDED_CHANNEL_PREFIXES,
  FUNNEL_STEPS,
  SHARE_EVENT_NAMES,
  TIMEZONE,
  addDays,
  aggregateEvents,
  getShanghaiDate,
  isExcludedChannel,
  listDates,
  resolveRollupRange,
  toUtcIsoForShanghaiDate,
};
