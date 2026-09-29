const { privateKey, baseConfig, fakeFetch, fakeLogger } = require('./helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const NodeRSA = require('node-rsa');
const { createClient } = require('../src/integrations/iwcrcm/iwcrcm.client');
const { verifySignedBody } = require('../src/integrations/iwcrcm/iwcrcm.crypto');
const { IwcrcmAuthError } = require('../src/integrations/iwcrcm/iwcrcm.auth');
const {
  createIwcrcmService, getLastCompletedSlot, getNextScheduledAt, computeBackoffMs,
} = require('../src/integrations/iwcrcm/iwcrcm.service');

const NOW = new Date(2026, 8, 29, 10, 5, 0).getTime(); // local 10:05
const snapshot = { id: 'TNXWFM003', loc: '85.8245,20.2961', ts: NOW - 6 * 60000, flow: 120.5, qty: 4500, roll: 0 };

const fakeAuth = (keys = ['KEY-1', 'KEY-2']) => {
  const state = { calls: 0, invalidated: 0 };
  return {
    state,
    async getAuthKey() { return keys[Math.min(state.calls++, keys.length - 1)]; },
    async invalidate() { state.invalidated++; },
  };
};

const decrypt = (cipher) => JSON.parse(new NodeRSA(privateKey).decrypt(cipher, 'utf8'));

const makeService = ({ responses, auth = fakeAuth(), models = {}, cfg = {} }) => {
  const config = baseConfig(cfg);
  const fetchImpl = fakeFetch(responses);
  const client = createClient({ config, fetchImpl, sleep: async () => {} });
  const logger = fakeLogger();
  const service = createIwcrcmService({ config, auth, client, models, logger, now: () => NOW });
  return { service, fetchImpl, logger, auth };
};

// ── sendWaterData ────────────────────────────────────────────────────────────

test('sendWaterData: 200 OK — sends encrypted {payload, hash} with the auth key', async () => {
  const { service, fetchImpl } = makeService({ responses: [{ status: 200, body: { Action: 'OK' } }] });
  const r = await service.sendWaterData(snapshot);
  assert.equal(r.ok, true);

  const body = decrypt(fetchImpl.calls[0].init.body);
  assert.equal(verifySignedBody(body), true);
  assert.deepEqual(body.payload, { ...snapshot, key: 'KEY-1' });
});

test('sendWaterData: 403 → invalidates key, re-auths ONCE, succeeds', async () => {
  const { service, auth, fetchImpl } = makeService({
    responses: [{ status: 403 }, { status: 200, body: { Action: 'OK' } }],
  });
  const r = await service.sendWaterData(snapshot);
  assert.equal(r.ok, true);
  assert.equal(r.authRefreshed, true);
  assert.equal(auth.state.invalidated, 1);
  assert.equal(decrypt(fetchImpl.calls[1].init.body).payload.key, 'KEY-2');
});

test('sendWaterData: persistent 403 → stops after one refresh (no loop)', async () => {
  const { service, fetchImpl } = makeService({ responses: [{ status: 403 }] });
  const r = await service.sendWaterData(snapshot);
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'AUTH_REJECTED');
  assert.equal(fetchImpl.calls.length, 2);
});

test('sendWaterData: 400 → non-retryable failure', async () => {
  const { service } = makeService({ responses: [{ status: 400 }] });
  const r = await service.sendWaterData(snapshot);
  assert.equal(r.kind, 'BAD_REQUEST');
  assert.equal(r.retryable, false);
});

test('sendWaterData: missing device id → VALIDATION_ERROR, nothing sent', async () => {
  const { service, fetchImpl } = makeService({ responses: [{ status: 200, body: { Action: 'OK' } }] });
  const r = await service.sendWaterData({ ...snapshot, id: undefined });
  assert.equal(r.kind, 'VALIDATION_ERROR');
  assert.equal(fetchImpl.calls.length, 0);
});

test('sendWaterData: invalid public key → CRYPTO_ERROR, nothing sent', async () => {
  const { service, fetchImpl } = makeService({ responses: [{ status: 200 }], cfg: { publicKey: 'bad' } });
  const r = await service.sendWaterData(snapshot);
  assert.equal(r.kind, 'CRYPTO_ERROR');
  assert.equal(fetchImpl.calls.length, 0);
});

