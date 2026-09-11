const crypto = require('crypto');
const http = require('http');
const { URL } = require('url');
const cloudbase = require('@cloudbase/node-sdk');
const {
  COLLECTIONS,
  buildDashboardResponse,
  hasDashboardSourceFilters,
  resolveDashboardRange,
} = require('./dashboard-data');
const { buildCorsHeaders } = require('./cors');

const app = cloudbase.init({
  env: cloudbase.SYMBOL_CURRENT_ENV,
});
const db = app.database();

const server = http.createServer(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'method_not_allowed' });

  try {
    requireDashboardToken(req);
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const maxDays = parsePositiveInteger(process.env.DASHBOARD_MAX_DAYS, 31);
    const range = resolveDashboardRange({
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
      channel: url.searchParams.get('channel') || 'all',
      host: url.searchParams.get('host') || '',
      contentVersion: url.searchParams.get('contentVersion') || '',
    }, { maxDays });
    const recordsByCollection = await fetchAggregateRecords(range);
    return sendJson(res, 200, buildDashboardResponse(recordsByCollection, range));
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return sendJson(res, statusCode, {
      ok: false,
      error: error.code || 'dashboard_api_failed',
      message: statusCode >= 500 ? 'Dashboard API failed.' : error.message,
    });
  }
});

server.listen(process.env.PORT || 9000, () => {
  console.log('dashboard_api listening');
});

async function fetchAggregateRecords(range) {
  const result = {};
  const hasSourceFilters = hasDashboardSourceFilters(range);

  for (const collectionName of Object.values(COLLECTIONS)) {
    if (hasSourceFilters && collectionName !== COLLECTIONS.sourceDaily) {
      result[collectionName] = [];
      continue;
    }
    if (!hasSourceFilters && collectionName === COLLECTIONS.sourceDaily) {
      result[collectionName] = [];
      continue;
    }
    result[collectionName] = await fetchCollectionRange(collectionName, range);
  }
  return result;
}

async function fetchCollectionRange(collectionName, range) {
  const collection = db.collection(collectionName);
  const command = db.command;
  if (!command?.gte) throw createError(500, 'db_command_unavailable', 'CloudBase database command API is unavailable.');

  const pageSize = parsePositiveInteger(process.env.DASHBOARD_PAGE_SIZE, 1000);
  const data = [];
  let offset = 0;

  while (true) {
    const where = {
      date: command.gte(range.from).and(command.lte(range.to)),
      channel: range.channel,
    };
    if (collectionName === COLLECTIONS.sourceDaily) {
      if (range.host) where.host = range.host;
      if (range.contentVersion) where.content_version = range.contentVersion;
    }

    const response = await collection
      .where(where)
      .orderBy('date', 'asc')
      .skip(offset)
      .limit(pageSize)
      .get();
    const page = Array.isArray(response?.data) ? response.data : [];
    data.push(...page);

    if (page.length < pageSize) break;
    offset += page.length;
  }

  return data;
}

function requireDashboardToken(req) {
  const expected = process.env.DASHBOARD_TOKEN;
  if (!expected) throw createError(500, 'dashboard_token_not_configured', 'DASHBOARD_TOKEN is not configured.');

  const token = getRequestToken(req);
  if (!token || !safeEqual(token, expected)) throw createError(401, 'unauthorized', 'Invalid dashboard token.');
}

function getRequestToken(req) {
  const auth = String(req.headers.authorization || '');
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return String(req.headers['x-dashboard-token'] || '').trim();
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function setCorsHeaders(req, res) {
  const headers = buildCorsHeaders(req.headers.origin || req.headers.Origin);
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(statusCode === 204 ? '' : JSON.stringify(data));
}

function parsePositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function createError(statusCode, code, message) {
  const error = new Error(message || code);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
