const http = require('http');
const cloudbase = require('@cloudbase/node-sdk');
const { buildCorsHeaders, isCorsOriginAllowed } = require('./cors');

const COLLECTION_NAME = 'analytics_events';
const MAX_EVENTS_PER_BATCH = 20;
const MAX_EVENT_BYTES = 8 * 1024;
const MAX_BODY_BYTES = 256 * 1024;

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

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});
const db = app.database();

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || req.headers.Origin || '';
  setCorsHeaders(res, origin);

  if (!isCorsOriginAllowed(origin)) {
    return sendJson(res, 403, { ok: false, error: 'origin_not_allowed' });
  }

  if (req.method === 'OPTIONS') {
    return sendJson(res, 204, {});
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const bodyText = await readBody(req);
    const body = JSON.parse(bodyText || '{}');
    const events = validateEvents(body.events);
    const receivedAt = new Date();
    const records = events.map((event) => ({
      ...event,
      received_at: receivedAt,
    }));

    await Promise.all(records.map((record) => db.collection(COLLECTION_NAME).add(record)));
    return sendJson(res, 200, { ok: true, accepted: records.length });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(res, status, {
      ok: false,
      error: error.code || 'internal_error',
    });
  }
});

server.listen(process.env.PORT || 9000, () => {
  console.log('analytics_collect listening');
});

function validateEvents(events) {
  if (!Array.isArray(events)) {
    throw createError(400, 'invalid_events');
  }
  if (!events.length || events.length > MAX_EVENTS_PER_BATCH) {
    throw createError(400, 'invalid_batch_size');
  }

  return events.map((event) => validateEvent(event));
}

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    throw createError(400, 'invalid_event');
  }
  if (!EVENT_WHITELIST.has(event.event_name)) {
    throw createError(400, 'invalid_event_name');
  }
  for (const key of ['event_id', 'session_id', 'anon_id']) {
    if (!event[key] || typeof event[key] !== 'string') {
      throw createError(400, `missing_${key}`);
    }
  }
  if (!event.payload || typeof event.payload !== 'object' || Array.isArray(event.payload)) {
    throw createError(400, 'invalid_payload');
  }
  if (Buffer.byteLength(JSON.stringify(event), 'utf8') > MAX_EVENT_BYTES) {
    throw createError(413, 'event_too_large');
  }

  return event;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let body = '';

    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      size += Buffer.byteLength(chunk, 'utf8');
      if (size > MAX_BODY_BYTES) {
        reject(createError(413, 'body_too_large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function setCorsHeaders(res, origin) {
  const headers = buildCorsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(statusCode === 204 ? '' : JSON.stringify(data));
}

function createError(statusCode, code) {
  const error = new Error(code);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
