import api from '@/lib/axios';
import {
  BiometricCommand,
  BiometricStats,
  BiometricTransaction,
  BiometricTxParams,
  Paginated,
  StudentsApi,
  StaffApi,
} from '@/services/school.api';
import type { BiometricType, EnrollUserType } from '@/constants/biometric';

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

const BASE = '/school/biometric-devices';

/** Full device shape returned by the school device endpoints (master entity). */
export interface BiometricDeviceDto {
  id: string;
  sn: string;
  alias: string | null;
  terminalName: string | null;
  deviceType: string;
  deviceModel: string | null;
  state: string | null;
  ipAddress: string | null;
  fwVer: string | null;
  userCount: number | null;
  fpCount: number | null;
  faceCount: number | null;
  palmCount: number | null;
  transactionCount: number | null;
  transferInterval: number | null;
  isApproved: boolean;
  assignedAt: string | null;
  deactivatedAt: string | null;
  lastSyncAt: string | null;
  lastActivity: string | null;
  createdAt: string;
}

export interface BulkActionResult {
  success_count: number;
  failed_count: number;
  failed_devices: string[];
  message: string;
}

export interface EnrollPayload {
  userCode: string;
  biometricType: BiometricType;
  fingerId?: number;
}

/** A user resolved to its device PIN, ready to enroll. */
export interface EnrollableUser {
  id: string;
  userType: EnrollUserType;
  code: string; // base identifier (admission #, employee id, visitor short id)
  userCode: string; // full device PIN (prefix + base)
  name: string;
  subtitle?: string;
}

export interface EnrollUserPayload {
  userType: EnrollUserType;
  userId: string;
  biometricType: BiometricType;
  fingerId?: number;
  deviceIds: string[];
}

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  unsynced: number;
}

export interface DevicePrefixes {
  student: string;
  teacher: string;
  staff: string;
  visitor: string;
}

export interface UserSearchResult {
  id: string;
  userCode: string;
  name: string;
  kind: 'student' | 'staff';
  subtitle?: string;
  photoUrl?: string | null;
}

/** A device is "online" when it polled recently and isn't deactivated. */
export function isOnline(d: BiometricDeviceDto): boolean {
  return !d.deactivatedAt && d.state === '1';
}

/** Derive the stats row from the device list (no extra backend call). */
export function deriveStats(devices: BiometricDeviceDto[]): DeviceStats {
  const dayMs = 24 * 60 * 60 * 1000;
  let online = 0;
  let unsynced = 0;
  for (const d of devices) {
    if (isOnline(d)) online++;
    const last = d.lastSyncAt ?? d.lastActivity;
    const stale = !last || Date.now() - new Date(last).getTime() > dayMs;
    if (stale) unsynced++;
  }
  return {
    total: devices.length,
    online,
    offline: devices.length - online,
    unsynced,
  };
}

