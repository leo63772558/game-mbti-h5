const ANON_ID_KEY = 'guanghe_analytics_anon_id';
const SESSION_ID_KEY = 'guanghe_analytics_session_id';
const SESSION_COUNT_KEY = 'guanghe_analytics_session_event_count';
const QUEUE_KEY = 'guanghe_analytics_queue';

const DEFAULT_CONFIG = {
  endpoint: '',
  appVersion: 'dev',
  contentVersion: 'content-2026-06-10-gpti-scoring-calibration-a',
  channel: 'default_channel',
  debug: false,
  batchSize: 10,
  batchMaxEvents: 20,
  flushIntervalMs: 5000,
  maxQueueSize: 100,
  maxSessionEvents: 200,
};

const EVENT_WHITELIST = new Set([
  'page_view',
  'test_start',
  'rules_view',
  'question_view',
  'question_answer',
  'chapter_complete',
  'test_complete',
  'result_view',
  'generate_share_image_click',
  'share_overlay_view',
  'save_image_click',
  'copy_share_click',
  'copy_test_link_click',
  'platform_share_click',
  'restart_click',
  'error_show',
  'share_image_fallback',
  'copy_failed',
]);

let config = { ...DEFAULT_CONFIG };
let anonId = '';
let sessionId = '';
let queue = [];
let lastFlushAt = 0;
let lifecycleBound = false;
let activeFlush = null;

export function initAnalytics(nextConfig = {}) {
  config = {
    ...DEFAULT_CONFIG,
    ...nextConfig,
  };
  anonId = getOrCreateStoredId('localStorage', ANON_ID_KEY);
  sessionId = getOrCreateStoredId('sessionStorage', SESSION_ID_KEY);
  queue = readQueue().slice(-config.maxQueueSize);
  persistQueue();
  lastFlushAt = Date.now();
  bindLifecycleFlush();

  return {
    anonId,
    sessionId,
  };
}

export function track(eventName, payload = {}) {
  ensureInitialized();
  if (!EVENT_WHITELIST.has(eventName)) {
    if (config.debug) console.warn('[analytics] ignored unknown event', eventName);
    return false;
  }

  const currentCount = readSessionEventCount();
  if (currentCount >= config.maxSessionEvents) {
    if (config.debug) console.warn('[analytics] ignored event over session limit', eventName);
    return false;
  }

  const event = buildEvent(eventName, payload);
  queue.push(event);
  trimQueue();
  writeSessionEventCount(currentCount + 1);
  persistQueue();

  if (!config.endpoint || queue.length >= config.batchSize || Date.now() - lastFlushAt >= config.flushIntervalMs) {
    void flushAnalytics();
  }

  return true;
}

export function flushAnalytics() {
  if (activeFlush) return activeFlush;
  activeFlush = flushAnalyticsBatch().finally(() => {
    activeFlush = null;
  });
  return activeFlush;
}

async function flushAnalyticsBatch() {
  ensureInitialized();
  if (!queue.length) {
    return { ok: true, sent: 0 };
  }

  const events = queue.slice(0, config.batchMaxEvents);
  const batch = { events };

  if (!config.endpoint) {
    for (const event of events) {
      console.info('[analytics]', event.event_name, event);
    }
    queue = queue.slice(events.length);
    persistQueue();
    lastFlushAt = Date.now();
    return { ok: true, sent: events.length, local: true };
  }

  const ok = await sendBatch(batch);
  if (!ok) {
    return { ok: false, sent: 0 };
  }

  queue = queue.slice(events.length);
  persistQueue();
  lastFlushAt = Date.now();
  return { ok: true, sent: events.length };
}

function ensureInitialized() {
  if (!anonId || !sessionId) {
    initAnalytics(config);
  }
}

function buildEvent(eventName, payload) {
  const safePayload = sanitizePayload(payload);
  const viewport = getViewport();
  const pageId = safePayload.page_id ?? inferPageId(eventName);

  return {
    event_id: createId(),
    event_name: eventName,
    at: new Date().toISOString(),
    session_id: sessionId,
    anon_id: anonId,
    channel: config.channel,
    page_id: pageId,
    host: getLocationValue('host'),
    origin: getLocationOrigin(),
    path: getLocationValue('pathname'),
    query: getLocationValue('search'),
    referrer: getDocumentReferrer(),
    device_type: getDeviceType(),
    viewport,
    viewport_width: viewport.width,
    viewport_height: viewport.height,
    user_agent: getUserAgent(),
    browser_hint: getBrowserHint(),
    app_version: config.appVersion,
    content_version: config.contentVersion,
    payload: safePayload,
  };
}

