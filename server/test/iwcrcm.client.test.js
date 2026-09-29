const { baseConfig, fakeFetch } = require('./helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createClient } = require('../src/integrations/iwcrcm/iwcrcm.client');

const noSleep = async () => {};
const client = (responses, cfg = {}) => {
  const fetchImpl = fakeFetch(responses);
  return { c: createClient({ config: baseConfig(cfg), fetchImpl, sleep: noSleep }), fetchImpl };
};

test('200 {"Action":"OK"} → success; body sent as text/plain', async () => {
  const { c, fetchImpl } = client([{ status: 200, body: { Action: 'OK' } }]);
  const r = await c.postData('BASE64CIPHER');
  assert.equal(r.ok, true);
  assert.equal(fetchImpl.calls[0].init.headers['Content-Type'], 'text/plain');
  assert.equal(fetchImpl.calls[0].init.body, 'BASE64CIPHER');
  assert.equal(fetchImpl.calls[0].url, 'https://iwcrcm.test/main');
});

test('200 without Action OK → INVALID_RESPONSE (retryable)', async () => {
  for (const body of [{ Action: 'NO' }, 'garbage', {}]) {
    const { c } = client([{ status: 200, body }]);
    const r = await c.postData('x');
    assert.equal(r.ok, false);
    assert.equal(r.kind, 'INVALID_RESPONSE');
    assert.equal(r.retryable, true);
  }
});

test('400 → BAD_REQUEST, not retried', async () => {
  const { c, fetchImpl } = client([{ status: 400, body: {} }]);
  const r = await c.postData('x');
  assert.equal(r.kind, 'BAD_REQUEST');
  assert.equal(r.retryable, false);
  assert.equal(fetchImpl.calls.length, 1);
});

test('401 / 403 → AUTH_REJECTED, not retried immediately', async () => {
  for (const status of [401, 403]) {
    const { c, fetchImpl } = client([{ status }]);
    const r = await c.postData('x');
    assert.equal(r.kind, 'AUTH_REJECTED');
    assert.equal(fetchImpl.calls.length, 1);
  }
});

test('404 → NOT_FOUND, not retryable', async () => {
  const { c } = client([{ status: 404 }]);
  const r = await c.postData('x');
  assert.equal(r.kind, 'NOT_FOUND');
  assert.equal(r.retryable, false);
});

test('429 → retried with bounded attempts and Retry-After honoured', async () => {
  const waits = [];
  const fetchImpl = fakeFetch([{ status: 429, headers: { 'retry-after': '2' } }]);
  const c = createClient({ config: baseConfig(), fetchImpl, sleep: async (ms) => waits.push(ms) });
  const r = await c.postData('x');
  assert.equal(r.kind, 'RATE_LIMITED');
  assert.equal(fetchImpl.calls.length, 3); // 1 + httpRetries(2)
  assert.deepEqual(waits, [2000, 2000]);
});

test('500 then 200 → retry succeeds', async () => {
  const { c, fetchImpl } = client([{ status: 500 }, { status: 200, body: { Action: 'OK' } }]);
  const r = await c.postData('x');
  assert.equal(r.ok, true);
  assert.equal(r.httpAttempts, 2);
  assert.equal(fetchImpl.calls.length, 2);
});

test('persistent 500 → SERVER_ERROR after bounded retries', async () => {
  const { c, fetchImpl } = client([{ status: 503 }]);
  const r = await c.postData('x');
  assert.equal(r.kind, 'SERVER_ERROR');
  assert.equal(r.retryable, true);
  assert.equal(fetchImpl.calls.length, 3);
});

test('network failure → NETWORK after bounded retries', async () => {
  const err = new TypeError('fetch failed');
  err.cause = { code: 'ECONNREFUSED' };
  const { c, fetchImpl } = client([err]);
  const r = await c.postData('x');
  assert.equal(r.kind, 'NETWORK');
  assert.equal(r.message, 'ECONNREFUSED');
  assert.equal(fetchImpl.calls.length, 3);
});

test('timeout on /main → TIMEOUT, NOT retried immediately (avoid duplicate submit)', async () => {
  const { c, fetchImpl } = client(['timeout'], { requestTimeoutMs: 20 });
  const r = await c.postData('x');
  assert.equal(r.kind, 'TIMEOUT');
  assert.equal(r.retryable, true);
  assert.equal(fetchImpl.calls.length, 1);
});

test('timeout on /auth → retried', async () => {
  const { c, fetchImpl } = client(['timeout', { status: 200, body: { id: 'A', key: 'k', expire: 'x' } }], { requestTimeoutMs: 20 });
  const r = await c.postAuth({ id: 'A', new: true });
  assert.equal(r.ok, true);
  assert.equal(fetchImpl.calls.length, 2);
  assert.equal(fetchImpl.calls[1].init.headers['Content-Type'], 'application/json');
});
