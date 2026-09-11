import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  ALLOWED_CORS_ORIGINS,
  buildCorsHeaders,
  isCorsOriginAllowed,
} = require('../cloudbase/functions/analytics_collect/cors.js');

test('analytics_collect CORS allowlist contains production, CloudBase, and local origins', () => {
  assert.ok(ALLOWED_CORS_ORIGINS.includes('https://gameplayti.icu'));
  assert.ok(ALLOWED_CORS_ORIGINS.includes('https://demo-phi-pearl.vercel.app'));
  assert.ok(ALLOWED_CORS_ORIGINS.includes('https://test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com'));
  assert.ok(ALLOWED_CORS_ORIGINS.includes('http://localhost:5178'));
  assert.ok(ALLOWED_CORS_ORIGINS.includes('http://127.0.0.1:5178'));
});

test('analytics_collect echoes allowed browser origin with credentials support', () => {
  const headers = buildCorsHeaders('https://gameplayti.icu');

  assert.equal(headers['Access-Control-Allow-Origin'], 'https://gameplayti.icu');
  assert.equal(headers.Vary, 'Origin');
  assert.equal(headers['Access-Control-Allow-Credentials'], 'true');
  assert.equal(headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');
  assert.equal(headers['Access-Control-Allow-Headers'], 'Content-Type');
});

test('analytics_collect does not wildcard unknown browser origins', () => {
  assert.equal(isCorsOriginAllowed('https://malicious.example'), false);
  assert.deepEqual(buildCorsHeaders('https://malicious.example'), { Vary: 'Origin' });
});

test('analytics_collect allows non-browser calls without an Origin header', () => {
  assert.equal(isCorsOriginAllowed(''), true);
  assert.deepEqual(buildCorsHeaders(''), {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
});
