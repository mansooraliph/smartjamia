// Frontend access model — mirrors the backend RBAC. The backend guard is the
// real boundary; this gates the sidebar + action buttons + route navigation
// from the logged-in user's effective permission set (see usePermissions).

export const ADMIN_ROLES = ['owner', 'admin', 'manager'];

export function isAdminRole(role?: string): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

/** Display labels for built-in role keys — key values stay stable in the DB/API. */
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Principal',
  teacher: 'Teacher',
  staff: 'Staff',
  cashier: 'Cashier',
  student: 'Student',
  parent: 'Parent',
};

export function roleLabel(role?: string | null): string {
  if (!role) return '—';
  return ROLE_LABELS[role] ?? role.charAt(0).toUpperCase() + role.slice(1);
}

export type PermAction = 'list' | 'create' | 'delete';

/** Permission-gated module path-prefixes (mirror of backend PERMISSION_MODULES keys). */
export const MODULE_KEYS = [
  '/setup/academic-years',
  '/setup/classes',
  '/setup/subjects',
  '/promotion',
  '/students',
  '/parents',
  '/staff',
  '/transfer-certificates',
  '/attendance',
  '/exams',
  '/report-cards',
  '/timetable',
  '/fees',
  '/exam-board',
  '/visitors',
  '/visits',
  '/settings',
  '/roles',
];

/** Longest module key that prefixes the given pathname, or null. */
export function moduleForPath(pathname: string): string | null {
  let best: string | null = null;
  for (const k of MODULE_KEYS) {
    if (pathname === k || pathname.startsWith(k + '/')) {
      if (!best || k.length > best.length) best = k;
    }
  }
  return best;
}

export interface AccessCtx {
  isAdmin: boolean;
  permissions: Set<string>;
}

/** Can the user view/navigate this path? */
export function canAccessPath(ctx: AccessCtx, pathname: string): boolean {
  if (ctx.isAdmin) return true;
  if (pathname === '/' || pathname === '/dashboard' || pathname.startsWith('/dashboard/'))
    return true;
  const mod = moduleForPath(pathname);
  if (!mod) return false; // unknown / admin-only modules (library, reports…)
  return ctx.permissions.has(`${mod}:list`);
}

/** Can the user perform an action on a module? */
export function can(
  ctx: AccessCtx,
  moduleKey: string,
  action: PermAction,
): boolean {
  if (ctx.isAdmin) return true;
  return ctx.permissions.has(`${moduleKey}:${action}`);
}
