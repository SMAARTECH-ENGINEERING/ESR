const fs = require('fs');
const path = require('path');

// ─── IWCRCM integration configuration ─────────────────────────────────────────
// Everything is read from environment variables. Values marked "PDF" come from
// the official "IoT Device Integration Document IWCRCM". Values marked
// "TODO / REQUIRED FROM IWCRCM API PROVIDER" are NOT defined in that document.

const num = (raw, fallback) => {
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const bool = (raw, fallback = false) => {
  if (raw === undefined || raw === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(raw).toLowerCase());
};

// Allows the PEM to be pasted into a single-line env var with literal "\n"
const readPublicKey = (env) => {
  if (env.IWCRCM_PUBLIC_KEY_FILE) {
    return fs.readFileSync(path.resolve(env.IWCRCM_PUBLIC_KEY_FILE), 'utf8').trim();
  }
  return (env.IWCRCM_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
};

const loadConfig = (env = process.env) => {
  let publicKey = '';
  let publicKeyError = null;
  try {
    publicKey = readPublicKey(env);
  } catch (err) {
    publicKeyError = `Cannot read IWCRCM_PUBLIC_KEY_FILE: ${err.message}`;
  }

  return {
    enabled: bool(env.IWCRCM_ENABLED, false),

    // PDF: HTTPS POST endpoints
    authUrl: env.IWCRCM_AUTH_URL || 'https://api.industrialwaterod.nic.in/auth',
    dataUrl: env.IWCRCM_DATA_URL || 'https://api.industrialwaterod.nic.in/main',

    // PDF step 11: "data from your IOT Meter ... in every 1 hour Interval"
    sendIntervalMinutes: num(env.IWCRCM_SEND_INTERVAL_MINUTES, 60),

    // Re-authenticate this long before the 24h key actually expires
    authRefreshBufferMinutes: num(env.IWCRCM_AUTH_REFRESH_BUFFER_MINUTES, 10),

    // PDF step 4: auth key valid for 24 hours — only used when the server's
    // `expire` value cannot be parsed
    authKeyTtlHours: num(env.IWCRCM_AUTH_KEY_TTL_HOURS, 24),

    // PDF step 2: challenge code valid for 2 minutes
    challengeTtlSeconds: num(env.IWCRCM_CHALLENGE_TTL_SECONDS, 120),

    // PDF step 7: "Encrypts the JSON with the provided Public Key ... using node-rsa"
    publicKey,
    publicKeyError,
    // node-rsa importKey format ('' = auto-detect PEM). TODO / REQUIRED FROM IWCRCM API PROVIDER
    publicKeyFormat: env.IWCRCM_PUBLIC_KEY_FORMAT || '',
    // node-rsa default is 'pkcs1_oaep'. TODO / REQUIRED FROM IWCRCM API PROVIDER
    encryptionScheme: env.IWCRCM_RSA_ENCRYPTION_SCHEME || 'pkcs1_oaep',

    // PDF step 3: "creates a response code using a scramble code" — the
    // algorithm is NOT in the PDF. TODO / REQUIRED FROM IWCRCM API PROVIDER.
    // Path to a JS module exporting createResponseCode({ deviceId, challengeKey, expire, keyType })
    scrambleModule: env.IWCRCM_SCRAMBLE_MODULE || '',

    // Encrypts cached auth keys at rest in MongoDB (AES-256-GCM)
    credentialSecret: env.IWCRCM_CREDENTIAL_SECRET || '',

    // HTTP behaviour
    requestTimeoutMs: num(env.IWCRCM_REQUEST_TIMEOUT_MS, 15000),
    httpRetries:      num(env.IWCRCM_HTTP_RETRIES, 2),
    httpRetryBaseMs:  num(env.IWCRCM_HTTP_RETRY_BASE_MS, 1000),

    // Outbox retry policy (bounded — no infinite loops)
    maxAttempts:            num(env.IWCRCM_MAX_ATTEMPTS, 10),
    retryBackoffMinutes:    num(env.IWCRCM_RETRY_BACKOFF_MINUTES, 5),
    retryBackoffMaxMinutes: num(env.IWCRCM_RETRY_BACKOFF_MAX_MINUTES, 360),
    batchSize:              num(env.IWCRCM_BATCH_SIZE, 50),

    // Unit/meaning of flow, qty, roll are NOT defined in the PDF.
    // Local units: flowRate = m³/h (as sent by the device), totalizer = litres (daily, resets at midnight).
    // TODO / REQUIRED FROM IWCRCM API PROVIDER — adjust multipliers once known.
    flowMultiplier: num(env.IWCRCM_FLOW_MULTIPLIER, 1),
    qtyMultiplier:  num(env.IWCRCM_QTY_MULTIPLIER, 1),
    rollValue:      num(env.IWCRCM_ROLL_VALUE, 0), // PDF example: 0
  };
};

// Interval must divide a day so slots align to local midnight
const isValidInterval = (m) => Number.isInteger(m) && m >= 1 && m <= 1440 && 1440 % m === 0;

// Returns a list of human-readable problems that prevent SENDING.
// (Enqueueing still happens so no data is lost while config is incomplete.)
const getConfigIssues = (config) => {
  const issues = [];
  if (!isValidInterval(config.sendIntervalMinutes)) {
    issues.push('IWCRCM_SEND_INTERVAL_MINUTES must be an integer that divides 1440 (e.g. 15, 30, 60, 120)');
  }
  if (config.publicKeyError) issues.push(config.publicKeyError);
  if (!config.publicKey) issues.push('IWCRCM_PUBLIC_KEY is not configured (REQUIRED FROM IWCRCM API PROVIDER)');
  if (!config.scrambleModule) {
    issues.push('IWCRCM_SCRAMBLE_MODULE is not configured — response-code (scramble) algorithm is REQUIRED FROM IWCRCM API PROVIDER');
  }
  if (!config.credentialSecret || config.credentialSecret.length < 32) {
    issues.push('IWCRCM_CREDENTIAL_SECRET must be at least 32 characters');
  }
  if (!/^https:\/\//i.test(config.authUrl) || !/^https:\/\//i.test(config.dataUrl)) {
    issues.push('IWCRCM_AUTH_URL and IWCRCM_DATA_URL must use HTTPS');
  }
  return issues;
};

module.exports = { loadConfig, getConfigIssues, isValidInterval };
