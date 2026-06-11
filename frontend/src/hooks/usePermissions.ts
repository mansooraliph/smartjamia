import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RbacApi } from '@/services/school.api';
import { useAuthStore } from '@/stores/auth.store';
import { AccessCtx, PermAction, can as canFn, isAdminRole } from '@/lib/access';

/**
 * The logged-in user's effective role + permission set (from /school/me),
 * with helpers. Falls back to the auth-store role while loading so admins
 * aren't briefly locked out.
 */
export function usePermissions() {
  const role = useAuthStore((s) => s.user?.role);
  const { data } = useQuery({
    queryKey: ['me-permissions'],
    queryFn: RbacApi.me,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  return useMemo(() => {
    const isAdmin = data?.isAdmin ?? isAdminRole(role);
    const permissions = new Set(data?.permissions ?? []);
    const ctx: AccessCtx = { isAdmin, permissions };
    return {
      isAdmin,
      permissions,
      ctx,
      role: data?.role ?? role,
      isSystem: data?.isSystem ?? true,
      loaded: !!data,
      can: (moduleKey: string, action: PermAction) =>
        canFn(ctx, moduleKey, action),
    };
  }, [data, role]);
}
