import { Injectable } from '@nestjs/common';
import { Role } from '../../database/tenant/role.entity';
import { TenantSchemaService } from '../tenant/tenant-schema.service';
import { isSystemRole, systemRole } from './permissions';

interface RequestLike {
  user?: { role?: string; schoolId?: string };
  tenant?: { schemaName?: string; schoolId?: string };
  __perms?: Set<string>;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  /** Effective permission set for the request's user (cached on the request). */
  async resolve(req: RequestLike): Promise<Set<string>> {
    if (req.__perms) return req.__perms;
    const roleKey = req.user?.role;
    let perms: string[] = [];

    if (roleKey && isSystemRole(roleKey)) {
      perms = systemRole(roleKey)?.permissions ?? [];
    } else if (roleKey && req.tenant?.schemaName) {
      const schoolId = req.tenant.schoolId ?? req.user?.schoolId ?? '';
      const role = await this.tenant.runInSchema(
        req.tenant.schemaName,
        (em) =>
          em.getRepository(Role).findOne({ where: { schoolId, key: roleKey } }),
      );
      perms = role?.permissions ?? [];
    }

    const set = new Set(perms);
    req.__perms = set;
    return set;
  }

  isAdmin(roleKey?: string): boolean {
    return (
      roleKey === 'owner' || roleKey === 'admin' || roleKey === 'manager'
    );
  }
}
