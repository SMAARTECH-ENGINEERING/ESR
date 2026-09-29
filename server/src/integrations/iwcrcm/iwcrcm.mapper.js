// ─── Local reading → IWCRCM payload ───────────────────────────────────────────
// PDF /main payload: { id, loc, ts, flow, qty, roll, key }
// Parameter table: id ≤ 11 chars alphanumeric [A-Z][0-9]; loc = "longitude,latitude";
// ts = date/time in milliseconds; flow/qty numeric; roll numeric, max length 1.

const DEVICE_ID_PATTERN = /^[A-Z0-9]{1,11}$/;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;

class IwcrcmValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IwcrcmValidationError';
    this.code = 'VALIDATION_ERROR';
  }
}

const fail = (msg) => { throw new IwcrcmValidationError(msg); };

const validateDeviceId = (id) => {
  if (typeof id !== 'string' || !DEVICE_ID_PATTERN.test(id)) {
    fail(`Invalid IWCRCM device id "${id ?? ''}" — must be 1-11 characters [A-Z0-9]`);
  }
  return id;
};

// PDF: "loc: langitute,latitude" → longitude first
const formatLocation = (longitude, latitude) => {
  const lon = Number(longitude);
  const lat = Number(latitude);
  if (longitude === null || longitude === undefined || longitude === '' || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    fail('Invalid longitude — must be a number between -180 and 180');
  }
  if (latitude === null || latitude === undefined || latitude === '' || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    fail('Invalid latitude — must be a number between -90 and 90');
  }
  return `${lon},${lat}`;
};

const toTimestampMs = (value, now = Date.now()) => {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isInteger(ms) || ms <= 0) fail('Invalid timestamp');
  if (ms > now + MAX_FUTURE_SKEW_MS) fail('Invalid timestamp — in the future');
  return ms;
};

const toMeasurement = (value, name, multiplier = 1) => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') {
    fail(`Invalid ${name} — value is required`);
  }
  const n = Number(value) * multiplier;
  if (!Number.isFinite(n) || n < 0) fail(`Invalid ${name} — must be a non-negative number`);
  return n;
};

const toRoll = (value) => {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 9) fail('Invalid roll — must be a single digit (0-9)');
  return n;
};

/**
 * Snapshot of one local reading, as stored in the outbox. Contains no secrets.
 * @param {object} tank    Tank document (needs iwcrcm.deviceId/longitude/latitude)
 * @param {object} reading LiveData document (flowRate, totalizer, timestamp)
 */
const buildSnapshot = (tank, reading, config, now = Date.now()) => {
  const cfg = tank.iwcrcm || {};
  return {
    id:   validateDeviceId(cfg.deviceId),
    loc:  formatLocation(cfg.longitude, cfg.latitude),
    ts:   toTimestampMs(reading.timestamp, now),
    flow: toMeasurement(reading.flowRate,  'flow', config.flowMultiplier),
    qty:  toMeasurement(reading.totalizer, 'qty',  config.qtyMultiplier),
    roll: toRoll(config.rollValue),
  };
};

// Final payload — field order matches the PDF and therefore the hash input
const buildPayload = (snapshot, authKey, now = Date.now()) => {
  if (!authKey || typeof authKey !== 'string') fail('Missing IWCRCM auth key');
  return {
    id:   validateDeviceId(snapshot.id),
    loc:  typeof snapshot.loc === 'string' && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(snapshot.loc)
      ? snapshot.loc
      : fail('Invalid location — expected "longitude,latitude"'),
    ts:   toTimestampMs(snapshot.ts, now),
    flow: toMeasurement(snapshot.flow, 'flow'),
    qty:  toMeasurement(snapshot.qty,  'qty'),
    roll: toRoll(snapshot.roll),
    key:  authKey,
  };
};

module.exports = {
  DEVICE_ID_PATTERN,
  IwcrcmValidationError,
  validateDeviceId,
  formatLocation,
  toTimestampMs,
  buildSnapshot,
  buildPayload,
};
