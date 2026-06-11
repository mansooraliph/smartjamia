import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import slugify from 'slugify';
import { Role } from '../../../database/tenant/role.entity';
import { User } from '../../../database/tenant/user.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import {
  ALL_PERMISSIONS,
  PERMISSION_MODULES,
  SYSTEM_ROLES,
  isSystemRole,
  sanitizePermissions,
} from '../../../common/rbac/permissions';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

export interface RoleView {
  id: string | null; // null for system roles
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
}

@Injectable()
export class RolesService {
  constructor(private readonly tenant: TenantSchemaService) {}

  /** Catalog of modules + permissions for the role editor UI. */
  catalog() {
    return { modules: PERMISSION_MODULES, permissions: ALL_PERMISSIONS };
  }

  /** All roles: built-in (constants) + custom (DB), with user counts. */
  list(schemaName: string, schoolId: string): Promise<RoleView[]> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const custom = await em
        .getRepository(Role)
        .find({ where: { schoolId }, order: { name: 'ASC' } });

      // count users per effective role
      const users = await em
        .getRepository(User)
        .createQueryBuilder('u')
        .select('COALESCE(u.role_key, u.role::text)', 'rolekey')
        .addSelect('COUNT(*)', 'count')
        .where('u.schoolId = :schoolId', { schoolId })
        .andWhere('u.deletedAt IS NULL')
        .andWhere("u.role NOT IN ('student','parent')")
        .groupBy('COALESCE(u.role_key, u.role::text)')
        .getRawMany<{ rolekey: string; count: string }>();
      const countByKey = new Map(users.map((r) => [r.rolekey, Number(r.count)]));

      const system: RoleView[] = SYSTEM_ROLES.map((r) => ({
        id: null,
        key: r.key,
        name: r.name,
        description: r.description ?? null,
        isSystem: true,
        permissions: r.permissions,
        userCount: countByKey.get(r.key) ?? 0,
      }));
      const customViews: RoleView[] = custom.map((r) => ({
        id: r.id,
        key: r.key,
        name: r.name,
        description: r.description,
        isSystem: false,
        permissions: r.permissions ?? [],
        userCount: countByKey.get(r.key) ?? 0,
      }));
      return [...system, ...customViews];
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateRoleDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Role);
      const key = await this.uniqueKey(em, schoolId, dto.name);
      const role = repo.create({
        schoolId,
        key,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        permissions: sanitizePermissions(dto.permissions),
      });
      return repo.save(role);
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateRoleDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Role);
      const role = await repo.findOne({ where: { id, schoolId } });
      if (!role) throw new NotFoundException('Role not found');
      if (dto.name !== undefined) role.name = dto.name.trim();
      if (dto.description !== undefined)
        role.description = dto.description?.trim() || null;
      if (dto.permissions !== undefined)
        role.permissions = sanitizePermissions(dto.permissions);
      return repo.save(role);
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Role);
      const role = await repo.findOne({ where: { id, schoolId } });
      if (!role) throw new NotFoundException('Role not found');
      const assigned = await em
        .getRepository(User)
        .count({ where: { schoolId, roleKey: role.key } });
      if (assigned > 0) {
        throw new BadRequestException(
          `Cannot delete — ${assigned} user(s) still have this role. Reassign them first.`,
        );
      }
      await repo.remove(role);
      return { deleted: true, id };
    });
  }

  private async uniqueKey(
    em: { getRepository: (e: typeof Role) => any },
    schoolId: string,
    name: string,
  ): Promise<string> {
    const base = slugify(name, { lower: true, strict: true, trim: true }) || 'role';
    if (isSystemRole(base)) {
      throw new ConflictException(
        `"${name}" collides with a built-in role — choose another name.`,
      );
    }
    const repo = em.getRepository(Role);
    let key = base;
    let i = 2;
    // ensure unique within the school (and never a system key)
    while (isSystemRole(key) || (await repo.findOne({ where: { schoolId, key } }))) {
      key = `${base}-${i++}`;
    }
    return key;
  }
}
