import { EntityManager } from 'typeorm';
import { SchoolProfile } from '../../database/tenant/school-profile.entity';

/**
 * Device user-code (PIN) scheme. Every enrolled user gets a type prefix so the
 * same base id can't collide across user types and a punch's PIN is decodable
 * back to its user type. Prefixes are configurable per school (device settings,
 * stored in school_profile.settings.biometricPrefixes); these are the defaults:
 *
 *   Student  → `S` + admission_number
 *   Teacher  → `T` + employee_id
 *   Staff    → `E` + employee_id      (non-teaching)
 *   Visitor  → `V` + short visitor id
 *
 * A prefix is nullable — a school can clear it for a given user type so that
 * type's device PIN is just the raw base id with no prefix. A cleared prefix
 * can't be used to decode a punch back to its type (see parseUserCode), so
 * those codes fall back to raw match for backward compatibility (see
 * IclockService.resolveUsers).
 */
export type EnrollUserType = 'student' | 'teacher' | 'staff' | 'visitor';

export type PrefixConfig = Record<EnrollUserType, string | null>;

export const ENROLL_USER_TYPES: EnrollUserType[] = [
  'student',
  'teacher',
  'staff',
  'visitor',
];

export const DEFAULT_PREFIXES: PrefixConfig = {
  student: 'S',
  teacher: 'T',
  staff: 'E',
  visitor: 'V',
};

/** Build the device PIN for a user from its type + base identifier. */
export function buildUserCode(
  type: EnrollUserType,
  base: string,
  prefixes: PrefixConfig = DEFAULT_PREFIXES,
): string {
  return `${prefixes[type] ?? ''}${base}`;
}

/** Short, stable identifier for a visitor (first 8 hex chars of the UUID). */
export function visitorBase(visitorId: string): string {
  return visitorId.replace(/-/g, '').slice(0, 8);
}

export interface ParsedUserCode {
  type: EnrollUserType;
  base: string;
}

/** Decode a prefixed device PIN (longest matching prefix wins), or null. */
export function parseUserCode(
  code: string,
  prefixes: PrefixConfig = DEFAULT_PREFIXES,
): ParsedUserCode | null {
  if (!code) return null;
  let best: { type: EnrollUserType; prefix: string } | null = null;
  for (const type of ENROLL_USER_TYPES) {
    const p = prefixes[type];
    if (p && code.startsWith(p) && (!best || p.length > best.prefix.length)) {
      best = { type, prefix: p };
    }
  }
  if (!best) return null;
  return { type: best.type, base: code.slice(best.prefix.length) };
}

/**
 * Normalize a (partial) prefix config, filling gaps with the defaults. A key
 * that's absent from `input` keeps its default; a key explicitly set to
 * `null`/`''` is persisted as `null` (no prefix for that type).
 */
export function sanitizePrefixes(input: unknown): PrefixConfig {
  const raw = (input ?? {}) as Partial<Record<EnrollUserType, string | null>>;
  const out: PrefixConfig = { ...DEFAULT_PREFIXES };
  for (const t of ENROLL_USER_TYPES) {
    if (!(t in raw)) continue;
    const v = raw[t];
    const trimmed = typeof v === 'string' ? v.trim() : '';
    out[t] = trimmed || null;
  }
  return out;
}

/**
 * Validate a prefix config for use. Returns an error message, or null if valid.
 * A prefix may be null (no prefix for that user type); when set, it must be
 * 1-8 alphanumerics, and no prefix may be a leading substring of another
 * (which would make PIN parsing ambiguous).
 */
export function validatePrefixes(prefixes: PrefixConfig): string | null {
  for (const t of ENROLL_USER_TYPES) {
    const p = prefixes[t];
    if (p == null) continue;
    if (!/^[A-Za-z0-9]{1,8}$/.test(p)) {
      return `Prefix "${p}" (${t}) must be 1-8 letters or digits`;
    }
  }
  for (const a of ENROLL_USER_TYPES) {
    for (const b of ENROLL_USER_TYPES) {
      const pa = prefixes[a];
      const pb = prefixes[b];
      if (a !== b && pa && pb && pb.startsWith(pa)) {
        return `Prefix "${pa}" (${a}) conflicts with "${pb}" (${b}) — one can't start the other`;
      }
    }
  }
  return null;
}

/** Read the prefix config out of a school_profile.settings blob. */
export function prefixesFromSettings(
  settings?: Record<string, unknown>,
): PrefixConfig {
  return sanitizePrefixes(
    (settings as { biometricPrefixes?: unknown } | undefined)?.biometricPrefixes,
  );
}

/** Load a school's configured prefixes from its profile (tenant schema). */
export async function loadBiometricPrefixes(
  em: EntityManager,
  schoolId: string,
): Promise<PrefixConfig> {
  const profile = await em
    .getRepository(SchoolProfile)
    .findOne({ where: { schoolId }, select: { id: true, settings: true } });
  return prefixesFromSettings(profile?.settings);
}
