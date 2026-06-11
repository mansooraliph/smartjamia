import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Superadmin } from '../../database/master/superadmin.entity';
import { User } from '../../database/tenant/user.entity';
import { Student } from '../../database/tenant/student.entity';
import { Parent } from '../../database/tenant/parent.entity';
import { Role } from '../../database/tenant/role.entity';
import { TenantResolverService } from '../../common/tenant/tenant-resolver.service';
import { TenantSchemaService } from '../../common/tenant/tenant-schema.service';
import {
  isSystemRole,
  systemRole,
} from '../../common/rbac/permissions';

@Injectable()
export class AuthService {
  private readonly superadminRepo: Repository<Superadmin>;

  constructor(
    @InjectDataSource('master') private readonly master: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenantResolver: TenantResolverService,
    private readonly tenantSchema: TenantSchemaService,
  ) {
    this.superadminRepo = master.getRepository(Superadmin);
  }

  // ─── Superadmin (platform) ────────────────────────────────────────────────
  async superadminLogin(email: string, password: string) {
    const sa = await this.superadminRepo
      .createQueryBuilder('sa')
      .addSelect('sa.passwordHash')
      .where('sa.email = :email', { email })
      .getOne();

    if (!sa) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!sa.isActive) {
      throw new ForbiddenException('Account is disabled');
    }
    const ok = await bcrypt.compare(password, sa.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.superadminRepo.update({ id: sa.id }, { lastLoginAt: new Date() });

    const payload = {
      sub: sa.id,
      email: sa.email,
      role: sa.role,
      type: 'access' as const,
      scope: 'superadmin' as const,
    };
    return {
      user: {
        id: sa.id,
        name: sa.name,
        email: sa.email,
        role: sa.role,
        scope: 'superadmin' as const,
      },
      tokens: await this.issueTokens(payload),
    };
  }

  // ─── Tenant / school user login ───────────────────────────────────────────
  async tenantLogin(schoolIdentifier: string, email: string, password: string) {
    const tenant = await this.tenantResolver.resolveByIdentifier(
      schoolIdentifier,
    );

    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      throw new ForbiddenException(`School is ${tenant.status}`);
    }

    const user = await this.tenantSchema.runInSchema(
      tenant.schemaName,
      async (em) => {
        return em
          .getRepository(User)
          .createQueryBuilder('u')
          .addSelect('u.passwordHash')
          .where('u.email = :email', { email })
          .andWhere('u.schoolId = :schoolId', { schoolId: tenant.schoolId })
          .andWhere('u.deletedAt IS NULL')
          .getOne();
      },
    );

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new ForbiddenException('Account is disabled');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Effective role + permissions (built-in constants OR a custom role).
    const effectiveRole = user.roleKey || user.role;
    const permissions = await this.tenantSchema.runInSchema(
      tenant.schemaName,
      async (em) => {
        await em
          .getRepository(User)
          .update({ id: user.id }, { lastLoginAt: new Date() });
        if (isSystemRole(effectiveRole)) {
          return systemRole(effectiveRole)?.permissions ?? [];
        }
        const role = await em
          .getRepository(Role)
          .findOne({ where: { schoolId: tenant.schoolId, key: effectiveRole } });
        return role?.permissions ?? [];
      },
    );

