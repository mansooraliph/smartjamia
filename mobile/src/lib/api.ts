import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAuthStore } from '../stores/auth.store';

/**
 * Dev-time host resolution: `localhost` only resolves to the phone/emulator
 * itself, not the dev machine running the backend. Expo's `hostUri`
 * (`<lan-ip>:<metro-port>`) gives us the dev machine's real LAN IP for free
 * when running under Expo Go / a dev client — reused here for the API host
 * too, since both processes run on the same machine during development.
 * Falls back to `localhost` for web and for a standalone/production build
 * (where API_BASE_URL should be overridden via app config instead).
 */
function resolveDevHost(): string {
  const hostUri = Constants.expoConfig?.hostUri ?? (Constants as any).manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) return host;
  }
  if (Platform.OS === 'android') return '10.0.2.2'; // Android emulator's alias for the host machine.
  return 'localhost';
}

export const API_BASE_URL = `http://${resolveDevHost()}:3002/api/v1`;

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const { token, schoolSlug } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (schoolSlug) config.headers['X-School-Slug'] = schoolSlug;
  return config;
});

/** Every backend response is wrapped `{success, data, message, timestamp}` (ResponseInterceptor, applies globally) — unwrap once here so call sites just get the real payload. */
api.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data === 'object' && 'data' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    const message = err.response?.data?.error?.message ?? err.response?.data?.message ?? err.message;
    return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
  },
);
