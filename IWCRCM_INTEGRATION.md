# IWCRCM Integration

**IWCRCM** = *Industrial Water Consumption and Revenue Monitoring System*, run by the department at `api.industrialwaterod.nic.in`.

This document explains how the ESR Tank Management server reports water-meter readings to IWCRCM. Source of truth: *"IoT Device Integration Document IWCRCM"* (4-page PDF). Anything that PDF does not define is marked **REQUIRED FROM IWCRCM**. None of it has been guessed.

> **Status: NOT production-ready yet.** Everything is built and tested. Real transmission still needs the items in [Information required from IWCRCM](#16-information-required-from-iwcrcm), mainly the **scramble algorithm** and the **public key**.

---

## 1. What the integration does

- Your tanks keep sending readings to the ESR server every 60 seconds, exactly as before.
- Once per hour (configurable), the server takes the latest reading of each tank that has an **IWCRCM device ID**. It stores that reading in a local queue, then securely forwards it to IWCRCM.
- If IWCRCM is down, local monitoring, dashboards and reports keep working. Queued readings are retried later and are never lost.

```
 ┌────────────┐  every 60s   ┌──────────────────────────── ESR server ────────────────────────────┐
 │ Tank meter │ ───────────▶ │ POST /api/iot/data → live_data → Socket.IO → dashboards (unchanged)│
 └────────────┘              │                         │                                          │
                             │        every IWCRCM_SEND_INTERVAL_MINUTES (default 60)             │
                             │                         ▼                                          │
                             │        iwcrcm_transmissions  (queue: PENDING → SENT → SUCCESS)     │
                             │                         │                                          │
                             │   IWCRCM service ── Auth (get/refresh 24h key)                     │
                             │                  ── Mapper   {id, loc, ts, flow, qty, roll, key}   │
                             │                  ── SHA256   {payload, hash}                       │
                             │                  ── RSA      node-rsa, base64                      │
                             │                  ── HTTPS client (timeout, bounded retries)        │
                             └─────────────────────────┬──────────────────────────────────────────┘
                                                       ▼
                               https://api.industrialwaterod.nic.in/auth , /main
```

The server acts as the "device" in the IWCRCM protocol on behalf of each meter. The meters themselves are not changed.

### Where the code lives

| File | Role |
|---|---|
| `server/src/integrations/iwcrcm/iwcrcm.config.js` | Reads all `IWCRCM_*` env vars, reports missing configuration |
| `server/src/integrations/iwcrcm/iwcrcm.auth.js` | `/auth` handshake, key cache, cross-process lock |
| `server/src/integrations/iwcrcm/iwcrcm.mapper.js` | Local reading → IWCRCM payload + validation |
| `server/src/integrations/iwcrcm/iwcrcm.crypto.js` | SHA256, node-rsa encryption, at-rest key sealing, log masking |
| `server/src/integrations/iwcrcm/iwcrcm.client.js` | HTTPS POST, status classification, retries |
| `server/src/integrations/iwcrcm/iwcrcm.service.js` | `sendWaterData()`, queue, retry/backoff, status |
| `server/src/integrations/iwcrcm/iwcrcm.*.model.js` | `iwcrcm_transmissions` (queue), `iwcrcm_credentials` (keys) |
| `server/src/integrations/iwcrcm/scramble.example.js` | Template for the provider's scramble algorithm |
| `server/src/jobs/iwcrcm.job.js` | Scheduler (every minute; queues once per interval) |
| `server/src/modules/iwcrcm/*` | Admin API `/api/iwcrcm/*` |
| `client/src/Screens/Admin/IwcrcmStatus.jsx` | Admin status page (sidebar → **IWCRCM**) |

---

## 2. Authentication flow (PDF steps 1–6)

```
ESR server                                             IWCRCM /auth
    │  ① POST { "id": "TNXWFM003", "new": true }            │
    │ ─────────────────────────────────────────────────────▶│
    │  ② { "id", "key": <challenge>, "expire": <+2 min> }   │
    │ ◀─────────────────────────────────────────────────────│
    │  ③ response code = scramble(challenge)  ← REQUIRED FROM IWCRCM
    │     POST { "id", "Key_Type": "Auth", "Iot_Key": <response code>,
    │            "Dt_Expire": <expire from ②>, "auth": true }
    │ ─────────────────────────────────────────────────────▶│
    │  ⑤ { "id", "key": <auth key>, "expire": <+24 h> }     │
    │ ◀─────────────────────────────────────────────────────│
```

- The response may arrive as `{ id, key, expire }` or wrapped as `{ newkey: { ... } }`, because the PDF prints `newkey { ... }`. Both are accepted.
- A response whose `id` does not match the requesting device is rejected, so keys are never mixed between devices.
- `Dt_Expire` in step ③ echoes the `expire` value from step ② unchanged.

## 3. The 2-minute challenge

The challenge code from step ② is valid for about **2 minutes**. The server answers it immediately. Before sending step ③ it checks the deadline, using the server's `expire` when it can be parsed and otherwise "received + 120 s" (`IWCRCM_CHALLENGE_TTL_SECONDS`). If the challenge has already expired, the whole handshake restarts **once**, then gives up for this attempt.

## 4. The 24-hour authentication key

- The key is stored **encrypted (AES-256-GCM)** in MongoDB (`iwcrcm_credentials`), using `IWCRCM_CREDENTIAL_SECRET`. It is also cached in memory, as PDF step 6 describes.
- It is reused for every reading until `expire − IWCRCM_AUTH_REFRESH_BUFFER_MINUTES` (default 10 min). After that it is refreshed automatically.
- If `expire` cannot be parsed, the key is treated as valid for 24 h from receipt (`IWCRCM_AUTH_KEY_TTL_HOURS`, from the PDF).
- The key is shared by all PM2 instances. A database lock ensures only **one** instance authenticates a device at a time, so parallel handshakes cannot invalidate each other's keys.
- The key **never** appears in API responses, Socket.IO events, the frontend, browser storage or logs. Logs show at most a masked form like `AU***(12)`.

## 5. Data payload

| IWCRCM field | Source in ESR | Notes |
|---|---|---|
| `id` | `tank.iwcrcm.deviceId` | Department-issued, 1–11 chars `[A-Z0-9]`. **Not** the local `deviceId` |
| `loc` | `tank.iwcrcm.longitude`,`tank.iwcrcm.latitude` | `"longitude,latitude"` (PDF order). Meters have no GPS, so fixed per tank |
| `ts` | reading `timestamp` | Epoch **milliseconds** |
| `flow` | reading `flowRate` × `IWCRCM_FLOW_MULTIPLIER` | Local unit: **m³/h** (as sent by the device) |
| `qty` | reading `totalizer` × `IWCRCM_QTY_MULTIPLIER` | Local unit: **m³ (as sent by the device), daily total, resets at midnight** |
| `roll` | `IWCRCM_ROLL_VALUE` (default `0`) | PDF only gives example `0` |
| `key` | current 24 h auth key | Added at send time; never stored in the queue |

Per interval (default 1 hour, aligned to local midnight, e.g. 09:00–10:00), the **latest reading inside that hour** is sent. If a tank sent nothing in that hour, nothing is queued for it.

Readings are validated before queueing (device-ID format, coordinates in range, non-negative numbers, timestamp not in the future). Invalid tanks are skipped and logged.

**Mapping a tank:** Tank Management → Edit → tick *Send data to IWCRCM* → enter the IWCRCM device ID, longitude and latitude. Each IWCRCM ID can belong to only one tank.

## 6. SHA256 (PDF step 7)

```js
hash = sha256( JSON.stringify(payload) ).digest('hex')
body = { payload, hash }
```

`payload` is built with keys in the PDF's order: `id, loc, ts, flow, qty, roll, key`. The exact string that is hashed is produced by **one function**, `serializeForHash()` in `iwcrcm.crypto.js`. If IWCRCM specifies a different canonical format, only that function changes.

## 7. Encryption (PDF step 7 + 9)

```js
cipher = new NodeRSA(IWCRCM_PUBLIC_KEY).encrypt(JSON.stringify(body), 'base64')
POST /main   Content-Type: text/plain   body: cipher
```

- It uses the **node-rsa** package named in the PDF, with its defaults unless configured otherwise: padding `pkcs1_oaep` (`IWCRCM_RSA_ENCRYPTION_SCHEME`) and PEM key auto-detection (`IWCRCM_PUBLIC_KEY_FORMAT`).
- node-rsa automatically splits data longer than one RSA block into chunks. The `{payload, hash}` JSON is usually longer than one block, so this matters. Using node-rsa itself keeps the chunking identical to what a node-rsa-based server expects.
- No public key is bundled. An invalid key is reported as `CRYPTO_ERROR` and nothing is sent.

## 8. `/auth` endpoint

`POST https://api.industrialwaterod.nic.in/auth`, `Content-Type: application/json`. See section 2 for bodies.

## 9. `/main` endpoint

`POST https://api.industrialwaterod.nic.in/main`, `Content-Type: text/plain`, body = base64 ciphertext.
Success: HTTP 200 with `{ "Action": "OK" }`. Any other 200 body counts as `INVALID_RESPONSE`.
Per the PDF, IWCRCM returns **403** if decryption, the hash check or the key check fails.

## 10. One-hour transmission

- `IWCRCM_SEND_INTERVAL_MINUTES=60` (must divide 1440: 15, 30, 60, 120 …).
- The job ticks every minute. Once per interval it queues one reading per enabled tank, and on every tick it sends any queued or due-for-retry readings (up to `IWCRCM_BATCH_SIZE`).
- Device collection frequency (60 s) is **unchanged**.
- **PM2 cluster mode is safe.** Each tank+interval can be queued only once (unique index), and each queued record is atomically claimed by one process before sending.

## 11. Error handling

| Outcome | Kind | What happens |
|---|---|---|
| 200 `{"Action":"OK"}` | `OK` | `SUCCESS` |
| 200, other body | `INVALID_RESPONSE` | retry later |
| 400 | `BAD_REQUEST` | `FAILED` immediately (payload problem, retrying won't help) |
| 401 / 403 | `AUTH_REJECTED` | Drop key → re-authenticate → resend **once**. If still rejected: retry later, and skip that device's other records this tick |
| 404 | `NOT_FOUND` | `FAILED` immediately (wrong URL / unknown device) |
| 429 | `RATE_LIMITED` | Honour `Retry-After`; stop the batch for this tick |
| 5xx | `SERVER_ERROR` | Up to 2 quick retries (1 s, 2 s), then retry later |
| Network failure | `NETWORK` | Up to 2 quick retries, then retry later |
| Timeout (15 s) | `TIMEOUT` | Retry **later** only, because the server may already have accepted it |
| Expired auth key | — | Refreshed automatically before sending |
| Missing config / invalid key / bad data | `CONFIG_ERROR` / `CRYPTO_ERROR` / `VALIDATION_ERROR` | Not sent; logged |

Log lines (no secrets): `IWCRCM data sent successfully`, `IWCRCM transmission failed`, `IWCRCM authentication required`, `IWCRCM authentication key expired`.

## 12. Retry mechanism

Queue statuses:

- `PENDING`: waiting to be sent, either the first try or a retry scheduled for `nextAttemptAt`
- `SENT`: currently being sent. If the process crashed mid-send, the record is picked up again after its lock expires.
- `SUCCESS`: acknowledged with `{"Action":"OK"}`
- `FAILED`: permanent error, or `IWCRCM_MAX_ATTEMPTS` (default 10) reached

The backoff between retries is 5, 10, 20, 40 … minutes, capped at 6 h. There are **no infinite loops**. Admins can re-queue failed records with **Retry failed** on the IWCRCM page, or `POST /api/iwcrcm/retry-failed`.

The PDF defines **no idempotency key**. Duplicates are avoided locally (one record per tank per interval, atomic claiming, no immediate retry after a timeout). One case remains: if IWCRCM accepted a request but the response was lost, the retry is a duplicate. See section 16.

## 13. 120-day data retention

`DATA_RETENTION_DAYS=120` is set **once**, in `server/.env`, and applied by `server/src/config/retention.js`.

| Collection | Retention |
|---|---|
| `report_data` (30-min history used by reports) | 120 days (was 90) |
| `iwcrcm_transmissions` (IWCRCM queue) | 120 days |
| `live_data` (every raw device reading) | 120 days (was 24 h) |
| `users`, `tanks`, `iwcrcm_credentials` | never auto-deleted |

- **TTL index:** `expireAfterSeconds = 120 × 24 × 60 × 60 = 10,368,000`, on `createdAt`. At startup the old 90-day index `ttl_report_data_3months` (7,776,000 s) is dropped and `ttl_report_data_retention` is created. Mongoose can't change an existing TTL value by itself, so the schema no longer declares it.
- **Daily job (00:00):** deletes records older than exactly 120 days and logs counts. The old job used "3 calendar months", which varied between 89 and 92 days.

## 14. Environment variables (`server/.env`)

| Variable | Default | Meaning |
|---|---|---|
| `DATA_RETENTION_DAYS` | `120` | History retention |
| `IWCRCM_ENABLED` | `false` | Master switch |
| `IWCRCM_AUTH_URL` | `https://api.industrialwaterod.nic.in/auth` | PDF |
| `IWCRCM_DATA_URL` | `https://api.industrialwaterod.nic.in/main` | PDF |
| `IWCRCM_SEND_INTERVAL_MINUTES` | `60` | PDF: 1 hour |
| `IWCRCM_AUTH_REFRESH_BUFFER_MINUTES` | `10` | Refresh key this early |
| `IWCRCM_PUBLIC_KEY` / `IWCRCM_PUBLIC_KEY_FILE` | — | **Required**, from IWCRCM |
| `IWCRCM_PUBLIC_KEY_FORMAT` | auto | node-rsa key format |
| `IWCRCM_RSA_ENCRYPTION_SCHEME` | `pkcs1_oaep` | node-rsa padding |
| `IWCRCM_SCRAMBLE_MODULE` | — | **Required**, path to the scramble implementation |
| `IWCRCM_CREDENTIAL_SECRET` | — | **Required**, ≥32 random chars, encrypts stored keys |
| `IWCRCM_AUTH_KEY_TTL_HOURS` | `24` | Fallback key lifetime |
| `IWCRCM_CHALLENGE_TTL_SECONDS` | `120` | Fallback challenge lifetime |
| `IWCRCM_REQUEST_TIMEOUT_MS` | `15000` | Per HTTP request |
| `IWCRCM_HTTP_RETRIES` | `2` | Quick retries per send |
| `IWCRCM_MAX_ATTEMPTS` | `10` | Per queued reading |
| `IWCRCM_RETRY_BACKOFF_MINUTES` / `_MAX_MINUTES` | `5` / `360` | Backoff |
| `IWCRCM_BATCH_SIZE` | `50` | Max sends per tick |
| `IWCRCM_FLOW_MULTIPLIER` / `IWCRCM_QTY_MULTIPLIER` | `1` / `1` | Unit conversion once units are known |
| `IWCRCM_ROLL_VALUE` | `0` | `roll` field |

If `IWCRCM_ENABLED=true` but required values are missing, readings are **queued but not sent**. The admin page and the startup log list exactly what is missing.

## 15. How to test

```bash
cd server
npm install
npm test                 # 71 tests (node:test); retention test uses local MongoDB if reachable
```

The tests cover: auth (valid/invalid device, expired challenge, valid/invalid response code, expired key, refresh buffer, lock), payload validation (missing ID, invalid flow/qty/timestamp/location), SHA256 (determinism, tamper detection), encryption (round-trip with a test key pair, chunking, invalid key, wrong-key decrypt), HTTP (200/400/401/403/404/429/5xx/timeout/network/retry), queue behaviour, and 120-day retention against a real throwaway MongoDB database. `TEST_MONGODB_URI` overrides the database location.

Manual test:

1. Set `IWCRCM_ENABLED=true` and `IWCRCM_CREDENTIAL_SECRET` in `server/.env`, then start the server.
2. In the web app go to Tank Management → Edit a tank, and set the IWCRCM ID and coordinates.
3. Open the sidebar's **IWCRCM** page. It lists the missing configuration items, and **Run now** queues the last completed hour's reading.
4. Postman: `server/postman/IWCRCM_Integration.postman_collection.json`.

## 16. Information required from IWCRCM

These are genuinely missing from, or ambiguous in, the PDF:

1. **Scramble / response-code algorithm** (step 3). The PDF says only "creates a response code using a scramble code". Without it, authentication cannot complete. *Blocking.*
2. **RSA public key** for `/main`, and its format (PEM SPKI / PKCS#1 / other). *Blocking.*
3. **RSA padding** (node-rsa `pkcs1_oaep` default vs `pkcs1`) and OAEP hash. The PDF names node-rsa but no options.
4. **Meaning of "Public Key in base64 format"**: is the key base64/PEM, or only the ciphertext output?
5. **Exact SHA256 input**: plain `JSON.stringify(payload)` with the documented key order? Must number formatting and key order match exactly?
6. **Date/time format and timezone** of `expire` / `Dt_Expire` (ISO? IST? epoch?). The parameter table also describes `expire` as a device-provided value, which contradicts steps 2 and 5.
7. **`/auth` response envelope**: `{ id, key, expire }` or `{ newkey: { ... } }`?
8. **HTTP status codes and error bodies for `/auth`** (not documented).
9. **Units of `flow`** (ESR meters report m³/h — is that what IWCRCM expects?) and **`qty`** (ESR meters report m³ — is that what IWCRCM expects?). Also, should `qty` be the cumulative meter reading, the daily total (what ESR meters report, which resets at midnight), or consumption during the hour?
10. **Meaning of `roll`** (e.g. totalizer rollover count?). The PDF only gives example `0`, max length 1.
11. **Device IDs**: department-issued IDs per meter, and confirmation that one server may authenticate on behalf of several meters.
12. **Location source**: are fixed site coordinates acceptable in place of live GPS?
13. **Precision** expected for `loc`, `flow`, `qty`.
14. **Rate limits**, and retry expectations.
15. **Idempotency / duplicates**: how are repeated `(id, ts)` submissions treated?
16. **Historical / backfill data**: are late readings (after an outage) accepted, and how old may `ts` be?
17. **Test/sandbox environment** and test credentials.
18. **Key expiry behaviour**: does a new `/auth` invalidate the previous 24 h key?