export const BiometricDevicesApi = {
  // ── Queries ────────────────────────────────────────────────────────────────
  listDevices: async (): Promise<BiometricDeviceDto[]> =>
    unwrap(await api.get(BASE)),
  getDevice: async (id: string): Promise<BiometricDeviceDto> =>
    unwrap(await api.get(`${BASE}/${id}`)),
  stats: async (): Promise<BiometricStats> => unwrap(await api.get(`${BASE}/stats`)),
  listTransactions: async (
    params: BiometricTxParams,
  ): Promise<Paginated<BiometricTransaction>> =>
    unwrap(await api.get(`${BASE}/transactions`, { params })),
  listCommands: async (id: string): Promise<BiometricCommand[]> =>
    unwrap(await api.get(`${BASE}/${id}/commands`)),

  // ── Mutations: rename / single actions ──────────────────────────────────────
  rename: async (id: string, alias: string): Promise<BiometricDeviceDto> =>
    unwrap(await api.patch(`${BASE}/${id}/alias`, { alias })),
  restartDevice: async (id: string) =>
    unwrap(await api.post(`${BASE}/${id}/restart`, {})),
  readDeviceInfo: async (id: string) =>
    unwrap(await api.post(`${BASE}/${id}/read-info`, {})),
  setDuplicatePunch: async (id: string, seconds: number) =>
    unwrap(await api.post(`${BASE}/${id}/set-duplicate-punch`, { seconds })),
  enrollRemotely: async (id: string, payload: EnrollPayload) =>
    unwrap(await api.post(`${BASE}/${id}/enroll`, payload)),
  syncUsers: async (id: string) =>
    unwrap(await api.post(`${BASE}/${id}/sync-users`, {})),
  clearData: async (id: string) =>
    unwrap(await api.post(`${BASE}/${id}/clear-data`, {})),
  clearCommands: async (id: string): Promise<{ cleared: number; sn: string }> =>
    unwrap(await api.post(`${BASE}/${id}/clear-commands`, {})),
  deleteTransaction: async (id: string) =>
    unwrap(await api.delete(`${BASE}/transactions/${id}`)),

  // ── Mutations: bulk actions ─────────────────────────────────────────────────
  bulkRestart: async (deviceIds: string[]): Promise<BulkActionResult> =>
    unwrap(await api.post(`${BASE}/bulk/restart`, { deviceIds })),
  bulkReadInfo: async (deviceIds: string[]): Promise<BulkActionResult> =>
    unwrap(await api.post(`${BASE}/bulk/read-info`, { deviceIds })),
  bulkSetDuplicatePunch: async (
    deviceIds: string[],
    seconds: number,
  ): Promise<BulkActionResult> =>
    unwrap(await api.post(`${BASE}/bulk/set-duplicate-punch`, { deviceIds, seconds })),
  bulkEnroll: async (
    deviceIds: string[],
    payload: EnrollPayload,
  ): Promise<BulkActionResult> =>
    unwrap(await api.post(`${BASE}/bulk/enroll`, { deviceIds, ...payload })),

  // ── User enrollment (students / teachers / staff / visitors) ────────────────
  listEnrollableUsers: async (
    type: EnrollUserType,
    search?: string,
  ): Promise<EnrollableUser[]> =>
    unwrap(await api.get(`${BASE}/enroll/users`, { params: { type, search } })),
  enrollUser: async (payload: EnrollUserPayload): Promise<BulkActionResult> =>
    unwrap(await api.post(`${BASE}/enrollments`, payload)),

  // ── Device settings (configurable PIN prefixes) ─────────────────────────────
  getSettings: async (): Promise<{ prefixes: DevicePrefixes }> =>
    unwrap(await api.get(`${BASE}/settings`)),
  updateSettings: async (
    prefixes: DevicePrefixes,
  ): Promise<{ prefixes: DevicePrefixes }> =>
    unwrap(await api.put(`${BASE}/settings`, { prefixes })),

  // ── User search (for the enroll modal) — reuses existing endpoints ──────────
  searchUsers: async (query: string): Promise<UserSearchResult[]> => {
    const q = query.trim();
    if (!q) return [];
    const [students, staff] = await Promise.all([
      StudentsApi.lookup({ search: q }).catch(() => []),
      StaffApi.list({ search: q, limit: 10 }).catch(() => ({ items: [] }) as any),
    ]);
    const studentResults: UserSearchResult[] = students.map((s) => ({
      id: s.id,
      userCode: s.admissionNumber,
      name: `${s.firstName} ${s.lastName}`.trim(),
      kind: 'student',
      subtitle: s.admissionNumber,
    }));
    const staffResults: UserSearchResult[] = (staff.items ?? []).map((s: any) => ({
      id: s.id,
      userCode: s.employeeId,
      name: s.user?.name ?? s.employeeId,
      kind: 'staff',
      subtitle: `${s.employeeId}${s.designation ? ` · ${s.designation}` : ''}`,
      photoUrl: s.photoUrl,
    }));
    return [...studentResults, ...staffResults];
  },
};
