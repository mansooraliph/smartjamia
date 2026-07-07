import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Superadmin } from '../../database/master/superadmin.entity';
import { School } from '../../database/master/school.entity';
import { Organization } from '../../database/master/organization.entity';
import { OrganizationAdmin } from '../../database/master/organization-admin.entity';
import { UserAccount } from '../../database/master/user-account.entity';
import { SchoolAccessGrant } from '../../database/master/school-access-grant.entity';
import { User, UserRole } from '../../database/tenant/user.entity';
import { Student } from '../../database/tenant/student.entity';
import { Parent } from '../../database/tenant/parent.entity';
import { Role } from '../../database/tenant/role.entity';
import { TenantResolverService } from '../../common/tenant/tenant-resolver.service';
import { TenantSchemaService } from '../../common/tenant/tenant-schema.service';
import { TenantUserService } from '../../common/tenant/tenant-user.service';
import {
  isSystemRole,
  systemRole,
} from '../../common/rbac/permissions';

/** Minimal tenant context a tenant session is built from. */
interface TenantLike {
  schoolId: string;
  slug: string;
  schemaName: string;
  status: string;
}

@Injectable()
export class AuthService {
  private readonly superadminRepo: Repository<Superadmin>;
  private readonly schoolRepo: Repository<School>;
  private readonly orgRepo: Repository<Organization>;
  private readonly orgAdminRepo: Repository<OrganizationAdmin>;
  private readonly accountRepo: Repository<UserAccount>;
  private readonly grantRepo: Repository<SchoolAccessGrant>;

  constructor(
    @InjectDataSource('master') private readonly master: DataSource,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly tenantResolver: TenantResolverService,
    private readonly tenantSchema: TenantSchemaService,
    private readonly tenantUser: TenantUserService,
  ) {
    this.superadminRepo = master.getRepository(Superadmin);
    this.schoolRepo = master.getRepository(School);
    this.orgRepo = master.getRepository(Organization);
    this.orgAdminRepo = master.getRepository(OrganizationAdmin);
    this.accountRepo = master.getRepository(UserAccount);
    this.grantRepo = master.getRepository(SchoolAccessGrant);
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

    return this.buildTenantSession(tenant, user);
  }

