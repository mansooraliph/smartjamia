import api from '@/lib/axios';

// ───── Types ────────────────────────────────────────────────────────────────
export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceMonthly: number; // paise
  priceYearly: number;
  trialDays: number;
  maxUsers: number;
  maxStudents: number;
  maxStaff: number;
  features: string[];
  limits: Record<string, unknown>;
  isActive: boolean;
  isFeatured: boolean;
  isCustom: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface School {
  id: string;
  slug: string;
  code: string;
  name: string;
  email: string;
  phone: string | null;
  logoUrl: string | null;
  planId: string | null;
  plan?: Plan | null;
  organizationId: string | null;
  schemaName: string;
  isSchemaProvisioned: boolean;
  status: 'trial' | 'active' | 'grace_period' | 'suspended' | 'cancelled';
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  subscriptionStartsAt: string | null;
  subscriptionEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateSchoolPayload extends Partial<School> {
  ownerName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
}

export type OrganizationStatus = 'active' | 'inactive';

export interface Organization {
  id: string;
  name: string;
  adminName: string | null;
  adminEmail: string;
  adminPhone: string | null;
  maxSchoolsAllowed: number; // -1 = unlimited
  status: OrganizationStatus;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  /** Schools currently occupying a slot — present on list/get responses. */
  schoolsUsed: number;
}

export interface CreateOrganizationPayload {
  name: string;
  adminName?: string;
  adminEmail: string;
  adminPhone?: string;
  maxSchoolsAllowed: number;
  status?: OrganizationStatus;
  /** If set, also creates the org-admin login with this password. */
  adminPassword?: string;
}

export interface UpdateOrganizationPayload
  extends Partial<CreateOrganizationPayload> {
  /** Confirm lowering maxSchoolsAllowed below current usage. */
  force?: boolean;
}

export interface Branch {
  id: string;
  schoolId: string;
  school?: School;
  name: string;
  code: string;
  isPrimary: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  phone: string | null;
  email: string | null;
  principalName: string | null;
  studentCapacity: number | null;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  schoolId: string;
  planId: string;
  school?: School;
  plan?: Plan;
  status: 'trial' | 'active' | 'grace_period' | 'cancelled' | 'expired';
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  amount: number;
  currency: string;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  paymentGateway: 'razorpay' | 'stripe' | 'manual' | null;
  gatewaySubscriptionId: string | null;
  gatewayCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  schools: { total: number; active: number; trial: number };
  plans: { total: number; active: number };
  subscriptions: { total: number; active: number };
  branches: { total: number };
  superadmins: { total: number };
}

// helper to unwrap response envelope
function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

// ───── Stats ────────────────────────────────────────────────────────────────
export const StatsApi = {
  overview: async (): Promise<Stats> =>
    unwrap(await api.get('/superadmin/stats')),
};

// ───── Plans ────────────────────────────────────────────────────────────────
export const PlansApi = {
  list: async (): Promise<Plan[]> => unwrap(await api.get('/superadmin/plans')),
  get: async (id: string): Promise<Plan> =>
    unwrap(await api.get(`/superadmin/plans/${id}`)),
  create: async (data: Partial<Plan>): Promise<Plan> =>
    unwrap(await api.post('/superadmin/plans', data)),
  update: async (id: string, data: Partial<Plan>): Promise<Plan> =>
    unwrap(await api.patch(`/superadmin/plans/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/superadmin/plans/${id}`)),
};

// ───── Schools ──────────────────────────────────────────────────────────────
export const SchoolsApi = {
  list: async (): Promise<School[]> =>
    unwrap(await api.get('/superadmin/schools')),
  listByOrg: async (organizationId: string): Promise<School[]> =>
    unwrap(
      await api.get('/superadmin/schools', { params: { organizationId } }),
    ),
  get: async (id: string): Promise<School> =>
    unwrap(await api.get(`/superadmin/schools/${id}`)),
  create: async (data: CreateSchoolPayload): Promise<School> =>
    unwrap(await api.post('/superadmin/schools', data)),
  update: async (id: string, data: Partial<School>): Promise<School> =>
    unwrap(await api.patch(`/superadmin/schools/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/superadmin/schools/${id}`)),
  provision: async (
    id: string,
  ): Promise<{
    schoolId: string;
    schemaName: string;
    totalRowsMoved: number;
    movedRows: Record<string, number>;
  }> => unwrap(await api.post(`/superadmin/schools/${id}/provision`)),
  getOwner: async (
    id: string,
  ): Promise<{ id: string; name: string; email: string; isActive: boolean } | null> =>
    unwrap(await api.get(`/superadmin/schools/${id}/owner`)),
  setOwner: async (
    id: string,
    data: { name?: string; email?: string; password?: string },
  ): Promise<{ id: string; name: string; email: string; created: boolean }> =>
    unwrap(await api.put(`/superadmin/schools/${id}/owner`, data)),
  /** Issue a tenant session for the school's admin — no password needed. */
  impersonate: async (id: string): Promise<ImpersonationSession> =>
    unwrap(await api.post(`/superadmin/schools/${id}/impersonate`)),
  getSummary: async (id: string): Promise<SchoolSummary> =>
    unwrap(await api.get(`/superadmin/schools/${id}/summary`)),
  getUsers: async (id: string): Promise<SchoolUser[]> =>
    unwrap(await api.get(`/superadmin/schools/${id}/users`)),
};

export interface SchoolSummary {
  studentsCount: number;
  staffCount: number;
  classesCount: number;
  sectionsCount: number;
}

export interface SchoolUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

/** Tenant session for the school owner, tagged so the UI knows it's borrowed. */
export interface ImpersonationSession {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    schoolId: string;
    schoolSlug: string;
  };
  school: { id: string; slug: string; status: string };
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
  impersonating: true;
}

