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
  billingCycle: 'monthly' | 'yearly';
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
  list: async (): Promise<Subscription[]> =>
    unwrap(await api.get('/superadmin/subscriptions')),
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