    const payload = {
      sub: user.id,
      email: user.email,
      role: effectiveRole,
      type: 'access' as const,
      scope: 'tenant' as const,
      schoolId: tenant.schoolId,
      schoolSlug: tenant.slug,
    };

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: effectiveRole,
        roleKey: user.roleKey ?? null,
        isSystemRole: isSystemRole(effectiveRole),
        permissions,
        schoolId: tenant.schoolId,
        schoolSlug: tenant.slug,
      },
      school: {
        id: tenant.schoolId,
        slug: tenant.slug,
        status: tenant.status,
      },
      tokens: await this.issueTokens(payload),
    };
  }

  // ─── Student PIN login (portal) ───────────────────────────────────────────
  async studentLogin(schoolCode: string, admissionNumber: string, pin: string) {
    const tenant = await this.resolveActiveTenant(schoolCode);
    const res = await this.tenantSchema.runInSchema(
      tenant.schemaName,
      async (em) => {
        const student = await em.getRepository(Student).findOne({
          where: { schoolId: tenant.schoolId, admissionNumber },
        });
        if (!student || !student.userId) {
          throw new UnauthorizedException('Invalid credentials');
        }
        const user = await this.loadPinUser(em, tenant.schoolId, student.userId);
        await this.verifyPin(pin, user, 'student');
        return {
          user,
          refId: student.id,
          name: `${student.firstName} ${student.lastName}`,
        };
      },
    );
    return this.pinSession(tenant, 'student', res);
  }

  // ─── Parent PIN login (portal) ────────────────────────────────────────────
  async parentLogin(schoolCode: string, mobile: string, pin: string) {
    const tenant = await this.resolveActiveTenant(schoolCode);
    const res = await this.tenantSchema.runInSchema(
      tenant.schemaName,
      async (em) => {
        const parents = await em.getRepository(Parent).find({
          where: { schoolId: tenant.schoolId, phone: mobile },
        });
        const candidates = parents.filter((p) => p.userId);
        if (candidates.length === 0) {
          throw new UnauthorizedException('Invalid credentials');
        }
        for (const parent of candidates) {
          const user = await this.loadPinUser(
            em,
            tenant.schoolId,
            parent.userId!,
          );
          if (await bcrypt.compare(pin, user?.pinHash ?? '')) {
            if (!user || !user.isActive || user.role !== 'parent') break;
            return { user, refId: parent.id, name: parent.name };
          }
        }
        throw new UnauthorizedException('Invalid credentials');
      },
    );
    return this.pinSession(tenant, 'parent', res);
  }

  private async resolveActiveTenant(schoolCode: string) {
    const tenant = await this.tenantResolver.resolveByIdentifier(schoolCode);
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      throw new ForbiddenException(`School is ${tenant.status}`);
    }
    return tenant;
  }

  private loadPinUser(em: any, schoolId: string, userId: string) {
    return em
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.pinHash')
      .where('u.id = :id', { id: userId })
      .andWhere('u.schoolId = :schoolId', { schoolId })
      .andWhere('u.deletedAt IS NULL')
      .getOne();
  }

  private async verifyPin(
    pin: string,
    user: User | null,
    role: 'student' | 'parent',
  ) {
    if (!user || !user.pinHash || !user.isActive || user.role !== role) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const ok = await bcrypt.compare(pin, user.pinHash);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
  }

  private async pinSession(
    tenant: { schoolId: string; slug: string; schemaName: string },
    role: 'student' | 'parent',
    res: { user: User; refId: string; name: string },
  ) {
    const payload = {
      sub: res.user.id,
      role,
      type: 'pin' as const,
      scope: 'portal' as const,
      schoolId: tenant.schoolId,
      schoolSlug: tenant.slug,
      schemaName: tenant.schemaName,
      refId: res.refId,
    };
    const expiresIn = this.config.get<string>('PIN_JWT_EXPIRES_IN', '8h');
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('PIN_JWT_SECRET', 'dev-pin-secret'),
      expiresIn,
    });
    return {
      user: {
        id: res.user.id,
        name: res.name,
        role,
        schoolSlug: tenant.slug,
      },
      token,
      expiresIn: this.parseDurationToSeconds(expiresIn),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private async issueTokens(payload: Record<string, unknown>) {
    const accessExpiresIn = this.config.get<string>('JWT_EXPIRES_IN', '15m');
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: accessExpiresIn,
    });

    const refreshToken = await this.jwt.signAsync(
      { ...payload, type: 'refresh' },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseDurationToSeconds(accessExpiresIn),
    };
  }

  private parseDurationToSeconds(d: string): number {
    const m = /^(\d+)(s|m|h|d)$/.exec(d);
    if (!m) return 900;
    const n = Number(m[1]);
    switch (m[2]) {
      case 's':
        return n;
      case 'm':
        return n * 60;
      case 'h':
        return n * 3600;
      case 'd':
        return n * 86400;
    }
    return 900;
  }
}
