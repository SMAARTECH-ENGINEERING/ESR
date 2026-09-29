require('./helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTankSchema, updateTankSchema } = require('../src/modules/tanks/tank.validation');

const base = { tankName: 'Tank A', deviceId: 'DEV001', location: 'Bhubaneswar' };
const opts = { abortEarly: false, stripUnknown: true };

test('existing payloads without iwcrcm still validate (backward compatible)', () => {
  const { error, value } = createTankSchema.validate(base, opts);
  assert.equal(error, undefined);
  assert.equal(value.iwcrcm, undefined);
  assert.equal(updateTankSchema.validate({ location: 'New' }, opts).error, undefined);
});

test('iwcrcm enabled requires device id + coordinates', () => {
  const { error } = createTankSchema.validate({ ...base, iwcrcm: { enabled: true } }, opts);
  assert.ok(error);
  assert.ok(error.details.some((d) => /device ID is required/i.test(d.message)));
  assert.ok(error.details.some((d) => /Longitude is required/.test(d.message)));
  assert.ok(error.details.some((d) => /Latitude is required/.test(d.message)));
});

test('iwcrcm device id format enforced and upper-cased', () => {
  const ok = createTankSchema.validate({ ...base, iwcrcm: { enabled: true, deviceId: 'tnxwfm003', longitude: 85.8, latitude: 20.3 } }, opts);
  assert.equal(ok.error, undefined);
  assert.equal(ok.value.iwcrcm.deviceId, 'TNXWFM003');

  const bad = createTankSchema.validate({ ...base, iwcrcm: { enabled: true, deviceId: 'TOO-LONG-ID-1', longitude: 1, latitude: 1 } }, opts);
  assert.ok(bad.error);
});

test('iwcrcm disabled allows empty fields', () => {
  const { error } = updateTankSchema.validate({ iwcrcm: { enabled: false, deviceId: '', longitude: null, latitude: null } }, opts);
  assert.equal(error, undefined);
});
