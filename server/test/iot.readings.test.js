require('./helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { getReadings, getChartData, resolveRange, pickBucketMinutes } = require('../src/modules/iot/iot.service');
const { readingsQuerySchema, chartQuerySchema } = require('../src/modules/iot/iot.validation');

const HOUR = 3600000;
const DAY = 24 * HOUR;

test('bucket size scales with the range', () => {
  assert.equal(pickBucketMinutes(DAY), 5);
  assert.equal(pickBucketMinutes(7 * DAY), 30);
  assert.equal(pickBucketMinutes(30 * DAY), 120);
  assert.equal(pickBucketMinutes(120 * DAY), 360);
});

test('range presets and custom ranges resolve; invalid ranges rejected', () => {
  const to = new Date('2026-09-30T12:00:00Z');
  assert.equal(to - resolveRange({ range: '4months', to }).start, 120 * DAY);
  assert.equal(to - resolveRange({ range: 'week', to }).start, 7 * DAY);
  assert.throws(() => resolveRange({ from: to, to: new Date(to - HOUR) }), /before/);
  assert.throws(() => resolveRange({ from: new Date(to - 200 * DAY), to }), /cannot exceed/);
});

test('query validation', () => {
  assert.equal(readingsQuerySchema.validate({}).value.limit, 50);
  assert.ok(readingsQuerySchema.validate({ limit: 6000 }).error);
  assert.ok(readingsQuerySchema.validate({ tankId: 'nope' }).error);
  assert.ok(readingsQuerySchema.validate({ from: '2026-09-30', to: '2026-09-01' }).error);
  assert.equal(chartQuerySchema.validate({}).value.range, 'day');
  assert.ok(chartQuerySchema.validate({ range: 'year' }).error);
});

const MONGO = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017';

test('MongoDB: readings pagination/filter and chart buckets', async (t) => {
  try {
    await mongoose.connect(`${MONGO}/esr_test_${crypto.randomBytes(4).toString('hex')}`, { serverSelectionTimeoutMS: 2000 });
  } catch {
    t.skip(`MongoDB not reachable at ${MONGO}`);
    return;
  }
  try {
    const Tank = require('../src/modules/tanks/tank.model');
    const LiveData = require('../src/modules/iot/iot.model');
    const [a, b] = await Tank.insertMany([
      { tankName: 'Tank A', deviceId: 'DA', location: 'x' },
      { tankName: 'Tank B', deviceId: 'DB', location: 'y' },
    ]);

    const now = Date.now();
    const docs = [];
    for (let i = 0; i < 60; i++) {
      docs.push({ tankId: a._id, deviceId: 'DA', flowRate: i, totalizer: i * 10, timestamp: new Date(now - i * HOUR) });
    }
    docs.push({ tankId: b._id, deviceId: 'DB', flowRate: 5, totalizer: 5, timestamp: new Date(now) });
    await LiveData.insertMany(docs);

    const p1 = await getReadings({ page: 1, limit: 25 });
    assert.equal(p1.pagination.total, 61);
    assert.equal(p1.pagination.pages, 3);
    assert.equal(p1.readings.length, 25);
    assert.ok(p1.readings[0].timestamp >= p1.readings[1].timestamp, 'newest first');
    assert.ok(p1.readings.every((r) => r.tankName));

    const onlyA = await getReadings({ tankId: String(a._id), page: 3, limit: 25 });
    assert.equal(onlyA.pagination.total, 60);
    assert.equal(onlyA.readings.length, 10);
    assert.ok(onlyA.readings.every((r) => r.tankName === 'Tank A'));

    const lastDay = await getReadings({ tankId: String(a._id), from: new Date(now - DAY + 1), to: new Date(now), limit: 100 });
    assert.equal(lastDay.pagination.total, 24);

    const week = await getChartData(String(a._id), { range: 'week', tz: 'Asia/Kolkata' });
    assert.equal(week.bucketMinutes, 30);
    assert.equal(week.timezone, 'Asia/Kolkata');
    assert.equal(week.points.reduce((s, p) => s + p.count, 0), 60);
    assert.ok(week.points.every((p, i, arr) => i === 0 || arr[i - 1].t < p.t), 'sorted ascending');

    const day = await getChartData(String(a._id), { range: 'day', tz: 'Not/AZone' });
    assert.equal(day.bucketMinutes, 5);
    assert.ok(day.points.length >= 23 && day.points.length <= 25);
  } finally {
    await mongoose.connection.dropDatabase().catch(() => {});
    await mongoose.disconnect();
  }
});