test('sendWaterData: auth failure is reported, not thrown', async () => {
  const auth = { async getAuthKey() { throw new IwcrcmAuthError('boom', { kind: 'NETWORK', retryable: true }); }, async invalidate() {} };
  const { service } = makeService({ responses: [{ status: 200 }], auth });
  const r = await service.sendWaterData(snapshot);
  assert.equal(r.kind, 'AUTH:NETWORK');
  assert.equal(r.retryable, true);
  assert.equal(r.authFailure, true);
});

// ── Outbox processing (in-memory Transmission fake) ──────────────────────────

const fakeTransmissions = (records) => {
  const matches = (r, f, t) => {
    if (f.iwcrcmDeviceId && f.iwcrcmDeviceId.$nin.includes(r.iwcrcmDeviceId)) return false;
    return (r.status === 'PENDING' && r.nextAttemptAt <= t) || (r.status === 'SENT' && r.lockedUntil < t);
  };
  return {
    records,
    findOneAndUpdate(filter, update) {
      const t = filter.$or[0].nextAttemptAt.$lte;
      const r = records.filter((x) => matches(x, filter, t)).sort((a, b) => a.slotStart - b.slotStart)[0];
      if (r) { Object.assign(r, update.$set); r.attempts += update.$inc.attempts; }
      return { lean: async () => (r ? { ...r } : null) };
    },
    async updateOne({ _id }, update) { Object.assign(records.find((x) => x._id === _id), update.$set); },
  };
};

const rec = (i, extra = {}) => ({
  _id: i, iwcrcmDeviceId: 'TNXWFM003', slotStart: new Date(NOW - (10 - i) * 3600000),
  snapshot, status: 'PENDING', attempts: 0, nextAttemptAt: new Date(NOW - 1000), lockedUntil: null, ...extra,
});

test('processDue: success marks SUCCESS', async () => {
  const Transmission = fakeTransmissions([rec(1)]);
  const { service, logger } = makeService({ responses: [{ status: 200, body: { Action: 'OK' } }], models: { Transmission } });
  const s = await service.processDue();
  assert.equal(s.success, 1);
  assert.equal(Transmission.records[0].status, 'SUCCESS');
  assert.ok(logger.lines.some((l) => l.includes('IWCRCM data sent successfully')));
});

test('processDue: 500 → PENDING with backoff; attempts exhausted → FAILED', async () => {
  const Transmission = fakeTransmissions([rec(1), rec(2, { attempts: 2 })]);
  const { service, logger } = makeService({ responses: [{ status: 500 }], models: { Transmission } });
  const s = await service.processDue();
  const [a, b] = Transmission.records;
  assert.equal(a.status, 'PENDING');
  assert.equal(a.nextAttemptAt.getTime(), NOW + 5 * 60000);
  assert.equal(a.lastErrorKind, 'SERVER_ERROR');
  assert.equal(b.status, 'FAILED'); // attempt 3 of maxAttempts 3
  assert.equal(b.nextAttemptAt, null);
  assert.deepEqual([s.retrying, s.failed], [1, 1]);
  assert.ok(logger.lines.some((l) => l.includes('IWCRCM transmission failed')));
});

test('processDue: 400 → FAILED immediately (no retry)', async () => {
  const Transmission = fakeTransmissions([rec(1)]);
  const { service } = makeService({ responses: [{ status: 400 }], models: { Transmission } });
  await service.processDue();
  assert.equal(Transmission.records[0].status, 'FAILED');
});

test('processDue: auth rejection blocks the rest of that device this tick', async () => {
  const Transmission = fakeTransmissions([rec(1), rec(2), rec(3)]);
  const { service, fetchImpl } = makeService({ responses: [{ status: 403 }], models: { Transmission } });
  const s = await service.processDue();
  assert.equal(s.processed, 1);
  assert.equal(fetchImpl.calls.length, 2); // original + one refresh
  assert.deepEqual(Transmission.records.map((r) => r.status), ['PENDING', 'PENDING', 'PENDING']);
  assert.equal(Transmission.records[1].attempts, 0);
});

