import axios, {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from 'axios';
import { useAuthStore } from '@/stores/auth.store';

const BASE_URL = '/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
});

// ── Request interceptor: attach JWT + tenant header ─────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken, schoolSlug, user } = useAuthStore.getState();
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  // Skip tenant header on platform-level endpoints
  const url = config.url ?? '';
  const isSuperadminPath =
    url.includes('/auth/superadmin') || url.includes('/superadmin');
  // Fall back to the user's own schoolSlug if the top-level one is missing.
  const tenantCode = schoolSlug ?? user?.schoolSlug ?? null;
  if (tenantCode && !isSuperadminPath) {
    config.headers.set('X-School-Code', tenantCode);
  }
  return config;
});

// ── Response interceptor: refresh on 401 once ──────────────────────────────
let isRefreshing = false;
let queue: Array<(token: string | null) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes('/auth/refresh') &&
      !original.url?.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push((token) => {
            if (token) {
              original.headers.set('Authorization', `Bearer ${token}`);
              resolve(api(original));
            } else {
              reject(error);
            }
          });
        });
      }

      original._retry = true;
      isRefreshing = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        const newAccess = data?.data?.tokens?.accessToken as
          | string
          | undefined;
        const newRefresh = data?.data?.tokens?.refreshToken as
          | string
          | undefined;
        if (!newAccess) throw new Error('Refresh failed');

        useAuthStore.getState().setTokens(newAccess, newRefresh ?? refreshToken);
        queue.forEach((cb) => cb(newAccess));
        queue = [];
        isRefreshing = false;

        original.headers.set('Authorization', `Bearer ${newAccess}`);
        return api(original);
      } catch (refreshErr) {
        queue.forEach((cb) => cb(null));
        queue = [];
        isRefreshing = false;
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.assign('/login');
        }
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
