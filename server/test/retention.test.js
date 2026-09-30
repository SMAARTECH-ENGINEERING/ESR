require('./helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const {
  getRetentionDays, getRetentionSeconds, getRetentionCutoff, getRetentionTargets,
  ensureTtlIndex, ensureRetentionIndexes, purgeExpiredData,
} = require('../src/config/retention');

const DAY = 86400000;

// ── Pure configuration ───────────────────────────────────────────────────────

test('default retention is 120 days = 10,368,000 seconds', () => {
  assert.equal(getRetentionDays({}), 120);
  assert.equal(getRetentionSeconds({}), 120 * 24 * 60 * 60);
  assert.equal(getRetentionSeconds({}), 10368000);
});

test('DATA_RETENTION_DAYS is configurable; invalid values fall back to 120', () => {
  assert.equal(getRetentionDays({ DATA_RETENTION_DAYS: '30' }), 30);
  for (const bad of ['0', '-5', 'abc', '1.5']) assert.equal(getRetentionDays({ DATA_RETENTION_DAYS: bad }), 120);
});

test('cutoff is exactly N days before now', () => {
  const now = new Date('2026-09-29T00:00:00Z');
  assert.equal(getRetentionCutoff(now, {}).getTime(), now.getTime() - 120 * DAY);
});

test('retention only targets high-volume history — never master/config data', () => {
  const labels = getRetentionTargets().map((t) => t.label).sort();
  assert.deepEqual(labels, ['iwcrcm_transmissions', 'live_data', 'report_data']);
  const collections = getRetentionTargets().map((t) => t.model.collection.collectionName);
  for (const protectedName of ['users', 'tanks', 'iwcrcm_credentials']) {
    assert.ok(!collections.includes(protectedName), `${protectedName} must not be purged`);
  }
});

test('ensureTtlIndex: replaces legacy 90-day index with the configured TTL', async () => {
  const indexes = [
    { name: '_id_', key: { _id: 1 } },
    { name: 'tankId_1_createdAt_-1', key: { tankId: 1, createdAt: -1 } },
    { name: 'ttl_report_data_3months', key: { createdAt: 1 }, expireAfterSeconds: 7776000 },
  ];
  const dropped = []; const created = [];
  const coll = {
    indexes: async () => indexes,
    dropIndex: async (n) => dropped.push(n),
    createIndex: async (k, o) => created.push({ k, o }),
  };
  await ensureTtlIndex(coll, { field: 'createdAt', indexName: 'ttl_new', legacyNames: ['ttl_report_data_3months'], seconds: 10368000 });
  assert.deepEqual(dropped, ['ttl_report_data_3months']);
  assert.deepEqual(created, [{ k: { createdAt: 1 }, o: { name: 'ttl_new', expireAfterSeconds: 10368000 } }]);
});

test('ensureTtlIndex: no-op when already correct', async () => {
  const coll = {
    indexes: async () => [{ name: 'ttl_new', key: { createdAt: 1 }, expireAfterSeconds: 10368000 }],
    dropIndex: async () => assert.fail('should not drop'),
    createIndex: async () => assert.fail('should not create'),
  };
  const r = await ensureTtlIndex(coll, { field: 'createdAt', indexName: 'ttl_new', seconds: 10368000 });
  assert.equal(r.changed, false);
});

// ── Real MongoDB (throwaway database) ────────────────────────────────────────

const MONGO = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = `esr_test_${crypto.randomBytes(4).toString('hex')}`;

