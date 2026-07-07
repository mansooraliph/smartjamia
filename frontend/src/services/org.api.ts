import axios from 'axios';
import api from '@/lib/axios';

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

// ───── Types ────────────────────────────────────────────────────────────────
export interface OrgMe {
  id: string;
  name: string;
  adminName: string | null;
  adminEmail: string;
  adminPhone: string | null;
  maxSchoolsAllowed: number;
  status: 'active' | 'inactive';
  schoolsUsed: number;
}

export interface OrgSchool {
  id: string;
  name: string;
  code: string;
  slug: string;
  email: string;
  status: 'trial' | 'active' | 'grace_period' | 'suspended' | 'cancelled';
  createdAt: string;
}

export interface OrgGrant {
  id: string;
  role: string;
  status: 'active' | 'revoked';
  createdAt: string;
  userAccount?: { id: string; name: string; email: string } | null;
}

export interface CreateOrgSchoolPayload {
  name: string;
  code?: string;
  email: string;
  phone?: string;
  status?: OrgSchool['status'];
  ownerName?: string;
  ownerEmail?: string;
  ownerPassword?: string;
}

export interface CreateOrgGrantPayload {
  name: string;
  email: string;
  password?: string;
  role: string;
}

// ───── Org admin auth ─────────────────────────────────────────────────────────
export interface OrgLoginResult {
  admin: {
    id: string;
    name: string;
    email: string;
    organizationId: string;
    scope: 'organization';
  };
  organization: {
    id: string;
    name: string;
    maxSchoolsAllowed: number;
    status: string;
  };
  schools: { schoolId: string; code: string; slug: string; name: string; status: string }[];
  tokens: { accessToken: string; refreshToken: string; expiresIn: number };
}

/** Tenant session returned by select-school (shape mirrors school login). */
export interface TenantSession {
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
}

export const OrgAuthApi = {
  // Raw axios (no tenant header, no stale-token refresh) for login.
  login: async (email: string, password: string): Promise<OrgLoginResult> => {
    const r = await axios.post('/api/v1/auth/organization/login', {
      email,
      password,
    });
    return (r.data?.data ?? r.data) as OrgLoginResult;
  },
  // Raw axios with the explicit org token — after entering a school the active
  // token becomes a tenant token, so switching must present the org token.
  selectSchool: async (
    schoolId: string,
    orgToken: string,
  ): Promise<TenantSession> => {
    const r = await axios.post(
      '/api/v1/auth/organization/select-school',
      { schoolId },
      { headers: { Authorization: `Bearer ${orgToken}` } },
    );
    return (r.data?.data ?? r.data) as TenantSession;
  },
};

// ───── Org portal (scoped to the org token) ──────────────────────────────────
export const OrgPortalApi = {
  me: async (): Promise<OrgMe> => unwrap(await api.get('/org/me')),
  listSchools: async (): Promise<OrgSchool[]> =>
    unwrap(await api.get('/org/schools')),
  createSchool: async (payload: CreateOrgSchoolPayload): Promise<OrgSchool> =>
    unwrap(await api.post('/org/schools', payload)),
  removeSchool: async (id: string) =>
    unwrap(await api.delete(`/org/schools/${id}`)),
  listGrants: async (schoolId: string): Promise<OrgGrant[]> =>
    unwrap(await api.get(`/org/schools/${schoolId}/grants`)),
  grant: async (
    schoolId: string,
    payload: CreateOrgGrantPayload,
  ): Promise<OrgGrant> =>
    unwrap(await api.post(`/org/schools/${schoolId}/grants`, payload)),
  revokeGrant: async (grantId: string) =>
    unwrap(await api.delete(`/org/grants/${grantId}`)),
};
