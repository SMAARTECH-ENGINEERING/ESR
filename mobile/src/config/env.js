import Constants from 'expo-constants';

// Deployed backend (server/.env PORT=5000 locally, hosted here in prod/Expo Go).
const HOSTED_API_URL = 'https://esr-zjwg.onrender.com';
const DEV_PORT = 5000;

// Set true only when running the backend locally (`cd server && npm run dev`)
// and testing on a device/emulator on the same LAN as this machine.
const USE_LOCAL_BACKEND = false;

function getDevHost() {
  // Derive the dev machine's LAN IP from the Metro bundler host so the app
  // works on a physical device / emulator without hardcoding an IP.
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }
  return 'localhost';
}

export const API_BASE_URL = USE_LOCAL_BACKEND
  ? `http://${getDevHost()}:${DEV_PORT}/api`
  : `${HOSTED_API_URL}/api`;

export const SOCKET_URL = USE_LOCAL_BACKEND ? `http://${getDevHost()}:${DEV_PORT}` : HOSTED_API_URL;

// Render free-tier services cold-start after idling (can take 30-50s to wake).
export const REQUEST_TIMEOUT_MS = 45000;
