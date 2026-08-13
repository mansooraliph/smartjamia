import { EntityManager, In } from 'typeorm';
import { BiometricEnrollment } from '../../database/tenant/biometric-enrollment.entity';

export type BiometricStatus = 'enrolled' | 'pending' | 'none';

/**
 * Look up each id's biometric enrollment status on the given FK column
 * ('enrolled' beats 'pending' when a user has rows in both states, e.g. one
 * finger captured and a second still queued). Ids with no row are 'none'.
 */
export async function getBiometricStatusMap(
  em: EntityManager,
  schoolId: string,
  fk: 'studentId' | 'staffId' | 'visitorId',
  ids: string[],
): Promise<Map<string, BiometricStatus>> {
  const map = new Map<string, BiometricStatus>();
  if (!ids.length) return map;
  const rows = await em.getRepository(BiometricEnrollment).find({
    where: { schoolId, [fk]: In(ids) } as any,
    select: { [fk]: true, status: true } as any,
  });
  for (const r of rows) {
    const id = (r as any)[fk] as string | null;
    if (!id) continue;
    if (r.status === 'enrolled') map.set(id, 'enrolled');
    else if (!map.has(id)) map.set(id, 'pending');
  }
  return map;
}