// ───── Organizations ────────────────────────────────────────────────────────
export const OrganizationsApi = {
  list: async (): Promise<Organization[]> =>
    unwrap(await api.get('/superadmin/organizations')),
  get: async (id: string): Promise<Organization> =>
    unwrap(await api.get(`/superadmin/organizations/${id}`)),
  create: async (data: CreateOrganizationPayload): Promise<Organization> =>
    unwrap(await api.post('/superadmin/organizations', data)),
  update: async (
    id: string,
    data: UpdateOrganizationPayload,
  ): Promise<Organization> =>
    unwrap(await api.patch(`/superadmin/organizations/${id}`, data)),
  deactivate: async (
    id: string,
    suspendSchools: boolean,
  ): Promise<{ id: string; status: OrganizationStatus; schoolsSuspended: number }> =>
    unwrap(
      await api.patch(`/superadmin/organizations/${id}/deactivate`, {
        suspendSchools,
      }),
    ),
  activate: async (
    id: string,
  ): Promise<{ id: string; status: OrganizationStatus; schoolsRestored: number }> =>
    unwrap(await api.patch(`/superadmin/organizations/${id}/activate`)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/superadmin/organizations/${id}`)),
  availableSchools: async (id: string): Promise<School[]> =>
    unwrap(await api.get(`/superadmin/organizations/${id}/available-schools`)),
  attachSchool: async (id: string, schoolId: string): Promise<School> =>
    unwrap(
      await api.post(`/superadmin/organizations/${id}/schools/attach`, {
        schoolId,
      }),
    ),
  detachSchool: async (id: string, schoolId: string) =>
    unwrap(await api.delete(`/superadmin/organizations/${id}/schools/${schoolId}`)),
};

// ───── Platform maintenance ─────────────────────────────────────────────────
export const MaintenanceApi = {
  runExpiry: async (): Promise<{
    checked: number;
    toGrace: number;
    toSuspended: number;
    restored: number;
  }> => unwrap(await api.post('/superadmin/maintenance/run-expiry')),
};

// ───── Branches ─────────────────────────────────────────────────────────────
export const BranchesApi = {
  list: async (schoolId?: string): Promise<Branch[]> =>
    unwrap(
      await api.get('/superadmin/branches', {
        params: schoolId ? { schoolId } : undefined,
      }),
    ),
  get: async (id: string): Promise<Branch> =>
    unwrap(await api.get(`/superadmin/branches/${id}`)),
  create: async (data: Partial<Branch>): Promise<Branch> =>
    unwrap(await api.post('/superadmin/branches', data)),
  update: async (id: string, data: Partial<Branch>): Promise<Branch> =>
    unwrap(await api.patch(`/superadmin/branches/${id}`, data)),
  remove: async (id: string) =>
    unwrap(await api.delete(`/superadmin/branches/${id}`)),
};

// ───── Subscriptions ────────────────────────────────────────────────────────
export const SubscriptionsApi = {
  list: async (schoolId?: string): Promise<Subscription[]> =>
    unwrap(
      await api.get('/superadmin/subscriptions', {
        params: schoolId ? { schoolId } : undefined,
      }),
    ),
  get: async (id: string): Promise<Subscription> =>
    unwrap(await api.get(`/superadmin/subscriptions/${id}`)),
  create: async (data: Partial<Subscription>): Promise<Subscription> =>
    unwrap(await api.post('/superadmin/subscriptions', data)),
  update: async (
    id: string,
    data: Partial<Subscription>,
  ): Promise<Subscription> =>
    unwrap(await api.patch(`/superadmin/subscriptions/${id}`, data)),
  cancel: async (id: string, immediate = false): Promise<Subscription> =>
    unwrap(
      await api.post(
        `/superadmin/subscriptions/${id}/cancel?immediate=${immediate}`,
      ),
    ),
  remove: async (id: string) =>
    unwrap(await api.delete(`/superadmin/subscriptions/${id}`)),
};

// ───── Biometric devices ────────────────────────────────────────────────────
export interface SaPaginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BiometricDevice {
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
  schoolId: string | null;
  school?: School | null;
  assignedAt: string | null;
  isApproved: boolean;
  approvedAt: string | null;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  lastSyncAt: string | null;
  lastActivity: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BiometricCommand {
  id: string;
  sn: string;
  schoolId: string | null;
  command: string;
  status: number; // 0 pending, 1 success, 2 error
  deviceReturnCode: number | null;
  createdAt: string;
}

export interface ListDevicesParams {
  page?: number;
  limit?: number;
  search?: string;
  schoolId?: string;
  isApproved?: boolean;
  isAssigned?: boolean;
}

export const BiometricDevicesApi = {
  list: async (params?: ListDevicesParams): Promise<SaPaginated<BiometricDevice>> =>
    unwrap(await api.get('/superadmin/biometric-devices', { params })),
  unassigned: async (): Promise<BiometricDevice[]> =>
    unwrap(await api.get('/superadmin/biometric-devices/unassigned')),
  get: async (id: string): Promise<BiometricDevice> =>
    unwrap(await api.get(`/superadmin/biometric-devices/${id}`)),
  assign: async (id: string, schoolId: string): Promise<BiometricDevice> =>
    unwrap(await api.patch(`/superadmin/biometric-devices/${id}/assign`, { schoolId })),
  unassign: async (id: string): Promise<BiometricDevice> =>
    unwrap(await api.patch(`/superadmin/biometric-devices/${id}/unassign`, {})),
  approve: async (id: string): Promise<BiometricDevice> =>
    unwrap(await api.patch(`/superadmin/biometric-devices/${id}/approve`, {})),
  deactivate: async (id: string, reason: string): Promise<BiometricDevice> =>
    unwrap(await api.patch(`/superadmin/biometric-devices/${id}/deactivate`, { reason })),
  reactivate: async (id: string): Promise<BiometricDevice> =>
    unwrap(await api.patch(`/superadmin/biometric-devices/${id}/reactivate`, {})),
  restart: async (id: string) =>
    unwrap(await api.post(`/superadmin/biometric-devices/${id}/restart`, {})),
  sync: async (id: string) =>
    unwrap(await api.post(`/superadmin/biometric-devices/${id}/sync`, {})),
  remove: async (id: string) =>
    unwrap(await api.delete(`/superadmin/biometric-devices/${id}`)),
  deviceCommands: async (id: string): Promise<BiometricCommand[]> =>
    unwrap(await api.get(`/superadmin/biometric-devices/${id}/commands`)),
};
