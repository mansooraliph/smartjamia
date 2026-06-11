import { IsObject } from 'class-validator';

/**
 * Roles whose menu/module visibility is admin-configurable. Admin roles
 * (owner/admin/manager) always see everything and are never stored here.
 */
export const CONFIGURABLE_ROLES = ['teacher', 'staff', 'cashier'] as const;
export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

/**
 * Module keys = the nav path prefixes the admin may grant. This list is the
 * backend's allow-list for sanitising whatever the client sends; the
 * authoritative eligibility/defaults (which role may see which) live in the
 * frontend `lib/access.ts`. The backend RolesGuard remains the real security
 * boundary — this map only narrows what the sidebar shows.
 */
export const ACCESS_MODULE_KEYS = [
  '/students',
  '/parents',
  '/attendance',
  '/exams',
  '/timetable',
  '/visitors',
  '/visits',
  '/fees',
  '/setup/academic-years',
  '/setup/classes',
  '/setup/subjects',
] as const;

// Per-role eligibility — mirrors the backend @Roles policy (and the frontend
// lib/access ROLE_ELIGIBLE) so a stored override can never grant a 403 module.
const READ_OPEN = [
  '/setup/academic-years',
  '/setup/classes',
  '/setup/subjects',
  '/students',
  '/parents',
  '/attendance',
];
export const ROLE_ELIGIBLE: Record<ConfigurableRole, string[]> = {
  teacher: [...READ_OPEN, '/exams', '/timetable'],
  staff: [...READ_OPEN, '/visitors', '/visits'],
  cashier: [...READ_OPEN, '/visitors', '/visits', '/fees'],
};

export type RoleAccessMap = Partial<Record<ConfigurableRole, string[]>>;

export class MenuAccessDto {
  @IsObject()
  roleAccess: RoleAccessMap;
}

export interface MenuAccessResult {
  roleAccess: RoleAccessMap;
}

/** Keep only configurable roles + per-role eligible module keys. */
export function sanitizeRoleAccess(input: unknown): RoleAccessMap {
  const out: RoleAccessMap = {};
  if (!input || typeof input !== 'object') return out;
  for (const role of CONFIGURABLE_ROLES) {
    const list = (input as Record<string, unknown>)[role];
    if (Array.isArray(list)) {
      const eligible = new Set(ROLE_ELIGIBLE[role]);
      out[role] = [
        ...new Set(
          list.filter(
            (k): k is string => typeof k === 'string' && eligible.has(k),
          ),
        ),
      ];
    }
  }
  return out;
}
