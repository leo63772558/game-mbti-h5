import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const {
  ALLOWED_CORS_ORIGINS,
  buildCorsHeaders,
  isCorsOriginAllowed,
} = require('../cloudbase/functions/dashboard_api/cors.js');

test('dashboard_api CORS allowlist contains production, CloudBase, and local origins', () => {
  assert.ok(ALLOWED_CORS_ORIGINS.includes('https://gameplayti.icu'));
  assert.ok(ALLOWED_CORS_ORIGINS.includes('https://demo-phi-pearl.vercel.app'));
  assert.ok(ALLOWED_CORS_ORIGINS.includes('https://test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com'));
  assert.ok(ALLOWED_CORS_ORIGINS.includes('http://localhost:5178'));
  assert.ok(ALLOWED_CORS_ORIGINS.includes('http://127.0.0.1:5178'));
});

test('dashboard_api echoes allowed browser origin for Authorization preflight', () => {
  const headers = buildCorsHeaders('https://gameplayti.icu');

  assert.equal(headers['Access-Control-Allow-Origin'], 'https://gameplayti.icu');
  assert.equal(headers.Vary, 'Origin');
  assert.equal(headers['Access-Control-Allow-Methods'], 'GET, OPTIONS');
  assert.equal(headers['Access-Control-Allow-Headers'], 'Content-Type, Authorization, X-Dashboard-Token');
});

test('dashboard_api does not wildcard unknown browser origins', () => {
  assert.equal(isCorsOriginAllowed('https://malicious.example'), false);
  assert.deepEqual(buildCorsHeaders('https://malicious.example'), { Vary: 'Origin' });
});

test('dashboard_api allows non-browser calls without an Origin header', () => {
  assert.equal(isCorsOriginAllowed(''), true);
  assert.deepEqual(buildCorsHeaders(''), {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Dashboard-Token',
  });
});

test('dashboard_api server applies CORS headers from the request Origin', () => {
  const source = readFileSync(new URL('../cloudbase/functions/dashboard_api/index.js', import.meta.url), 'utf8');

  assert.match(source, /buildCorsHeaders/);
  assert.match(source, /setCorsHeaders\(req,\s*res\)/);
  assert.match(source, /req\.headers\.origin\s*\|\|\s*req\.headers\.Origin/);
});