test('MongoDB: 120-day retention end-to-end', async (t) => {
  try {
    await mongoose.connect(`${MONGO}/${dbName}`, { serverSelectionTimeoutMS: 2000, autoIndex: false });
  } catch {
    t.skip(`MongoDB not reachable at ${MONGO} — set TEST_MONGODB_URI to run`);
    return;
  }

  try {
    const User = require('../src/modules/auth/auth.model');
    const Tank = require('../src/modules/tanks/tank.model');
    const ReportData = require('../src/modules/reports/report.model');
    const Transmission = require('../src/integrations/iwcrcm/iwcrcm.transmission.model');
    const Credential = require('../src/integrations/iwcrcm/iwcrcm.credential.model');

    const LiveData = require('../src/modules/iot/iot.model');

    // Simulate the pre-existing production state: 90-day / 24h TTL indexes
    await ReportData.createCollection();
    await ReportData.collection.createIndex({ createdAt: 1 }, { name: 'ttl_report_data_3months', expireAfterSeconds: 7776000 });
    await LiveData.createCollection();
    await LiveData.collection.createIndex({ timestamp: 1 }, { name: 'ttl_live_data_24h', expireAfterSeconds: 86400 });

    await ensureRetentionIndexes();

    const liveTtl = (await LiveData.collection.indexes()).filter((i) => i.expireAfterSeconds !== undefined);
    assert.deepEqual(liveTtl.map((i) => [i.name, i.expireAfterSeconds]), [['ttl_live_data_retention', 10368000]]);

    const rdIdx = await ReportData.collection.indexes();
    const ttl = rdIdx.filter((i) => i.expireAfterSeconds !== undefined);
    assert.equal(ttl.length, 1, 'exactly one TTL index on report_data');
    assert.equal(ttl[0].name, 'ttl_report_data_retention');
    assert.equal(ttl[0].expireAfterSeconds, 10368000);
    assert.deepEqual(ttl[0].key, { createdAt: 1 });

    const txTtl = (await Transmission.collection.indexes()).find((i) => i.expireAfterSeconds !== undefined);
    assert.equal(txTtl.expireAfterSeconds, 10368000);

    // Idempotent on second start (another PM2 instance)
    await ensureRetentionIndexes();
    assert.equal((await ReportData.collection.indexes()).filter((i) => i.expireAfterSeconds !== undefined).length, 1);

    // Seed data
    const now = new Date();
    const old = new Date(now.getTime() - 121 * DAY);
    const recent = new Date(now.getTime() - 119 * DAY);
    const tankId = new mongoose.Types.ObjectId();

    await User.collection.insertOne({ name: 'Old Admin', email: 'old@test.local', createdAt: old });
    await Tank.collection.insertOne({ _id: tankId, tankName: 'Old Tank', deviceId: 'OLD1', location: 'x', createdAt: old });
    await Credential.collection.insertOne({ deviceId: 'OLD1', createdAt: old, updatedAt: old });

    const report = (createdAt) => ({ tankId, deviceId: 'OLD1', flowRate: 1, totalizer: 1, intervalTime: createdAt, createdAt });
    await ReportData.collection.insertMany([report(old), report(recent), report(now)]);
    const tx = (createdAt, i) => ({
      tankId, iwcrcmDeviceId: 'OLD1', slotStart: new Date(createdAt.getTime() + i), status: 'SUCCESS',
      snapshot: { id: 'OLD1', loc: '1,1', ts: 1, flow: 1, qty: 1, roll: 0 }, createdAt,
    });
    await Transmission.collection.insertMany([tx(old, 0), tx(recent, 1)]);
    const live = (timestamp) => ({ tankId, deviceId: 'OLD1', flowRate: 1, totalizer: 1, timestamp });
    await LiveData.collection.insertMany([live(old), live(recent), live(now)]);

    const { results } = await purgeExpiredData(undefined, now);
    assert.deepEqual(results, { live_data: 1, report_data: 1, iwcrcm_transmissions: 1 });
    assert.equal(await LiveData.countDocuments(), 2, 'readings newer than 120 days remain');

    assert.equal(await ReportData.countDocuments(), 2, 'data newer than 120 days remains');
    assert.equal(await ReportData.countDocuments({ createdAt: { $lt: getRetentionCutoff(now) } }), 0);
    assert.equal(await Transmission.countDocuments(), 1);
    assert.equal(await User.collection.countDocuments(), 1, 'users untouched');
    assert.equal(await Tank.collection.countDocuments(), 1, 'tanks untouched');
    assert.equal(await Credential.collection.countDocuments(), 1, 'credentials untouched');
  } finally {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
});
