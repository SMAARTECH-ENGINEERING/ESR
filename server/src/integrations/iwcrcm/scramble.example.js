// ─── IWCRCM scramble (response-code) module — TEMPLATE ────────────────────────
// PDF step 3: "The device then creates a response code using a scramble code
// to verify its authenticity to server."
//
// The scramble algorithm is NOT described in the IWCRCM integration PDF.
// TODO / REQUIRED FROM IWCRCM API PROVIDER.
//
// Once the provider supplies it:
//   1. copy this file to e.g. src/integrations/iwcrcm/scramble.js (keep it out of git if it contains secrets)
//   2. implement createResponseCode() exactly as specified by IWCRCM
//   3. set IWCRCM_SCRAMBLE_MODULE=./src/integrations/iwcrcm/scramble.js
//
// Input  : { deviceId, challengeKey, expire, keyType }
//            deviceId     – IWCRCM device id (e.g. "TNXWFM003")
//            challengeKey – `key` returned by POST /auth { id, new }
//            expire       – `expire` returned with that challenge (sent back as Dt_Expire)
//            keyType      – "Auth"
// Output : string (sync or Promise) — sent as `Iot_Key`

const createResponseCode = async ({ deviceId, challengeKey, expire, keyType }) => {
  throw new Error('IWCRCM scramble algorithm not implemented — REQUIRED FROM IWCRCM API PROVIDER');
};

module.exports = { createResponseCode };
