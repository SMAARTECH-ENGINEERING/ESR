const defaultLogger = require('../../config/logger');
const { loadConfig, getConfigIssues, isValidInterval } = require('./iwcrcm.config');
const { createClient } = require('./iwcrcm.client');
const {
  createAuthService, createMongoCredentialStore, loadScrambleModule, IwcrcmAuthError,
} = require('./iwcrcm.auth');
const { buildSignedBody, encryptBody, IwcrcmCryptoError } = require('./iwcrcm.crypto');
const {
  buildSnapshot, buildPayload, validateDeviceId, IwcrcmValidationError,
} = require('./iwcrcm.mapper');

// ─── Slot helpers (send interval aligned to local midnight) ──────────────────

const getLastCompletedSlot = (nowMs, intervalMinutes) => {
  const midnight = new Date(nowMs);
  midnight.setHours(0, 0, 0, 0);
  const minutesSinceMidnight = Math.floor((nowMs - midnight.getTime()) / 60000);
  const endMinute = Math.floor(minutesSinceMidnight / intervalMinutes) * intervalMinutes;
  const slotEnd = new Date(midnight.getTime() + endMinute * 60000);
  return { slotStart: new Date(slotEnd.getTime() - intervalMinutes * 60000), slotEnd };
};

const getNextScheduledAt = (nowMs, intervalMinutes) =>
  new Date(getLastCompletedSlot(nowMs, intervalMinutes).slotEnd.getTime() + intervalMinutes * 60000);

const computeBackoffMs = (attempts, config, retryAfterMs = 0) => {
  const minutes = Math.min(
    config.retryBackoffMinutes * 2 ** Math.max(0, attempts - 1),
    config.retryBackoffMaxMinutes
  );
  return Math.max(minutes * 60000, retryAfterMs || 0);
};

// Converts thrown errors into the same result shape the HTTP client returns
const errorToResult = (err) => {
  if (err instanceof IwcrcmValidationError) {
    return { ok: false, kind: 'VALIDATION_ERROR', retryable: false, message: err.message };
  }
  if (err instanceof IwcrcmCryptoError) {
    return { ok: false, kind: 'CRYPTO_ERROR', retryable: false, message: err.message };
  }
  if (err instanceof IwcrcmAuthError) {
    return { ok: false, kind: `AUTH:${err.kind}`, status: err.status, retryable: err.retryable, message: err.message, authFailure: true };
  }
  return { ok: false, kind: 'INTERNAL_ERROR', retryable: true, message: err.message };
};

// ─── Service factory (dependencies injectable for tests) ─────────────────────

