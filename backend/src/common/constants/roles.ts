/** Tenant user roles and common access groups. */
export const ALL_ROLES = [
  'owner',
  'admin',
  'manager',
  'teacher',
  'staff',
  'cashier',
] as const;

/** Administrative roles — full management access. */
export const ADMIN_ROLES = ['owner', 'admin', 'manager'] as const;

/** Admins + teachers — exams, marks, attendance. */
export const TEACHING_ROLES = [
  'owner',
  'admin',
  'manager',
  'teacher',
] as const;

/** Front-office (gate / reception / accounts) + admins. */
export const FRONT_OFFICE_ROLES = [
  'owner',
  'admin',
  'manager',
  'staff',
  'cashier',
] as const;
