const crypto = require('crypto');
const NodeRSA = require('node-rsa');

// ─── SHA256 (PDF step 7) ──────────────────────────────────────────────────────
// "creates a JSON Packet with all the data and received key and stringify it.
//  Create a SHA256 hash using digest('hex') of crypto package."
//
// The PDF says "stringify" but does not define canonicalisation. We use plain
// JSON.stringify with the field order the PDF lists (id, loc, ts, flow, qty,
// roll, key) — the mapper builds the object in exactly that order.
// If IWCRCM specifies a different input format, change ONLY this function.
// TODO / REQUIRED FROM IWCRCM API PROVIDER: confirm exact hash input format.
const serializeForHash = (payload) => JSON.stringify(payload);

const sha256Hex = (input) => crypto.createHash('sha256').update(input, 'utf8').digest('hex');

const hashPayload = (payload) => sha256Hex(serializeForHash(payload));

// "Creates a new JSON with data payload and SHA hash value" → { payload, hash }
const buildSignedBody = (payload) => ({ payload, hash: hashPayload(payload) });

// Mirrors the server-side check in PDF step 10 (used by tests / diagnostics)
const verifySignedBody = (body) => {
  if (!body || body.payload === undefined || typeof body.hash !== 'string' || body.hash.length !== 64) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(hashPayload(body.payload)), Buffer.from(body.hash));
};

// ─── RSA encryption (PDF step 7 + 9) ──────────────────────────────────────────
// "Encrypts the JSON with the provided Public Key in base64 format using
//  node-rsa package" and "sends encrypted data in content type text/plain".
// node-rsa transparently splits data longer than one RSA block into chunks;
// using node-rsa itself (as the PDF names) keeps that behaviour identical.
class IwcrcmCryptoError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IwcrcmCryptoError';
    this.code = 'CRYPTO_ERROR';
  }
}

const keyCache = new Map();

const loadPublicKey = (publicKey, { format = '', encryptionScheme = 'pkcs1_oaep' } = {}) => {
  if (!publicKey) throw new IwcrcmCryptoError('IWCRCM public key is not configured');

  const cacheKey = `${format}|${encryptionScheme}|${publicKey}`;
  if (keyCache.has(cacheKey)) return keyCache.get(cacheKey);

  let key;
  try {
    key = format ? new NodeRSA(publicKey, format) : new NodeRSA(publicKey);
    key.setOptions({ encryptionScheme });
  } catch (err) {
    throw new IwcrcmCryptoError(`Invalid IWCRCM public key: ${err.message}`);
  }
  if (key.isEmpty() || !key.isPublic()) {
    throw new IwcrcmCryptoError('Invalid IWCRCM public key: no public component found');
  }

  keyCache.set(cacheKey, key);
  return key;
};

const encryptBody = (body, config) => {
  const key = loadPublicKey(config.publicKey, {
    format: config.publicKeyFormat,
    encryptionScheme: config.encryptionScheme,
  });
  try {
    return key.encrypt(JSON.stringify(body), 'base64', 'utf8');
  } catch (err) {
    throw new IwcrcmCryptoError(`RSA encryption failed: ${err.message}`);
  }
};

// ─── Auth-key protection at rest (local, not part of IWCRCM protocol) ─────────
const deriveKey = (secret) => crypto.createHash('sha256').update(String(secret), 'utf8').digest();

const sealSecret = (plain, secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(secret), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
};

const openSecret = (sealed, secret) => {
  const [iv, tag, enc] = String(sealed).split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
};

// Log-safe representation: never print a full key/code
const mask = (value) => {
  if (value === undefined || value === null || value === '') return '(none)';
  const s = String(value);
  return s.length <= 4 ? `***(${s.length})` : `${s.slice(0, 2)}***(${s.length})`;
};

module.exports = {
  serializeForHash,
  sha256Hex,
  hashPayload,
  buildSignedBody,
  verifySignedBody,
  loadPublicKey,
  encryptBody,
  sealSecret,
  openSecret,
  mask,
  IwcrcmCryptoError,
};