  /**
   * Build a full tenant session (token + user + permissions) for a resolved
   * user in a school. Shared by the standard school login and the multi-school
   * `select-school` flows so they behave identically once a school is chosen.
   */
  private async buildTenantSession(
    tenant: TenantLike,
    user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'roleKey'>,
  ) {
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

  // ─── Multi-school account login ───────────────────────────────────────────
  /**
   * Central account login (no school header). Verifies the credential and
   * returns the list of schools the account may enter — the caller then picks
   * one via `accountSelectSchool`, which yields a normal tenant session.
   */
  async accountLogin(email: string, password: string) {
    const account = await this.accountRepo
      .createQueryBuilder('a')
      .addSelect('a.passwordHash')
      .where('a.email = :email', { email: email.toLowerCase() })
      .andWhere('a.deletedAt IS NULL')
      .getOne();

    if (!account) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (account.status !== 'active') {
      throw new ForbiddenException('Account is disabled');
    }
    const ok = await bcrypt.compare(password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    await this.accountRepo.update({ id: account.id }, { lastLoginAt: new Date() });

    const payload = {
      sub: account.id,
      email: account.email,
      type: 'access' as const,
      scope: 'account' as const,
    };
    return {
      account: {
        id: account.id,
        name: account.name,
        email: account.email,
        scope: 'account' as const,
      },
      schools: await this.accountSchools(account.id),
      tokens: await this.issueTokens(payload),
    };
  }

  /** Enter a school this account was granted → a standard tenant session. */
  async accountSelectSchool(accountId: string, schoolId: string) {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account || account.status !== 'active') {
      throw new ForbiddenException('Account is disabled');
    }
    const grant = await this.grantRepo.findOne({
      where: { userAccountId: accountId, schoolId, status: 'active' },
    });
    if (!grant) {
      throw new ForbiddenException('You do not have access to this school');
    }

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    const tenant = this.toTenant(school);
    this.assertSchoolUsable(tenant);

    // Ensure the mirror tenant user exists (first entry provisions it).
    let userId = grant.tenantUserId;
    if (!userId) {
      userId = await this.tenantUser.ensureUser({
        schemaName: tenant.schemaName,
        schoolId: school.id,
        name: account.name,
        email: account.email,
        role: grant.role as UserRole,
      });
      await this.grantRepo.update({ id: grant.id }, { tenantUserId: userId });
    }

    const user = await this.loadMirrorUser(tenant.schemaName, userId);
    if (!user) throw new NotFoundException('School user not found');
    return this.buildTenantSession(tenant, user);
  }

  private async accountSchools(accountId: string) {
    const grants = await this.grantRepo.find({
      where: { userAccountId: accountId, status: 'active' },
      relations: { school: true },
    });
    return grants
      .filter((g) => g.school && !g.school.deletedAt)
      .map((g) => ({
        schoolId: g.schoolId,
        code: g.school.code,
        slug: g.school.slug,
        name: g.school.name,
        role: g.role,
        status: g.school.status,
      }));
  }

  // ─── Organization admin login ─────────────────────────────────────────────
  async organizationLogin(email: string, password: string) {
    const admin = await this.orgAdminRepo
      .createQueryBuilder('a')
      .addSelect('a.passwordHash')
      .where('a.email = :email', { email: email.toLowerCase() })
      .andWhere('a.deletedAt IS NULL')
      .getOne();

    if (!admin) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (admin.status !== 'active') {
      throw new ForbiddenException('Account is disabled');
    }
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const org = await this.orgRepo.findOne({
      where: { id: admin.organizationId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status !== 'active') {
      throw new ForbiddenException('Organization is inactive');
    }
    await this.orgAdminRepo.update({ id: admin.id }, { lastLoginAt: new Date() });

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: 'organization_admin' as const,
      type: 'access' as const,
      scope: 'organization' as const,
      organizationId: admin.organizationId,
    };
    return {
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        organizationId: admin.organizationId,
        scope: 'organization' as const,
      },
      organization: {
        id: org.id,
        name: org.name,
        maxSchoolsAllowed: org.maxSchoolsAllowed,
        status: org.status,
      },
      schools: await this.orgSchools(admin.organizationId),
      tokens: await this.issueTokens(payload),
    };
  }

  /** Org admin enters one of their org's schools → a tenant session (as admin). */
  async organizationSelectSchool(
    adminId: string,
    organizationId: string,
    schoolId: string,
  ) {
    const org = await this.orgRepo.findOne({ where: { id: organizationId } });
    if (!org || org.status !== 'active') {
      throw new ForbiddenException('Organization is inactive');
    }
    const admin = await this.orgAdminRepo.findOne({ where: { id: adminId } });
    if (!admin || admin.status !== 'active') {
      throw new ForbiddenException('Account is disabled');
    }

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId !== organizationId) {
      throw new ForbiddenException('School is not in your organization');
    }
    const tenant = this.toTenant(school);
    this.assertSchoolUsable(tenant);

    // Org admins act as 'admin' in each of their schools. Mirror user is keyed
    // by email, so repeat entries reuse the same row.
    const userId = await this.tenantUser.ensureUser({
      schemaName: tenant.schemaName,
      schoolId: school.id,
      name: admin.name,
      email: admin.email,
      role: 'admin',
    });
    const user = await this.loadMirrorUser(tenant.schemaName, userId);
    if (!user) throw new NotFoundException('School user not found');
    return this.buildTenantSession(tenant, user);
  }

  private async orgSchools(organizationId: string) {
    const schools = await this.schoolRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    return schools.map((s) => ({
      schoolId: s.id,
      code: s.code,
      slug: s.slug,
      name: s.name,
      status: s.status,
    }));
  }

  // ─── Shared helpers for school selection ──────────────────────────────────
  private toTenant(school: School): TenantLike {
    return {
      schoolId: school.id,
      slug: school.slug,
      schemaName: school.schemaName || 'shared_pool',
      status: school.status,
    };
  }

  private assertSchoolUsable(tenant: TenantLike) {
    if (tenant.status === 'suspended' || tenant.status === 'cancelled') {
      throw new ForbiddenException(`School is ${tenant.status}`);
    }
  }

  private loadMirrorUser(
    schemaName: string,
    userId: string,
  ): Promise<User | null> {
    return this.tenantSchema.runInSchema(schemaName, (em) =>
      em.getRepository(User).findOne({ where: { id: userId } }),
    );
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
          name: student.studentName,
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
    const accessExpiresIn = this.config.get<string>('JWT_EXPIRES_IN', '1d');
    const refreshExpiresIn = this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '30d',
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
