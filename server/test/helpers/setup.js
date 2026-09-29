// Shared test fixtures. Loaded first by every test file.
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Keep winston quiet and out of the project's logs/ folder
process.env.LOG_DIR = path.join(os.tmpdir(), 'esr-test-logs');
process.env.LOG_LEVEL = 'error';
process.env.NODE_ENV = 'production'; // disables console transport

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding:  { type: 'spki',  format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const baseConfig = (overrides = {}) => ({
  enabled: true,
  authUrl: 'https://iwcrcm.test/auth',
  dataUrl: 'https://iwcrcm.test/main',
  sendIntervalMinutes: 60,
  authRefreshBufferMinutes: 10,
  authKeyTtlHours: 24,
  challengeTtlSeconds: 120,
  publicKey,
  publicKeyFormat: '',
  encryptionScheme: 'pkcs1_oaep',
  scrambleModule: 'test',
  credentialSecret: 'x'.repeat(32),
  requestTimeoutMs: 200,
  httpRetries: 2,
  httpRetryBaseMs: 1,
  maxAttempts: 3,
  retryBackoffMinutes: 5,
  retryBackoffMaxMinutes: 360,
  batchSize: 50,
  flowMultiplier: 1,
  qtyMultiplier: 1,
  rollValue: 0,
  ...overrides,
});

// Logger that records every line so tests can assert nothing secret is logged
const fakeLogger = () => {
  const lines = [];
  const rec = (level) => (msg) => lines.push(`${level}: ${msg}`);
  return { lines, info: rec('info'), warn: rec('warn'), error: rec('error'), debug: rec('debug') };
};

// Fake fetch: `responses` is a list of { status, body, headers } | Error | 'timeout'
const fakeFetch = (responses) => {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const next = responses.length > 1 ? responses.shift() : responses[0];
    if (next === 'timeout') {
      return new Promise((_, reject) => {
        init.signal.addEventListener('abort', () => {
          const e = new Error('aborted'); e.name = 'AbortError'; reject(e);
        });
      });
    }
    if (next instanceof Error) throw next;
    const text = typeof next.body === 'string' ? next.body : JSON.stringify(next.body ?? '');
    return {
      status: next.status,
      headers: { get: (h) => (next.headers || {})[h.toLowerCase()] ?? null },
      text: async () => text,
    };
  };
  fn.calls = calls;
  return fn;
};

// In-memory credential store matching createMongoCredentialStore()
const memoryStore = () => {
  const data = new Map();
  let locked = false;
  return {
    data,
    async getKey(id) { return data.get(id) || null; },
    async hadKey(id) { return data.has(id); },
    async saveKey(id, key, expiresAt) { data.set(id, { key, expiresAt }); },
    async invalidate(id) { data.delete(id); },
    async recordFailure() {},
    async acquireLock() { if (locked) return false; locked = true; return true; },
    async releaseLock() { locked = false; },
    setLocked(v) { locked = v; },
  };
};

module.exports = { privateKey, publicKey, baseConfig, fakeLogger, fakeFetch, memoryStore };
