import api from '@/lib/axios';
import { PermissionCatalog, RoleView } from '@/services/school.api';

function unwrap<T>(r: { data: { data?: T } | T }): T {
  const body: any = r.data;
  return (body?.data ?? body) as T;
}

export const OrgRolesApi = {
  catalog: async (schoolId: string): Promise<PermissionCatalog> =>
    unwrap(await api.get(`/org/schools/${schoolId}/roles/catalog`)),
  list: async (schoolId: string): Promise<RoleView[]> =>
    unwrap(await api.get(`/org/schools/${schoolId}/roles`)),
  create: async (
    schoolId: string,
    data: { name: string; description?: string; permissions: string[] },
  ): Promise<RoleView> => unwrap(await api.post(`/org/schools/${schoolId}/roles`, data)),
  update: async (
    schoolId: string,
    id: string,
    data: { name?: string; description?: string; permissions?: string[] },
  ): Promise<RoleView> => unwrap(await api.patch(`/org/schools/${schoolId}/roles/${id}`, data)),
  remove: async (schoolId: string, id: string) =>
    unwrap(await api.delete(`/org/schools/${schoolId}/roles/${id}`)),
  updateSystemRole: async (
    schoolId: string,
    key: string,
    permissions: string[],
  ): Promise<RoleView> =>
    unwrap(await api.patch(`/org/schools/${schoolId}/roles/system/${key}`, { permissions })),
  resetSystemRole: async (schoolId: string, key: string) =>
    unwrap(await api.delete(`/org/schools/${schoolId}/roles/system/${key}`)),
};