const createIwcrcmService = ({
  config,
  auth,
  client,
  models,
  logger = defaultLogger,
  now = () => Date.now(),
  configIssues = [],
}) => {
  const { Tank, LiveData, Transmission } = models;

  /**
   * Send one reading to IWCRCM /main.
   * validate → auth key → payload → SHA256 → RSA → POST → handle response.
   * On 401/403 the key is discarded and the send is retried ONCE with a fresh key.
   */
  const sendWaterData = async (snapshot) => {
    try {
      const deviceId = validateDeviceId(snapshot && snapshot.id);
      let refreshed = false;

      for (;;) {
        const key = await auth.getAuthKey(deviceId);
        const payload = buildPayload(snapshot, key, now());
        const encrypted = encryptBody(buildSignedBody(payload), config);
        const result = await client.postData(encrypted);

        if (result.ok || result.kind !== 'AUTH_REJECTED' || refreshed) {
          return { ...result, authRefreshed: refreshed };
        }

        logger.warn(`IWCRCM authentication key expired or rejected [${deviceId}] (HTTP ${result.status}) — re-authenticating once`);
        await auth.invalidate(deviceId);
        refreshed = true;
      }
    } catch (err) {
      return errorToResult(err);
    }
  };

  // ── Outbox: enqueue ────────────────────────────────────────────────────────

  const enqueueSlot = async (nowMs = now()) => {
    const { slotStart, slotEnd } = getLastCompletedSlot(nowMs, config.sendIntervalMinutes);
    const tanks = await Tank.find({ 'iwcrcm.enabled': true }).lean();
    const summary = { slotStart, queued: 0, skippedNoData: 0, invalid: 0 };

    for (const tank of tanks) {
      const reading = await LiveData.findOne({
        tankId: tank._id,
        timestamp: { $gte: slotStart, $lt: slotEnd },
      }).sort({ timestamp: -1 }).lean();

      if (!reading) {
        summary.skippedNoData++;
        continue;
      }

      let snapshot;
      try {
        snapshot = buildSnapshot(tank, reading, config, nowMs);
      } catch (err) {
        summary.invalid++;
        logger.warn(`IWCRCM skipped tank [${tank.tankName}]: ${err.message}`);
        continue;
      }

      try {
        const res = await Transmission.updateOne(
          { tankId: tank._id, slotStart },
          {
            $setOnInsert: {
              tankId: tank._id,
              iwcrcmDeviceId: snapshot.id,
              slotStart,
              snapshot,
              status: 'PENDING',
              attempts: 0,
              nextAttemptAt: new Date(nowMs),
              createdAt: new Date(nowMs),
            },
          },
          { upsert: true }
        );
        if (res.upsertedCount) summary.queued++;
      } catch (err) {
        if (err.code !== 11000) throw err; // another instance queued it first
      }
    }
    return summary;
  };

  // ── Outbox: process due records ────────────────────────────────────────────

  const processDue = async ({ limit = config.batchSize } = {}) => {
    const blockedDevices = new Set();
    const summary = { processed: 0, success: 0, retrying: 0, failed: 0 };
    const lockMs = (config.requestTimeoutMs * (config.httpRetries + 1)) * 4 + 60000;

    while (summary.processed < limit) {
      const t = new Date(now());
      const record = await Transmission.findOneAndUpdate(
        {
          iwcrcmDeviceId: { $nin: [...blockedDevices] },
          $or: [
            { status: 'PENDING', nextAttemptAt: { $lte: t } },
            { status: 'SENT', lockedUntil: { $lt: t } }, // crashed mid-send → reclaim
          ],
        },
        {
          $set: { status: 'SENT', lockedUntil: new Date(t.getTime() + lockMs), lastAttemptAt: t },
          $inc: { attempts: 1 },
        },
        { sort: { slotStart: 1 }, new: true }
      ).lean();
      if (!record) break;

      summary.processed++;
      const result = await sendWaterData(record.snapshot);
      const done = new Date(now());

      if (result.ok) {
        await Transmission.updateOne({ _id: record._id }, {
          $set: {
            status: 'SUCCESS', succeededAt: done, lockedUntil: null, nextAttemptAt: null,
            lastHttpStatus: result.status, lastErrorKind: null, lastError: null,
          },
        });
        summary.success++;
        logger.info(`IWCRCM data sent successfully [${record.iwcrcmDeviceId}] slot=${record.slotStart.toISOString()} attempt=${record.attempts}`);
        continue;
      }

      const permanent = !result.retryable || record.attempts >= config.maxAttempts;
      await Transmission.updateOne({ _id: record._id }, {
        $set: {
          status: permanent ? 'FAILED' : 'PENDING',
          lockedUntil: null,
          nextAttemptAt: permanent ? null : new Date(done.getTime() + computeBackoffMs(record.attempts, config, result.retryAfterMs)),
          lastHttpStatus: result.status ?? null,
          lastErrorKind: result.kind,
          lastError: String(result.message || result.kind).slice(0, 500),
        },
      });
      if (permanent) summary.failed++;
      else summary.retrying++;
      logger.error(
        `IWCRCM transmission failed [${record.iwcrcmDeviceId}] slot=${record.slotStart.toISOString()} ` +
        `kind=${result.kind} status=${result.status ?? '-'} attempt=${record.attempts}/${config.maxAttempts} ` +
        `→ ${permanent ? 'FAILED (no more retries)' : 'will retry'}`
      );

      // Don't hammer IWCRCM: skip the rest of this device (auth problems) or
      // the whole batch (rate limited) until the next tick.
      if (result.authFailure || result.kind === 'AUTH_REJECTED' || result.kind === 'CRYPTO_ERROR') {
        blockedDevices.add(record.iwcrcmDeviceId);
      }
      if (result.kind === 'RATE_LIMITED') break;
    }
    return summary;
  };

  // ── One scheduler tick ─────────────────────────────────────────────────────

  let lastEnqueuedSlot = null;

  const tick = async () => {
    if (!config.enabled || !isValidInterval(config.sendIntervalMinutes)) return null;

    const nowMs = now();
    const { slotStart } = getLastCompletedSlot(nowMs, config.sendIntervalMinutes);
    let enqueued = null;
    if (lastEnqueuedSlot !== slotStart.getTime()) {
      enqueued = await enqueueSlot(nowMs);
      lastEnqueuedSlot = slotStart.getTime();
      if (enqueued.queued) logger.info(`IWCRCM queued ${enqueued.queued} reading(s) for slot ${slotStart.toISOString()}`);
    }

    // Data keeps being queued (never lost) but nothing is sent until the
    // configuration is complete.
    if (configIssues.length) return { enqueued, processed: null };
    return { enqueued, processed: await processDue() };
  };

  // ── Admin status ───────────────────────────────────────────────────────────

  const getStatus = async ({ Credential } = {}) => {
    const tanks = await Tank.find({ 'iwcrcm.deviceId': { $type: 'string' } })
      .select('tankName deviceId iwcrcm status')
      .sort({ tankName: 1 })
      .lean();
    const tankIds = tanks.map((t) => t._id);
    const deviceIds = tanks.map((t) => t.iwcrcm.deviceId);

    const [stats, creds] = await Promise.all([
      Transmission.aggregate([
        { $match: { tankId: { $in: tankIds } } },
        { $sort: { lastAttemptAt: -1 } },
        {
          $group: {
            _id: '$tankId',
            lastAttemptAt: { $max: '$lastAttemptAt' },
            lastSuccessAt: { $max: '$succeededAt' },
            lastStatus:    { $first: '$status' },
            lastErrorKind: { $first: '$lastErrorKind' },
            lastError:     { $first: '$lastError' },
            pending:  { $sum: { $cond: [{ $in: ['$status', ['PENDING', 'SENT']] }, 1, 0] } },
            retrying: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'PENDING'] }, { $gt: ['$attempts', 0] }] }, 1, 0] } },
            failed:   { $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] } },
            success:  { $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] } },
          },
        },
      ]),
      Credential
        ? Credential.find({ deviceId: { $in: deviceIds } })
          .select('deviceId authKeyExpiresAt lastAuthAt lastAuthError authFailures')
          .lean()
        : [],
    ]);

    const statsByTank = new Map(stats.map((s) => [String(s._id), s]));
    const credByDevice = new Map(creds.map((c) => [c.deviceId, c]));
    const nextScheduledAt = config.enabled && isValidInterval(config.sendIntervalMinutes)
      ? getNextScheduledAt(now(), config.sendIntervalMinutes)
      : null;

    return {
      enabled: config.enabled,
      configReady: configIssues.length === 0,
      configIssues,
      sendIntervalMinutes: config.sendIntervalMinutes,
      nextScheduledAt,
      devices: tanks.map((tank) => {
        const s = statsByTank.get(String(tank._id)) || {};
        const c = credByDevice.get(tank.iwcrcm.deviceId) || {};
        return {
          tankId: tank._id,
          tankName: tank.tankName,
          localDeviceId: tank.deviceId,
          iwcrcmDeviceId: tank.iwcrcm.deviceId,
          enabled: !!tank.iwcrcm.enabled,
          lastSuccessAt: s.lastSuccessAt || null,
          lastAttemptAt: s.lastAttemptAt || null,
          lastStatus: s.lastStatus || null,
          lastErrorKind: s.lastErrorKind || null,
          lastError: s.lastError || null,
          pending: s.pending || 0,
          retrying: s.retrying || 0,
          failed: s.failed || 0,
          success: s.success || 0,
          // expiry only — the key itself is never returned
          authExpiresAt: c.authKeyExpiresAt || null,
          lastAuthAt: c.lastAuthAt || null,
          authFailures: c.authFailures || 0,
          lastAuthError: c.lastAuthError || null,
          nextScheduledAt: tank.iwcrcm.enabled ? nextScheduledAt : null,
        };
      }),
    };
  };

  const retryFailed = async ({ tankId } = {}) => {
    const filter = { status: 'FAILED' };
    if (tankId) filter.tankId = tankId;
    const res = await Transmission.updateMany(filter, {
      $set: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(now()), lockedUntil: null },
    });
    return { requeued: res.modifiedCount || 0 };
  };

  return { sendWaterData, enqueueSlot, processDue, tick, getStatus, retryFailed };
};

// ─── Default singleton wired to env + MongoDB ─────────────────────────────────

let instance = null;

const getIwcrcmService = () => {
  if (instance) return instance;

  const config = loadConfig();
  const configIssues = getConfigIssues(config);

  let scramble = null;
  try {
    scramble = loadScrambleModule(config.scrambleModule);
  } catch (err) {
    configIssues.push(err.message);
  }

  const client = createClient({ config });
  const auth = createAuthService({
    config,
    client,
    scramble,
    store: createMongoCredentialStore({ secret: config.credentialSecret }),
  });

  const models = {
    Tank:         require('../../modules/tanks/tank.model'),
    LiveData:     require('../../modules/iot/iot.model'),
    Transmission: require('./iwcrcm.transmission.model'),
  };
  const Credential = require('./iwcrcm.credential.model');

  const service = createIwcrcmService({ config, auth, client, models, configIssues });
  instance = {
    ...service,
    config,
    configIssues,
    getStatus: () => service.getStatus({ Credential }),
  };
  return instance;
};

module.exports = {
  createIwcrcmService,
  getIwcrcmService,
  getLastCompletedSlot,
  getNextScheduledAt,
  computeBackoffMs,
};
