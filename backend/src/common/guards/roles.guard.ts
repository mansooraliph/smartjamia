import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { PermissionsService } from '../rbac/permissions.service';
import { isSystemRole } from '../rbac/permissions';

/**
 * Unified access guard. Two layers:
 *
 *  1. `@RequirePermissions(...)` — permission-based. Checked against the user's
 *     effective permission set (built-in role constants OR a custom role's
 *     stored permissions). Applies to EVERY role, so a built-in role's constant
 *     set must cover what it could previously do.
 *
 *  2. `@Roles(...)` — legacy role-name check, kept for endpoints not yet mapped
 *     to permissions. Built-in roles match by name as before; CUSTOM roles are
 *     denied here (they may only reach permission-annotated endpoints), so an
 *     un-mapped admin endpoint never leaks to a custom role.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly perms: PermissionsService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const requiredPerms = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user || !user.role) {
      throw new ForbiddenException('User role missing');
    }
    const roleKey: string = user.role;

    // Layer 1 — permission requirement (authoritative when present).
    if (requiredPerms && requiredPerms.length) {
      const held = await this.perms.resolve(req);
      const ok = requiredPerms.every((p) => held.has(p));
      if (!ok) {
        throw new ForbiddenException(
          `Missing permission: ${requiredPerms.join(', ')}`,
        );
      }
      return true;
    }

    // Layer 2 — legacy role-name requirement.
    if (requiredRoles && requiredRoles.length) {
      if (!isSystemRole(roleKey)) {
        // Custom roles can't satisfy a name-based check — deny.
        throw new ForbiddenException(
          'This action is not available for your role',
        );
      }
      if (!requiredRoles.includes(roleKey)) {
        throw new ForbiddenException(
          `Role "${roleKey}" is not allowed. Required: ${requiredRoles.join(', ')}`,
        );
      }
      return true;
    }

    return true;
  }
}
