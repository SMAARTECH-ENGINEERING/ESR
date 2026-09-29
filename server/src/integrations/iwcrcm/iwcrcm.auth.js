const path = require('path');
const defaultLogger = require('../../config/logger');
const { mask, sealSecret, openSecret } = require('./iwcrcm.crypto');

// ─── IWCRCM authentication (PDF steps 1–6) ────────────────────────────────────
// 1. POST /auth { id, new: true }                → { id, key: <challenge>, expire }  (valid ~2 min)
// 3. POST /auth { id, Key_Type: "Auth", Iot_Key: <response code>, Dt_Expire: <expire>, auth: true }
// 5.                                              → { id, key: <auth key>, expire }   (valid 24 h)
// 6. The auth key is kept and sent with every data packet until it expires.
//
// The "scramble code" used to derive the response code in step 3 is NOT
// described in the PDF → it must be supplied as a module (IWCRCM_SCRAMBLE_MODULE).
// TODO / REQUIRED FROM IWCRCM API PROVIDER.

class IwcrcmAuthError extends Error {
  constructor(message, { kind = 'AUTH_FAILED', status = null, retryable = true } = {}) {
    super(message);
    this.name = 'IwcrcmAuthError';
    this.kind = kind;
    this.status = status;
    this.retryable = retryable;
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

// PDF gives no date format for `expire`. Accept ISO/RFC strings and epoch ms.
// TODO / REQUIRED FROM IWCRCM API PROVIDER: exact format + timezone of `expire`.
const parseExpiry = (value) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value);
  if (typeof value === 'string' && value.trim()) {
    const t = Date.parse(value);
    return Number.isFinite(t) ? new Date(t) : null;
  }
  return null;
};

// The PDF shows the response as `newkey { id, key, expire }` — accept the
// object either wrapped in `newkey` or at the top level.
const parseKeyResponse = (data, deviceId, { requireExpire }) => {
  const obj = data && typeof data === 'object' && data.newkey && typeof data.newkey === 'object'
    ? data.newkey
    : data;

  if (!obj || typeof obj !== 'object') {
    throw new IwcrcmAuthError('Invalid /auth response body', { kind: 'INVALID_RESPONSE' });
  }
  if (obj.id !== undefined && String(obj.id).toUpperCase() !== deviceId) {
    throw new IwcrcmAuthError('/auth response is for a different device id', { kind: 'INVALID_RESPONSE', retryable: false });
  }
  if (obj.key === undefined || obj.key === null || String(obj.key) === '') {
    throw new IwcrcmAuthError('/auth response has no key', { kind: 'INVALID_RESPONSE' });
  }
  if (requireExpire && (obj.expire === undefined || obj.expire === null || obj.expire === '')) {
    throw new IwcrcmAuthError('/auth response has no expire', { kind: 'INVALID_RESPONSE' });
  }
  return { key: String(obj.key), expire: obj.expire, expiresAt: parseExpiry(obj.expire) };
};

const fromClientResult = (result, step) => {
  const hints = {
    AUTH_REJECTED: step === 'response' ? ' (response code rejected or challenge expired)' : ' (device not authorised)',
  };
  return new IwcrcmAuthError(
    `IWCRCM /auth ${step} step failed: ${result.kind}${result.status ? ` HTTP ${result.status}` : ''}${hints[result.kind] || ''}`,
    { kind: result.kind, status: result.status, retryable: result.retryable }
  );
};

const loadScrambleModule = (modulePath) => {
  if (!modulePath) return null;
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const mod = require(path.resolve(modulePath));
  const fn = typeof mod === 'function' ? mod : mod && mod.createResponseCode;
  if (typeof fn !== 'function') {
    throw new Error(`IWCRCM_SCRAMBLE_MODULE (${modulePath}) must export createResponseCode()`);
  }
  return fn;
};

// ── default MongoDB-backed credential store ──────────────────────────────────

const createMongoCredentialStore = ({ secret }) => {
  const IwcrcmCredential = require('./iwcrcm.credential.model');

  return {
    async getKey(deviceId) {
      const doc = await IwcrcmCredential.findOne({ deviceId }).select('+authKeyEncrypted').lean();
      if (!doc || !doc.authKeyEncrypted || !doc.authKeyExpiresAt) return null;
      try {
        return { key: openSecret(doc.authKeyEncrypted, secret), expiresAt: doc.authKeyExpiresAt };
      } catch {
        return null; // secret rotated / corrupt → force re-auth
      }
    },
    async hadKey(deviceId) {
      return !!(await IwcrcmCredential.exists({ deviceId, authKeyExpiresAt: { $ne: null } }));
    },
    async saveKey(deviceId, key, expiresAt) {
      await IwcrcmCredential.updateOne(
        { deviceId },
        {
          $set: {
            authKeyEncrypted: sealSecret(key, secret),
            authKeyExpiresAt: expiresAt,
            lastAuthAt: new Date(),
            lastAuthError: null,
            authFailures: 0,
          },
        },
        { upsert: true }
      );
    },
    async invalidate(deviceId) {
      await IwcrcmCredential.updateOne({ deviceId }, { $set: { authKeyEncrypted: null, authKeyExpiresAt: null } });
    },
    async recordFailure(deviceId, message) {
      await IwcrcmCredential.updateOne(
        { deviceId },
        { $set: { lastAuthError: message }, $inc: { authFailures: 1 } },
        { upsert: true }
      );
    },
    async acquireLock(deviceId, ms) {
      const now = new Date();
      try {
        const doc = await IwcrcmCredential.findOneAndUpdate(
          { deviceId, $or: [{ lockUntil: null }, { lockUntil: { $lt: now } }] },
          { $set: { lockUntil: new Date(now.getTime() + ms) } },
          { upsert: true, new: true }
        ).lean();
        return !!doc;
      } catch (err) {
        if (err.code === 11000) return false; // doc exists and is locked by another process
        throw err;
      }
    },
    async releaseLock(deviceId) {
      await IwcrcmCredential.updateOne({ deviceId }, { $set: { lockUntil: null } });
    },
  };
};

