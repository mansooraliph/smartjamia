import api from '@/lib/axios';

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

export interface OrgUserGrant {
  id: string;
  schoolId: string;
  schoolName: string;
  role: string;
  status: 'active' | 'revoked';
  createdAt: string;
}

export interface OrgUser {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive';
  createdAt: string;
  grants: OrgUserGrant[];
}

export interface OrgUserActivity {
  id: string;
  schoolId: string | null;
  event: 'login' | 'select_school';
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface CreateOrgUserPayload {
  name: string;
  email: string;
  password?: string;
  grants: { schoolId: string; role: string }[];
}

export const OrgUsersApi = {
  list: async (filters?: {
    schoolId?: string;
    role?: string;
    status?: string;
    search?: string;
  }): Promise<OrgUser[]> => unwrap(await api.get('/org/users', { params: filters })),
  create: async (payload: CreateOrgUserPayload): Promise<OrgUser> =>
    unwrap(await api.post('/org/users', payload)),
  addGrant: async (userId: string, schoolId: string, role: string) =>
    unwrap(await api.post(`/org/users/${userId}/grants`, { schoolId, role })),
  resetPassword: async (userId: string, password?: string) =>
    unwrap<{ reset: boolean; temporaryPassword?: string }>(
      await api.post(`/org/users/${userId}/reset-password`, { password }),
    ),
  activity: async (userId: string): Promise<OrgUserActivity[]> =>
    unwrap(await api.get(`/org/users/${userId}/activity`)),
  revokeGrant: async (grantId: string) => unwrap(await api.delete(`/org/grants/${grantId}`)),
};
