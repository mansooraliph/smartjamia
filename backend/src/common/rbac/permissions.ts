/**
 * Permission catalog + built-in role definitions for tenant RBAC.
 *
 * A permission key is `<module>:<action>` where action ∈ list | create | delete.
 *  - list   → may view / list the module (also drives sidebar visibility)
 *  - create → may create OR edit (write) in the module
 *  - delete → may delete in the module
 *
 * Built-in (system) roles are immutable and defined here. Custom roles live in
 * the tenant `roles` table and reference these same permission keys.
 */

export type PermAction = 'list' | 'create' | 'delete';

export interface PermModule {
  /** Module key — also the nav path prefix used for sidebar gating. */
  key: string;
  label: string;
  group: string;
  actions: PermAction[];
}

export const PERMISSION_MODULES: PermModule[] = [
  { key: '/setup/academic-years', label: 'Academic Years', group: 'Academic Setup', actions: ['list', 'create', 'delete'] },
  { key: '/setup/classes', label: 'Classes & Sections', group: 'Academic Setup', actions: ['list', 'create', 'delete'] },
  { key: '/setup/subjects', label: 'Subjects', group: 'Academic Setup', actions: ['list', 'create', 'delete'] },
  { key: '/promotion', label: 'Promotion', group: 'Academic Setup', actions: ['list', 'create'] },
  { key: '/students', label: 'Students', group: 'People', actions: ['list', 'create', 'delete'] },
  { key: '/parents', label: 'Parents', group: 'People', actions: ['list', 'create', 'delete'] },
  { key: '/staff', label: 'Staff', group: 'People', actions: ['list', 'create', 'delete'] },
  { key: '/transfer-certificates', label: 'Transfer Certificates', group: 'People', actions: ['list', 'create', 'delete'] },
  { key: '/attendance', label: 'Attendance', group: 'Operations', actions: ['list', 'create'] },
  { key: '/exams', label: 'Exams & Marks', group: 'Operations', actions: ['list', 'create', 'delete'] },
  { key: '/report-cards', label: 'Report Cards', group: 'Operations', actions: ['list', 'create'] },
  { key: '/timetable', label: 'Timetable', group: 'Operations', actions: ['list', 'create'] },
  { key: '/fees', label: 'Fees', group: 'Operations', actions: ['list', 'create', 'delete'] },
  { key: '/visitors', label: 'Visitors', group: 'Front Office', actions: ['list', 'create', 'delete'] },
  { key: '/visits', label: 'Visits', group: 'Front Office', actions: ['list', 'create', 'delete'] },
  { key: '/settings', label: 'Settings', group: 'System', actions: ['list', 'create'] },
  { key: '/roles', label: 'Roles & Permissions', group: 'System', actions: ['list', 'create', 'delete'] },
];

export function perm(moduleKey: string, action: PermAction): string {
  return `${moduleKey}:${action}`;
}

/** Flat list of every valid permission key. */
export const ALL_PERMISSIONS: string[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => perm(m.key, a)),
);
const ALL_PERMISSIONS_SET = new Set(ALL_PERMISSIONS);

export function isValidPermission(p: string): boolean {
  return ALL_PERMISSIONS_SET.has(p);
}

export function sanitizePermissions(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [
    ...new Set(
      input.filter((p): p is string => typeof p === 'string' && isValidPermission(p)),
    ),
  ];
}

// ── Built-in roles ─────────────────────────────────────────────────────────
export interface RoleDef {
  key: string;
  name: string;
  isSystem: boolean;
  description?: string;
  permissions: string[];
}

const allFor = (keys: string[]): string[] =>
  PERMISSION_MODULES.filter((m) => keys.includes(m.key)).flatMap((m) =>
    m.actions.map((a) => perm(m.key, a)),
  );

const listFor = (keys: string[]): string[] => keys.map((k) => perm(k, 'list'));

/**
 * System roles. owner/admin/manager get everything. teacher/staff/cashier
 * mirror the previous default menus + capabilities (least privilege).
 */
export const SYSTEM_ROLES: RoleDef[] = [
  { key: 'owner', name: 'Owner', isSystem: true, description: 'Full access — the school account owner.', permissions: [...ALL_PERMISSIONS] },
  { key: 'admin', name: 'Admin', isSystem: true, description: 'Full administrative access.', permissions: [...ALL_PERMISSIONS] },
  { key: 'manager', name: 'Manager', isSystem: true, description: 'Full management access.', permissions: [...ALL_PERMISSIONS] },
  {
    key: 'teacher',
    name: 'Teacher',
    isSystem: true,
    description: 'Classroom staff — attendance, exams, marks, timetable.',
    permissions: [
      ...listFor(['/students', '/timetable']),
      ...allFor(['/attendance', '/exams', '/report-cards']),
    ],
  },
  {
    key: 'staff',
    name: 'Staff',
    isSystem: true,
    description: 'Front-office / reception — visitor management.',
    permissions: [...allFor(['/visitors', '/visits'])],
  },
  {
    key: 'cashier',
    name: 'Cashier',
    isSystem: true,
    description: 'Fee collection + front office.',
    permissions: [...allFor(['/visitors', '/visits', '/fees'])],
  },
];

const SYSTEM_ROLE_MAP = new Map(SYSTEM_ROLES.map((r) => [r.key, r]));

export function isSystemRole(key?: string): boolean {
  return !!key && SYSTEM_ROLE_MAP.has(key);
}

export function systemRole(key: string): RoleDef | undefined {
  return SYSTEM_ROLE_MAP.get(key);
}

/** The base `users.role` enum values (unchanged); custom roles use role_key. */
export const BASE_ROLE_ENUM = [
  'owner',
  'admin',
  'manager',
  'teacher',
  'staff',
  'cashier',
] as const;