test('processDue: 429 stops the whole batch', async () => {
  const Transmission = fakeTransmissions([rec(1), rec(2)]);
  const { service } = makeService({ responses: [{ status: 429, headers: { 'retry-after': '600' } }], models: { Transmission }, cfg: { httpRetries: 0 } });
  const s = await service.processDue();
  assert.equal(s.processed, 1);
  // Retry-After (10 min) is longer than the 5-min base backoff, so it wins
  assert.equal(Transmission.records[0].nextAttemptAt.getTime(), NOW + 600000);
  assert.equal(Transmission.records[1].status, 'PENDING');
  assert.equal(Transmission.records[1].attempts, 0);
});

test('processDue: crashed in-flight (SENT, lock expired) is reclaimed', async () => {
  const Transmission = fakeTransmissions([rec(1, { status: 'SENT', attempts: 1, lockedUntil: new Date(NOW - 1) })]);
  const { service } = makeService({ responses: [{ status: 200, body: { Action: 'OK' } }], models: { Transmission } });
  await service.processDue();
  assert.equal(Transmission.records[0].status, 'SUCCESS');
});

// ── Enqueue ──────────────────────────────────────────────────────────────────

const chain = (value) => ({ sort: () => ({ lean: async () => value }), lean: async () => value });

test('enqueueSlot: one record per enabled tank, device data never mixed', async () => {
  const tanks = [
    { _id: 't1', tankName: 'A', iwcrcm: { enabled: true, deviceId: 'DEVA', longitude: 85, latitude: 20 } },
    { _id: 't2', tankName: 'B', iwcrcm: { enabled: true, deviceId: 'DEVB', longitude: 86, latitude: 21 } },
    { _id: 't3', tankName: 'C', iwcrcm: { enabled: true, deviceId: 'DEVC', longitude: 86, latitude: 21 } }, // no data
    { _id: 't4', tankName: 'D', iwcrcm: { enabled: true, deviceId: 'bad id', longitude: 86, latitude: 21 } },
  ];
  const readings = {
    t1: { flowRate: 1, totalizer: 10, timestamp: new Date(NOW - 10 * 60000) },
    t2: { flowRate: 2, totalizer: 20, timestamp: new Date(NOW - 20 * 60000) },
    t4: { flowRate: 4, totalizer: 40, timestamp: new Date(NOW - 20 * 60000) },
  };
  const upserts = [];
  const models = {
    Tank: { find: () => ({ lean: async () => tanks }) },
    LiveData: { findOne: (q) => chain(readings[q.tankId] || null) },
    Transmission: { updateOne: async (f, u) => { upserts.push(u.$setOnInsert); return { upsertedCount: 1 }; } },
  };
  const { service } = makeService({ responses: [{ status: 200 }], models });
  const s = await service.enqueueSlot(NOW);

  assert.deepEqual([s.queued, s.skippedNoData, s.invalid], [2, 1, 1]);
  assert.deepEqual(upserts.map((u) => [u.iwcrcmDeviceId, u.snapshot.qty]), [['DEVA', 10], ['DEVB', 20]]);
  assert.ok(upserts.every((u) => !('key' in u.snapshot)));
});

// ── Scheduling helpers ───────────────────────────────────────────────────────

test('slots align to local time: at 10:05 the completed 60-min slot is 09:00-10:00', () => {
  const { slotStart, slotEnd } = getLastCompletedSlot(NOW, 60);
  assert.equal(slotStart.getHours(), 9);
  assert.equal(slotEnd.getHours(), 10);
  assert.equal(slotEnd.getMinutes(), 0);
  assert.equal(getNextScheduledAt(NOW, 60).getHours(), 11);
  assert.equal(getLastCompletedSlot(NOW, 15).slotEnd.getMinutes(), 0);
});

test('backoff grows exponentially and is capped', () => {
  const cfg = baseConfig();
  assert.equal(computeBackoffMs(1, cfg), 5 * 60000);
  assert.equal(computeBackoffMs(3, cfg), 20 * 60000);
  assert.equal(computeBackoffMs(20, cfg), 360 * 60000);
  assert.equal(computeBackoffMs(1, cfg, 3600000), 3600000);
});
