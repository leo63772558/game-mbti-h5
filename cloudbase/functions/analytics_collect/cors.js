const ALLOWED_CORS_ORIGINS = [
  'https://gameplayti.icu',
  'https://demo-phi-pearl.vercel.app',
  'https://test1264-d0gzi7ut615711548-1434258997.tcloudbaseapp.com',
  'http://localhost:5178',
  'http://127.0.0.1:5178',
];

const allowedOriginSet = new Set(ALLOWED_CORS_ORIGINS);

function normalizeOrigin(origin) {
  return String(origin || '').trim();
}

function isCorsOriginAllowed(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  return !normalizedOrigin || allowedOriginSet.has(normalizedOrigin);
}

function buildCorsHeaders(origin) {
  const normalizedOrigin = normalizeOrigin(origin);
  const headers = {
    Vary: 'Origin',
  };

  if (!isCorsOriginAllowed(normalizedOrigin)) {
    return headers;
  }

  headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type';

  if (normalizedOrigin) {
    headers['Access-Control-Allow-Origin'] = normalizedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

module.exports = {
  ALLOWED_CORS_ORIGINS,
  buildCorsHeaders,
  isCorsOriginAllowed,
};
