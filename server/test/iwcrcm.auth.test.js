const { baseConfig, fakeFetch, fakeLogger, memoryStore } = require('./helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('../src/integrations/iwcrcm/iwcrcm.client');
const { createAuthService, parseKeyResponse, parseExpiry, IwcrcmAuthError } = require('../src/integrations/iwcrcm/iwcrcm.auth');

const NOW = Date.parse('2026-09-29T10:00:00Z');
const inMinutes = (m) => new Date(NOW + m * 60000).toISOString();

// Stand-in for the provider's scramble algorithm (NOT the real one)
const testScramble = async ({ challengeKey }) => `resp-${challengeKey}`;

const setup = ({ responses, scramble = testScramble, now = () => NOW, store = memoryStore(), cfg = {} }) => {
  const config = baseConfig(cfg);
  const fetchImpl = fakeFetch(responses);
  const client = createClient({ config, fetchImpl, sleep: async () => {} });
  const logger = fakeLogger();
  const auth = createAuthService({ config, client, store, scramble, logger, now, sleep: async () => {}, lockWaitMs: 0 });
  return { auth, fetchImpl, logger, store };
};

const challengeOk = { status: 200, body: { newkey: { id: 'TNXWFM003', key: 'CHAL#1', expire: inMinutes(2) } } };
const authOk = { status: 200, body: { newkey: { id: 'TNXWFM003', key: 'SECRET-AUTH-KEY-999', expire: inMinutes(24 * 60) } } };

test('valid device: two-step handshake returns and caches the 24h key', async () => {
  const { auth, fetchImpl, store, logger } = setup({ responses: [challengeOk, authOk] });
  const key = await auth.getAuthKey('tnxwfm003');
  assert.equal(key, 'SECRET-AUTH-KEY-999');

  const [step1, step3] = fetchImpl.calls.map((c) => JSON.parse(c.init.body));
  assert.deepEqual(step1, { id: 'TNXWFM003', new: true });
  assert.deepEqual(step3, {
    id: 'TNXWFM003', Key_Type: 'Auth', Iot_Key: 'resp-CHAL#1', Dt_Expire: inMinutes(2), auth: true,
  });
  assert.equal(store.data.get('TNXWFM003').key, 'SECRET-AUTH-KEY-999');

  // Reused from memory until expiry — no further HTTP calls
  await auth.getAuthKey('TNXWFM003');
  assert.equal(fetchImpl.calls.length, 2);

  // Key must never appear in logs
  assert.ok(logger.lines.some((l) => l.includes('IWCRCM authentication required')));
  assert.ok(!logger.lines.join('\n').includes('SECRET-AUTH-KEY-999'));
  assert.ok(!logger.lines.join('\n').includes('CHAL#1'));
});

test('invalid device: /auth 403 on challenge → IwcrcmAuthError', async () => {
  const { auth } = setup({ responses: [{ status: 403 }] });
  await assert.rejects(auth.getAuthKey('UNKNOWN1'), (e) => e instanceof IwcrcmAuthError && e.kind === 'AUTH_REJECTED');
});

test('response for a different device id is rejected (no data mixing)', async () => {
  const wrong = { status: 200, body: { id: 'OTHER1', key: 'k', expire: inMinutes(2) } };
  const { auth } = setup({ responses: [wrong] });
  await assert.rejects(auth.getAuthKey('TNXWFM003'), /different device/);
});

test('expired challenge: handshake restarted once, then fails', async () => {
  const expired = { status: 200, body: { id: 'TNXWFM003', key: 'OLD', expire: inMinutes(-1) } };
  const { auth, fetchImpl } = setup({ responses: [expired] });
  await assert.rejects(auth.getAuthKey('TNXWFM003'), (e) => e.kind === 'CHALLENGE_EXPIRED');
  assert.equal(fetchImpl.calls.length, 2); // two challenge requests, no response submitted
});

test('expired challenge then fresh challenge → succeeds', async () => {
  const expired = { status: 200, body: { id: 'TNXWFM003', key: 'OLD', expire: inMinutes(-1) } };
  const { auth } = setup({ responses: [expired, challengeOk, authOk] });
  assert.equal(await auth.getAuthKey('TNXWFM003'), 'SECRET-AUTH-KEY-999');
});

test('invalid response code: server 403 on step 3 → IwcrcmAuthError', async () => {
  const { auth } = setup({ responses: [challengeOk, { status: 403 }] });
  await assert.rejects(auth.getAuthKey('TNXWFM003'), /response code rejected/);
});

test('missing scramble algorithm → CONFIG_ERROR, no network call', async () => {
  const { auth, fetchImpl } = setup({ responses: [challengeOk], scramble: null });
  await assert.rejects(auth.getAuthKey('TNXWFM003'), (e) => e.kind === 'CONFIG_ERROR' && e.retryable === false);
  assert.equal(fetchImpl.calls.length, 0);
});

test('expired auth key → re-authenticates and logs "key expired"', async () => {
  const store = memoryStore();
  await store.saveKey('TNXWFM003', 'STALE', new Date(NOW - 1000));
  const { auth, logger } = setup({ responses: [challengeOk, authOk], store });
  assert.equal(await auth.getAuthKey('TNXWFM003'), 'SECRET-AUTH-KEY-999');
  assert.ok(logger.lines.some((l) => l.includes('IWCRCM authentication key expired')));
});

test('key inside refresh buffer (10 min) is refreshed early', async () => {
  const store = memoryStore();
  await store.saveKey('TNXWFM003', 'ALMOST', new Date(NOW + 5 * 60000));
  const { auth, fetchImpl } = setup({ responses: [challengeOk, authOk], store });
  await auth.getAuthKey('TNXWFM003');
  assert.equal(fetchImpl.calls.length, 2);
});

test('unparseable expire → falls back to 24h from PDF', async () => {
  const noExpire = { status: 200, body: { id: 'TNXWFM003', key: 'K', expire: 'sometime' } };
  const { auth, store } = setup({ responses: [challengeOk, noExpire] });
  await auth.getAuthKey('TNXWFM003');
  assert.equal(store.data.get('TNXWFM003').expiresAt.getTime(), NOW + 24 * 3600 * 1000);
});

test('another process holds the lock → waits, then AUTH_IN_PROGRESS', async () => {
  const store = memoryStore();
  store.setLocked(true);
  const { auth } = setup({ responses: [challengeOk, authOk], store });
  await assert.rejects(auth.getAuthKey('TNXWFM003'), (e) => e.kind === 'AUTH_IN_PROGRESS');
});

test('parseKeyResponse accepts wrapped or flat body; parseExpiry handles formats', () => {
  assert.equal(parseKeyResponse({ id: 'A1', key: 'k', expire: 'x' }, 'A1', { requireExpire: true }).key, 'k');
  assert.equal(parseKeyResponse({ newkey: { key: 'k2', expire: 'x' } }, 'A1', { requireExpire: true }).key, 'k2');
  assert.throws(() => parseKeyResponse({ id: 'A1' }, 'A1', { requireExpire: false }), /no key/);
  assert.throws(() => parseKeyResponse({ key: 'k' }, 'A1', { requireExpire: true }), /no expire/);
  assert.equal(parseExpiry('2026-09-29T10:00:00Z').getTime(), NOW);
  assert.equal(parseExpiry(NOW).getTime(), NOW);
  assert.equal(parseExpiry('nonsense'), null);
});
