// ─── IWCRCM HTTP client ───────────────────────────────────────────────────────
// Thin HTTPS POST wrapper around global fetch (Node 18+). Classifies every
// outcome so callers never need to inspect raw responses.
//
// Result shape:
//   { ok, kind, status, data, retryable, retryAfterMs, message }
// kind: OK | INVALID_RESPONSE | BAD_REQUEST | AUTH_REJECTED | NOT_FOUND |
//       RATE_LIMITED | SERVER_ERROR | UNEXPECTED_STATUS | TIMEOUT | NETWORK

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

const parseRetryAfter = (header) => {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  return Number.isFinite(at) ? Math.max(0, at - Date.now()) : null;
};

const parseJson = (text) => {
  try { return JSON.parse(text); } catch { return undefined; }
};

const classifyStatus = (status) => {
  if (status === 400) return { kind: 'BAD_REQUEST',   retryable: false };
  if (status === 401 || status === 403) return { kind: 'AUTH_REJECTED', retryable: true };
  if (status === 404) return { kind: 'NOT_FOUND',     retryable: false };
  if (status === 429) return { kind: 'RATE_LIMITED',  retryable: true };
  if (status >= 500)  return { kind: 'SERVER_ERROR',  retryable: true };
  return { kind: 'UNEXPECTED_STATUS', retryable: true };
};

const createClient = ({ config, fetchImpl = globalThis.fetch, sleep = defaultSleep }) => {
  if (typeof fetchImpl !== 'function') {
    throw new Error('global fetch is not available — Node.js 18+ is required');
  }

  const once = async (url, { body, contentType, isSuccess }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': contentType, Accept: 'application/json, text/plain, */*' },
        body,
        signal: controller.signal,
      });
      const text = await res.text();
      const data = parseJson(text);

      if (res.status >= 200 && res.status < 300) {
        if (isSuccess(data)) return { ok: true, kind: 'OK', status: res.status, data, retryable: false };
        return {
          ok: false, kind: 'INVALID_RESPONSE', status: res.status, data, retryable: true,
          message: 'Unexpected response body',
        };
      }

      const { kind, retryable } = classifyStatus(res.status);
      return {
        ok: false, kind, status: res.status, data, retryable,
        retryAfterMs: res.status === 429 ? parseRetryAfter(res.headers?.get?.('retry-after')) : null,
        message: `HTTP ${res.status}`,
      };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { ok: false, kind: 'TIMEOUT', status: null, retryable: true, message: `Timed out after ${config.requestTimeoutMs}ms` };
      }
      return { ok: false, kind: 'NETWORK', status: null, retryable: true, message: err.cause?.code || err.message };
    } finally {
      clearTimeout(timer);
    }
  };

  // Bounded retry with exponential backoff. `retryTimeouts: false` for /main:
  // a timed-out POST may already have been accepted, and the PDF defines no
  // idempotency key — so those are retried later by the outbox, not immediately.
  const request = async (url, opts) => {
    const retries = Math.max(0, config.httpRetries);
    let result;
    for (let attempt = 0; attempt <= retries; attempt++) {
      result = await once(url, opts);
      result.httpAttempts = attempt + 1;

      const immediateRetry =
        ['NETWORK', 'SERVER_ERROR', 'RATE_LIMITED'].includes(result.kind) ||
        (result.kind === 'TIMEOUT' && opts.retryTimeouts);
      if (!immediateRetry || attempt === retries) break;

      const backoff = config.httpRetryBaseMs * 2 ** attempt;
      await sleep(Math.max(backoff, result.retryAfterMs || 0));
    }
    return result;
  };

  return {
    // PDF /auth: JSON body; response is { id, key, expire } (documented as "newkey { ... }")
    postAuth: (payload) => request(config.authUrl, {
      body: JSON.stringify(payload),
      contentType: 'application/json',
      retryTimeouts: true,
      isSuccess: (data) => !!data && typeof data === 'object',
    }),

    // PDF /main: encrypted base64 string, content type text/plain; ack { "Action": "OK" }
    postData: (encryptedText) => request(config.dataUrl, {
      body: encryptedText,
      contentType: 'text/plain',
      retryTimeouts: false,
      isSuccess: (data) => !!data && data.Action === 'OK',
    }),
  };
};

module.exports = { createClient, classifyStatus, parseRetryAfter };
