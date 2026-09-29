// Minimal pub/sub so the axios 401 interceptor (outside React) can tell
// AuthContext to log the user out, mirroring the web client's behavior of
// clearing storage and bouncing to Login on an expired/invalid token.
const listeners = new Set();

export function onUnauthorized(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitUnauthorized() {
  listeners.forEach((listener) => listener());
}
