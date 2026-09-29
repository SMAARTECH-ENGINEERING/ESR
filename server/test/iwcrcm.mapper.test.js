const { baseConfig } = require('./helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSnapshot, buildPayload, IwcrcmValidationError,
} = require('../src/integrations/iwcrcm/iwcrcm.mapper');

const NOW = Date.parse('2026-09-29T10:30:00Z');
const tank = (iw = {}) => ({
  tankName: 'Tank A',
  deviceId: 'DEV-001',
  iwcrcm: { enabled: true, deviceId: 'TNXWFM003', longitude: 85.8245, latitude: 20.2961, ...iw },
});
const reading = (r = {}) => ({
  flowRate: 120.5, totalizer: 4500.25, timestamp: new Date('2026-09-29T09:59:00Z'), ...r,
});

test('valid payload: fields and order match the PDF', () => {
  const snap = buildSnapshot(tank(), reading(), baseConfig(), NOW);
  const p = buildPayload(snap, 'AUTHKEY', NOW);
  assert.deepEqual(Object.keys(p), ['id', 'loc', 'ts', 'flow', 'qty', 'roll', 'key']);
  assert.deepEqual(p, {
    id: 'TNXWFM003', loc: '85.8245,20.2961', ts: Date.parse('2026-09-29T09:59:00Z'),
    flow: 120.5, qty: 4500.25, roll: 0, key: 'AUTHKEY',
  });
});

test('uses the IWCRCM device id, never the local device id', () => {
  const snap = buildSnapshot(tank({ deviceId: 'ABC12345678' }), reading(), baseConfig(), NOW);
  assert.equal(snap.id, 'ABC12345678');
});

test('missing / invalid device id is rejected', () => {
  for (const deviceId of [undefined, '', 'TOOLONG12345', 'dev-001', 'ab c']) {
    assert.throws(() => buildSnapshot(tank({ deviceId }), reading(), baseConfig(), NOW), IwcrcmValidationError);
  }
});

test('invalid flow is rejected', () => {
  for (const flowRate of [-1, 'abc', null, undefined, NaN, Infinity, true]) {
    assert.throws(() => buildSnapshot(tank(), reading({ flowRate }), baseConfig(), NOW), IwcrcmValidationError);
  }
});

test('invalid quantity is rejected', () => {
  for (const totalizer of [-0.5, 'x', null]) {
    assert.throws(() => buildSnapshot(tank(), reading({ totalizer }), baseConfig(), NOW), IwcrcmValidationError);
  }
});

test('invalid timestamp is rejected', () => {
  for (const timestamp of ['not-a-date', null, new Date(NOW + 60 * 60 * 1000)]) {
    assert.throws(() => buildSnapshot(tank(), reading({ timestamp }), baseConfig(), NOW), IwcrcmValidationError);
  }
});

test('invalid location is rejected', () => {
  for (const iw of [{ longitude: 200 }, { latitude: -91 }, { longitude: null }, { latitude: undefined }, { longitude: 'x' }]) {
    assert.throws(() => buildSnapshot(tank(iw), reading(), baseConfig(), NOW), IwcrcmValidationError);
  }
  const snap = buildSnapshot(tank(), reading(), baseConfig(), NOW);
  assert.throws(() => buildPayload({ ...snap, loc: 'somewhere' }, 'K', NOW), IwcrcmValidationError);
});

test('missing auth key is rejected', () => {
  const snap = buildSnapshot(tank(), reading(), baseConfig(), NOW);
  assert.throws(() => buildPayload(snap, '', NOW), IwcrcmValidationError);
});

test('invalid roll is rejected', () => {
  assert.throws(() => buildSnapshot(tank(), reading(), baseConfig({ rollValue: 12 }), NOW), IwcrcmValidationError);
});

test('unit multipliers are applied', () => {
  const snap = buildSnapshot(tank(), reading(), baseConfig({ flowMultiplier: 0.06, qtyMultiplier: 0.001 }), NOW);
  assert.ok(Math.abs(snap.flow - 7.23) < 1e-9);
  assert.ok(Math.abs(snap.qty - 4.50025) < 1e-9);
});
