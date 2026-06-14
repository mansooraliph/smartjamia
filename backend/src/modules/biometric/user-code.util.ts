/**
 * Device user-code (PIN) scheme. Every enrolled user gets a single-letter type
 * prefix so the same numeric base can't collide across user types and a punch's
 * PIN is decodable back to its user type:
 *
 *   Student  → `S` + admission_number      e.g. S2024-001
 *   Teacher  → `T` + employee_id           e.g. TEMP07
 *   Staff    → `E` + employee_id           e.g. EEMP12   (non-teaching)
 *   Visitor  → `V` + short visitor id      e.g. Va1b2c3d4
 *
 * Legacy codes stored without a recognised prefix are still resolved by raw
 * match (see IclockService.resolveUsers) for backward compatibility.
 */
export type EnrollUserType = 'student' | 'teacher' | 'staff' | 'visitor';

export const USER_CODE_PREFIX: Record<EnrollUserType, string> = {
  student: 'S',
  teacher: 'T',
  staff: 'E',
  visitor: 'V',
};

const PREFIX_TO_TYPE: Record<string, EnrollUserType> = {
  S: 'student',
  T: 'teacher',
  E: 'staff',
  V: 'visitor',
};

/** Build the device PIN for a user from its type + base identifier. */
export function buildUserCode(type: EnrollUserType, base: string): string {
  return `${USER_CODE_PREFIX[type]}${base}`;
}

/** Short, stable identifier for a visitor (first 8 hex chars of the UUID). */
export function visitorBase(visitorId: string): string {
  return visitorId.replace(/-/g, '').slice(0, 8);
}

export interface ParsedUserCode {
  type: EnrollUserType;
  base: string;
}

/** Decode a prefixed device PIN, or null if it carries no known prefix. */
export function parseUserCode(code: string): ParsedUserCode | null {
  if (!code) return null;
  const type = PREFIX_TO_TYPE[code[0]];
  if (!type) return null;
  return { type, base: code.slice(1) };
}
