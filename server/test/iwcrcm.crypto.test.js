const { privateKey, publicKey, baseConfig } = require('./helpers/setup');
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const NodeRSA = require('node-rsa');
const {
  hashPayload, buildSignedBody, verifySignedBody, encryptBody, loadPublicKey,
  sealSecret, openSecret, mask, IwcrcmCryptoError,
} = require('../src/integrations/iwcrcm/iwcrcm.crypto');

const payload = () => ({
  id: 'TNXWFM003', loc: '85.8245,20.2961', ts: 1790000000000,
  flow: 120.5, qty: 4500.25, roll: 0, key: 'AUTH-KEY-123',
});

test('SHA256: hash = sha256(JSON.stringify(payload)) hex, as PDF step 7', () => {
  const expected = crypto.createHash('sha256').update(JSON.stringify(payload())).digest('hex');
  assert.equal(hashPayload(payload()), expected);
  assert.match(hashPayload(payload()), /^[0-9a-f]{64}$/);
});

test('SHA256: same payload always produces the same hash', () => {
  assert.equal(hashPayload(payload()), hashPayload(payload()));
});

test('SHA256: signed body is { payload, hash } and verifies', () => {
  const body = buildSignedBody(payload());
  assert.deepEqual(Object.keys(body), ['payload', 'hash']);
  assert.equal(verifySignedBody(body), true);
});

test('SHA256: modified payload fails validation', () => {
  const body = buildSignedBody(payload());
  body.payload.qty = 9999;
  assert.equal(verifySignedBody(body), false);
  assert.equal(verifySignedBody({ payload: payload(), hash: 'short' }), false);
  assert.equal(verifySignedBody(null), false);
});

test('Encryption: node-rsa base64 ciphertext decrypts back to the signed body', () => {
  const body = buildSignedBody(payload());
  const cipher = encryptBody(body, baseConfig());
  assert.match(cipher, /^[A-Za-z0-9+/]+=*$/);

  const priv = new NodeRSA(privateKey);
  priv.setOptions({ encryptionScheme: 'pkcs1_oaep' });
  const decrypted = JSON.parse(priv.decrypt(cipher, 'utf8'));
  assert.deepEqual(decrypted, body);
  assert.equal(verifySignedBody(decrypted), true);
});

test('Encryption: body larger than one RSA block is chunked by node-rsa', () => {
  const big = buildSignedBody({ ...payload(), key: 'K'.repeat(400) });
  const cipher = encryptBody(big, baseConfig());
  assert.ok(Buffer.from(cipher, 'base64').length > 256);
  const priv = new NodeRSA(privateKey);
  assert.deepEqual(JSON.parse(priv.decrypt(cipher, 'utf8')), big);
});

test('Encryption: invalid or missing public key raises IwcrcmCryptoError', () => {
  assert.throws(() => encryptBody({}, baseConfig({ publicKey: 'not a key' })), IwcrcmCryptoError);
  assert.throws(() => encryptBody({}, baseConfig({ publicKey: '' })), IwcrcmCryptoError);
  assert.throws(() => loadPublicKey(publicKey, { encryptionScheme: 'bogus' }), IwcrcmCryptoError);
});

test('Encryption: decrypting with the wrong private key fails', () => {
  const cipher = encryptBody(buildSignedBody(payload()), baseConfig());
  const other = new NodeRSA({ b: 2048 });
  assert.throws(() => other.decrypt(cipher, 'utf8'));
});

test('At-rest sealing round-trips and rejects the wrong secret', () => {
  const sealed = sealSecret('AUTH-KEY-123', 's'.repeat(32));
  assert.ok(!sealed.includes('AUTH-KEY-123'));
  assert.equal(openSecret(sealed, 's'.repeat(32)), 'AUTH-KEY-123');
  assert.throws(() => openSecret(sealed, 'w'.repeat(32)));
});

test('mask() never reveals the full value', () => {
  assert.equal(mask('AUTH-KEY-123'), 'AU***(12)');
  assert.equal(mask('abc'), '***(3)');
  assert.equal(mask(null), '(none)');
});
