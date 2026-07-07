import { Injectable } from '@nestjs/common';
import { TenantSchemaService } from './tenant-schema.service';
import { User, UserRole } from '../../database/tenant/user.entity';

export interface EnsureUserInput {
  schemaName: string;
  schoolId: string;
  name: string;
  email: string;
  role: UserRole;
}

/**
 * Find-or-create a tenant `users` row for a central account's mirror. Keyed by
 * (schoolId, email) — the unique constraint on the users table — so granting an
 * account a school it already has a user in (e.g. it IS the school's owner)
 * links to that existing row instead of duplicating it.
 *
 * The mirror user has no password/PIN of its own; the account authenticates
 * centrally and `select-school` issues a tenant token pointing at this row.
 */
@Injectable()
export class TenantUserService {
  constructor(private readonly tenantSchema: TenantSchemaService) {}

  ensureUser(input: EnsureUserInput): Promise<string> {
    return this.tenantSchema.runInSchema(input.schemaName, async (em) => {
      const repo = em.getRepository(User);
      const existing = await repo.findOne({
        where: { schoolId: input.schoolId, email: input.email },
        withDeleted: true,
      });
      if (existing) {
        // Reactivate + realign role if it had been soft-removed / changed.
        if (existing.deletedAt || !existing.isActive || existing.role !== input.role) {
          existing.deletedAt = null;
          existing.isActive = true;
          existing.role = input.role;
          await repo.save(existing);
        }
        return existing.id;
      }
      const created = await repo.save(
        repo.create({
          schoolId: input.schoolId,
          name: input.name,
          email: input.email,
          passwordHash: null,
          pinHash: null,
          role: input.role,
          isActive: true,
        }),
      );
      return created.id;
    });
  }

  /** Deactivate the mirror user (used when a grant is revoked). */
  deactivateUser(schemaName: string, userId: string): Promise<void> {
    return this.tenantSchema.runInSchema(schemaName, async (em) => {
      await em.getRepository(User).update({ id: userId }, { isActive: false });
    });
  }
}
