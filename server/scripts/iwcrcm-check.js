// Verifies the IWCRCM settings in .env WITHOUT contacting IWCRCM.
// Usage: npm run iwcrcm:check
require('dotenv').config();
const { loadConfig, getConfigIssues } = require('../src/integrations/iwcrcm/iwcrcm.config');
const { loadScrambleModule } = require('../src/integrations/iwcrcm/iwcrcm.auth');
const { buildSignedBody, encryptBody } = require('../src/integrations/iwcrcm/iwcrcm.crypto');

(async () => {
  const config = loadConfig();
  let ok = true;
  const pass = (m) => console.log(`  OK    ${m}`);
  const fail = (m) => { ok = false; console.log(`  FAIL  ${m}`); };

  console.log('IWCRCM configuration check\n');
  console.log(`  IWCRCM_ENABLED = ${config.enabled}`);

  // Public key: must load in node-rsa and encrypt a sample body
  try {
    const cipher = encryptBody(buildSignedBody({ id: 'TEST1', loc: '0,0', ts: Date.now(), flow: 0, qty: 0, roll: 0, key: 'x' }), config);
    pass(`IWCRCM_PUBLIC_KEY loads and encrypts (${config.encryptionScheme}, ${cipher.length} base64 chars)`);
  } catch (err) {
    fail(`IWCRCM_PUBLIC_KEY: ${err.message}`);
  }

  // Scramble module: must load and return a non-empty string for a sample challenge
  try {
    const scramble = loadScrambleModule(config.scrambleModule);
    if (!scramble) throw new Error('not set');
    const code = await scramble({ deviceId: 'TEST1', challengeKey: 'SAMPLE', expire: new Date().toISOString(), keyType: 'Auth' });
    if (typeof code !== 'string' || !code) throw new Error('createResponseCode() must return a non-empty string');
    pass('IWCRCM_SCRAMBLE_MODULE loads and returns a response code');
  } catch (err) {
    fail(`IWCRCM_SCRAMBLE_MODULE: ${err.message}`);
  }

  const issues = getConfigIssues(config);
  issues.forEach((i) => console.log(`  NOTE  ${i}`));

  console.log(ok && issues.length === 0
    ? '\nAll good — restart the server to start sending.'
    : '\nFix the items above, then run this again.');
  process.exit(ok && issues.length === 0 ? 0 : 1);
})();