async function sendBatch(batch) {
  const json = JSON.stringify(batch);
  const nav = getNavigator();

  try {
    if (typeof nav?.sendBeacon === 'function') {
      const body = typeof Blob === 'function' ? new Blob([json], { type: 'application/json' }) : json;
      if (nav.sendBeacon(config.endpoint, body)) return true;
    }
  } catch {
    // Fall through to fetch keepalive.
  }

  try {
    if (typeof globalThis.fetch !== 'function') return false;
    const response = await globalThis.fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json,
      keepalive: true,
    });
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

function bindLifecycleFlush() {
  if (lifecycleBound || typeof globalThis.addEventListener !== 'function') return;
  lifecycleBound = true;
  globalThis.addEventListener('pagehide', () => {
    void flushAnalytics();
  });
  globalThis.addEventListener('visibilitychange', () => {
    if (globalThis.document?.visibilityState === 'hidden') {
      void flushAnalytics();
    }
  });
}

function readQueue() {
  try {
    const raw = globalThis.localStorage?.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistQueue() {
  try {
    globalThis.localStorage?.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage may be unavailable in private browsing; in-memory queue still works.
  }
}

function trimQueue() {
  if (queue.length > config.maxQueueSize) {
    queue = queue.slice(queue.length - config.maxQueueSize);
  }
}

function getOrCreateStoredId(storageName, key) {
  const storage = globalThis[storageName];
  try {
    const existing = storage?.getItem(key);
    if (existing) return existing;
    const next = createId();
    storage?.setItem(key, next);
    return next;
  } catch {
    return createId();
  }
}

function readSessionEventCount() {
  try {
    return Number(globalThis.sessionStorage?.getItem(SESSION_COUNT_KEY) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeSessionEventCount(value) {
  try {
    globalThis.sessionStorage?.setItem(SESSION_COUNT_KEY, String(value));
  } catch {
    // Ignore unavailable sessionStorage.
  }
}

function createId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const random = Math.random().toString(16).slice(2);
  return `${Date.now().toString(16)}-${random}`;
}

function sanitizePayload(payload) {
  const value = payload && typeof payload === 'object' && !Array.isArray(payload) ? { ...payload } : {};

  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && item.length > 1000) {
      value[key] = item.slice(0, 1000);
    }
  }

  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= 8192) return value;
  } catch {
    return {};
  }

  return { oversized: true };
}

function inferPageId(eventName) {
  if (eventName.includes('question') || eventName === 'chapter_complete') return 'quiz';
  if (eventName.includes('result') || eventName.includes('share') || eventName.includes('copy') || eventName.includes('save')) return 'result';
  return 'home';
}

function getLocationValue(key) {
  return String(globalThis.location?.[key] ?? '');
}

function getLocationOrigin() {
  return String(globalThis.location?.origin ?? '');
}

function getDocumentReferrer() {
  return String(globalThis.document?.referrer ?? '');
}

function getViewport() {
  return {
    width: Number(globalThis.innerWidth ?? 0) || 0,
    height: Number(globalThis.innerHeight ?? 0) || 0,
  };
}

function getNavigator() {
  return globalThis.navigator;
}

function getUserAgent() {
  return String(getNavigator()?.userAgent ?? '');
}

function getDeviceType() {
  const ua = getUserAgent();
  const viewport = getViewport();
  if (/Mobile|Android|iPhone|iPad|iPod|MicroMessenger|MQQBrowser/i.test(ua)) return 'mobile';
  return viewport.width > 0 && viewport.width <= 768 ? 'mobile' : 'desktop';
}

function getBrowserHint() {
  const ua = getUserAgent();
  if (/MicroMessenger/i.test(ua)) return 'wechat';
  if (/\bQQ\b|MQQBrowser/i.test(ua)) return 'qq';
  if (/Edg\//i.test(ua)) return 'edge';
  if (/Chrome|CriOS/i.test(ua)) return 'chrome';
  if (/Safari/i.test(ua)) return 'safari';
  return 'other';
}