// ── auth service ──────────────────────────────────────────────────────────────

const createAuthService = ({
  config,
  client,
  store,
  scramble,
  logger = defaultLogger,
  now = () => Date.now(),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  lockWaitAttempts = 3,
  lockWaitMs = 2000,
}) => {
  const memCache = new Map(); // PDF step 6: "the received key is saved in memory"
  const bufferMs = config.authRefreshBufferMinutes * 60 * 1000;

  const isUsable = (entry) => !!entry && new Date(entry.expiresAt).getTime() - bufferMs > now();

  const handshake = async (deviceId) => {
    if (typeof scramble !== 'function') {
      throw new IwcrcmAuthError(
        'IWCRCM scramble (response-code) algorithm not configured — REQUIRED FROM IWCRCM API PROVIDER',
        { kind: 'CONFIG_ERROR', retryable: false }
      );
    }

    // Step 1 — request challenge
    const startedAt = now();
    const step1 = await client.postAuth({ id: deviceId, new: true });
    if (!step1.ok) throw fromClientResult(step1, 'challenge');
    const challenge = parseKeyResponse(step1.data, deviceId, { requireExpire: true });

    // Step 3 — challenge must still be valid (server expiry, else 2-min rule from PDF)
    const challengeDeadline = challenge.expiresAt
      ? challenge.expiresAt.getTime()
      : startedAt + config.challengeTtlSeconds * 1000;

    const responseCode = await scramble({
      deviceId,
      challengeKey: challenge.key,
      expire: challenge.expire,
      keyType: 'Auth',
    });
    if (typeof responseCode !== 'string' || !responseCode) {
      throw new IwcrcmAuthError('Scramble module returned an empty response code', { kind: 'CONFIG_ERROR', retryable: false });
    }
    if (now() >= challengeDeadline) {
      throw new IwcrcmAuthError('IWCRCM challenge code expired before it could be answered', { kind: 'CHALLENGE_EXPIRED' });
    }

    const step2 = await client.postAuth({
      id: deviceId,
      Key_Type: 'Auth',
      Iot_Key: responseCode,
      Dt_Expire: challenge.expire,
      auth: true,
    });
    if (!step2.ok) throw fromClientResult(step2, 'response');

    // Step 5 — auth key valid 24h
    const auth = parseKeyResponse(step2.data, deviceId, { requireExpire: false });
    const expiresAt = auth.expiresAt || new Date(now() + config.authKeyTtlHours * 3600 * 1000);
    return { key: auth.key, expiresAt };
  };

  const authenticate = async (deviceId) => {
    try {
      return await handshake(deviceId);
    } catch (err) {
      // A stale challenge is cheap to replace — try the full handshake once more
      if (err.kind === 'CHALLENGE_EXPIRED') return handshake(deviceId);
      throw err;
    }
  };

  const getAuthKey = async (rawDeviceId) => {
    const deviceId = String(rawDeviceId).toUpperCase();

    if (isUsable(memCache.get(deviceId))) return memCache.get(deviceId).key;

    const stored = await store.getKey(deviceId);
    if (isUsable(stored)) {
      memCache.set(deviceId, stored);
      return stored.key;
    }

    if (stored || (store.hadKey && await store.hadKey(deviceId))) {
      logger.warn(`IWCRCM authentication key expired [${deviceId}] — re-authenticating`);
    } else {
      logger.info(`IWCRCM authentication required [${deviceId}]`);
    }

    const lockMs = (config.requestTimeoutMs * (config.httpRetries + 1)) * 2 + 30000;
    if (!(await store.acquireLock(deviceId, lockMs))) {
      // Another process is authenticating this device — wait for its result
      for (let i = 0; i < lockWaitAttempts; i++) {
        await sleep(lockWaitMs);
        const fresh = await store.getKey(deviceId);
        if (isUsable(fresh)) {
          memCache.set(deviceId, fresh);
          return fresh.key;
        }
      }
      throw new IwcrcmAuthError('IWCRCM authentication in progress in another process', { kind: 'AUTH_IN_PROGRESS' });
    }

    try {
      const { key, expiresAt } = await authenticate(deviceId);
      await store.saveKey(deviceId, key, expiresAt);
      memCache.set(deviceId, { key, expiresAt });
      logger.info(`IWCRCM authentication successful [${deviceId}] key=${mask(key)} expires=${expiresAt.toISOString()}`);
      return key;
    } catch (err) {
      logger.error(`IWCRCM authentication failed [${deviceId}]: ${err.message}`);
      await store.recordFailure(deviceId, err.message).catch(() => {});
      throw err;
    } finally {
      await store.releaseLock(deviceId).catch(() => {});
    }
  };

  const invalidate = async (rawDeviceId) => {
    const deviceId = String(rawDeviceId).toUpperCase();
    memCache.delete(deviceId);
    await store.invalidate(deviceId);
  };

  return { getAuthKey, invalidate, authenticate };
};

module.exports = {
  IwcrcmAuthError,
  parseExpiry,
  parseKeyResponse,
  loadScrambleModule,
  createMongoCredentialStore,
  createAuthService,
};
