import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserAccount } from '../../../database/master/user-account.entity';
import { SchoolAccessGrant } from '../../../database/master/school-access-grant.entity';
import { OrganizationAdmin } from '../../../database/master/organization-admin.entity';
import { School } from '../../../database/master/school.entity';
import { Organization } from '../../../database/master/organization.entity';
import { UserLoginActivity } from '../../../database/master/user-login-activity.entity';
import { TenantUserService } from '../../../common/tenant/tenant-user.service';
import { UserRole } from '../../../database/tenant/user.entity';
import {
  CreateGrantDto,
  CreateOrganizationAdminDto,
  CreateOrgUserDto,
  CreateUserAccountDto,
  ResetPasswordDto,
} from './dto/identity.dto';

@Injectable()
export class IdentityService {
  private readonly accountRepo: Repository<UserAccount>;
  private readonly grantRepo: Repository<SchoolAccessGrant>;
  private readonly orgAdminRepo: Repository<OrganizationAdmin>;
  private readonly schoolRepo: Repository<School>;
  private readonly orgRepo: Repository<Organization>;
  private readonly loginActivityRepo: Repository<UserLoginActivity>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly tenantUser: TenantUserService,
    private readonly config: ConfigService,
  ) {
    this.accountRepo = ds.getRepository(UserAccount);
    this.grantRepo = ds.getRepository(SchoolAccessGrant);
    this.orgAdminRepo = ds.getRepository(OrganizationAdmin);
    this.schoolRepo = ds.getRepository(School);
    this.orgRepo = ds.getRepository(Organization);
    this.loginActivityRepo = ds.getRepository(UserLoginActivity);
  }

  private get rounds() {
    return Number(this.config.get('BCRYPT_ROUNDS', 12));
  }

  // ─── User accounts ────────────────────────────────────────────────────────
  listAccounts() {
    return this.accountRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createAccount(dto: CreateUserAccountDto) {
    const email = dto.email.toLowerCase();
    if (await this.accountRepo.findOne({ where: { email }, withDeleted: true })) {
      throw new ConflictException('An account with this email already exists');
    }
    const account = await this.accountRepo.save(
      this.accountRepo.create({
        name: dto.name,
        email,
        passwordHash: await bcrypt.hash(dto.password, this.rounds),
        status: 'active',
      }),
    );
    return this.publicAccount(account);
  }

  async removeAccount(id: string) {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Account not found');
    // Revoke grants + deactivate mirrors so the login can't enter any school.
    const grants = await this.grantRepo.find({
      where: { userAccountId: id, status: 'active' },
    });
    for (const g of grants) await this.revokeGrant(g.id);
    await this.accountRepo.softRemove(account);
    return { deleted: true, id };
  }

  // ─── Grants ───────────────────────────────────────────────────────────────
  listGrants(accountId: string) {
    return this.grantRepo.find({
      where: { userAccountId: accountId },
      relations: { school: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createGrant(accountId: string, dto: CreateGrantDto) {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');

    const school = await this.schoolRepo.findOne({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('School not found');

    const existing = await this.grantRepo.findOne({
      where: { userAccountId: accountId, schoolId: dto.schoolId },
    });
    if (existing && existing.status === 'active') {
      throw new ConflictException('This account already has access to this school');
    }

    // Provision (or find) the mirror tenant user for this account in the school.
    const tenantUserId = await this.tenantUser.ensureUser({
      schemaName: school.schemaName || 'shared_pool',
      schoolId: school.id,
      name: account.name,
      email: account.email,
      role: dto.role as UserRole,
    });

    if (existing) {
      // Re-activate a previously revoked grant.
      existing.status = 'active';
      existing.role = dto.role;
      existing.tenantUserId = tenantUserId;
      return this.grantRepo.save(existing);
    }
    return this.grantRepo.save(
      this.grantRepo.create({
        userAccountId: accountId,
        schoolId: dto.schoolId,
        role: dto.role,
        tenantUserId,
        status: 'active',
      }),
    );
  }

  /** Grants on a specific school, with the grantee account (no password). */
  listGrantsBySchool(schoolId: string) {
    return this.grantRepo.find({
      where: { schoolId },
      relations: { userAccount: true },
      order: { createdAt: 'DESC' },
    });
  }

  getGrant(id: string) {
    return this.grantRepo.findOne({ where: { id } });
  }

  /**
   * Grant a person (by email) access to a school. Finds an existing account by
   * email or creates one (password required to create). Then delegates to
   * `createGrant` (which provisions the mirror user + dedupes).
   */
  async grantAccessByEmail(
    schoolId: string,
    input: { name: string; email: string; password?: string; role: string },
  ) {
    const email = input.email.toLowerCase();
    let account = await this.accountRepo.findOne({ where: { email } });
    if (!account) {
      if (!input.password || input.password.length < 8) {
        throw new BadRequestException(
          'A password (min 8 chars) is required to create a new user.',
        );
      }
      account = await this.accountRepo.save(
        this.accountRepo.create({
          name: input.name,
          email,
          passwordHash: await bcrypt.hash(input.password, this.rounds),
          status: 'active',
        }),
      );
    }
    return this.createGrant(account.id, {
      schoolId,
      role: input.role as any,
    });
  }

  async revokeGrant(id: string) {
    const grant = await this.grantRepo.findOne({ where: { id } });
    if (!grant) throw new NotFoundException('Grant not found');
    grant.status = 'revoked';
    await this.grantRepo.save(grant);
    if (grant.tenantUserId) {
      const school = await this.schoolRepo.findOne({
        where: { id: grant.schoolId },
      });
      if (school) {
        await this.tenantUser.deactivateUser(
          school.schemaName || 'shared_pool',
          grant.tenantUserId,
        );
      }
    }
    return { revoked: true, id };
  }

  // ─── Org-scoped user management (Org Admin portal) ────────────────────────

  /** All accounts holding at least one grant to a school in this org, grouped with their grants. */
  async listAccountsForOrg(
    organizationId: string,
    filters: { schoolId?: string; role?: string; status?: string; search?: string },
  ) {
    const orgSchools = await this.schoolRepo.find({ where: { organizationId } });
    const orgSchoolIds = new Set(orgSchools.map((s) => s.id));
    if (!orgSchoolIds.size) return [];
    const schoolNameById = new Map(orgSchools.map((s) => [s.id, s.name]));

    const grants = await this.grantRepo.find({
      where: filters.schoolId
        ? { schoolId: filters.schoolId }
        : undefined,
      relations: { userAccount: true },
      order: { createdAt: 'DESC' },
    });
    const relevant = grants.filter(
      (g) =>
        orgSchoolIds.has(g.schoolId) &&
        (!filters.role || g.role === filters.role),
    );

    const byAccount = new Map<
      string,
      { account: UserAccount; grants: (SchoolAccessGrant & { schoolName: string })[] }
    >();
    for (const g of relevant) {
      if (!g.userAccount) continue;
      const entry = byAccount.get(g.userAccountId) ?? {
        account: g.userAccount,
        grants: [],
      };
      entry.grants.push({ ...g, schoolName: schoolNameById.get(g.schoolId) ?? '' });
      byAccount.set(g.userAccountId, entry);
    }

    let results = [...byAccount.values()];
    if (filters.status) {
      results = results.filter((r) => r.account.status === filters.status);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.account.name.toLowerCase().includes(q) ||
          r.account.email.toLowerCase().includes(q),
      );
    }
    return results.map((r) => ({ ...this.publicAccount(r.account), grants: r.grants }));
  }

  /** Create (or reuse) a central account and grant it access to schools within this org. */
  async createAccountForOrg(organizationId: string, dto: CreateOrgUserDto) {
    for (const g of dto.grants) {
      await this.assertSchoolInOrg(organizationId, g.schoolId);
    }
    const email = dto.email.toLowerCase();
    let account = await this.accountRepo.findOne({ where: { email } });
    if (!account) {
      if (!dto.password || dto.password.length < 8) {
        throw new BadRequestException(
          'A password (min 8 chars) is required to create a new user.',
        );
      }
      account = await this.accountRepo.save(
        this.accountRepo.create({
          name: dto.name,
          email,
          passwordHash: await bcrypt.hash(dto.password, this.rounds),
          status: 'active',
        }),
      );
    }
    for (const g of dto.grants) {
      await this.createGrant(account.id, g);
    }
    return this.publicAccount(account);
  }

  /** Grant an existing account (org-scoped) access to another school in this org. */
  async createGrantForOrg(organizationId: string, accountId: string, dto: CreateGrantDto) {
    await this.assertSchoolInOrg(organizationId, dto.schoolId);
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');
    return this.createGrant(accountId, dto);
  }

  async resetPasswordForOrg(
    organizationId: string,
    accountId: string,
    dto: ResetPasswordDto,
  ) {
    const account = await this.accountRepo.findOne({ where: { id: accountId } });
    if (!account) throw new NotFoundException('Account not found');
    await this.assertAccountInOrg(organizationId, accountId);

    const temporaryPassword = dto.password ?? this.generateTempPassword();
    account.passwordHash = await bcrypt.hash(temporaryPassword, this.rounds);
    await this.accountRepo.save(account);
    return {
      reset: true,
      temporaryPassword: dto.password ? undefined : temporaryPassword,
    };
  }

  async listActivityForOrg(organizationId: string, accountId: string) {
    await this.assertAccountInOrg(organizationId, accountId);
    return this.loginActivityRepo.find({
      where: { userAccountId: accountId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async assertSchoolInOrg(organizationId: string, schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school || school.organizationId !== organizationId) {
      throw new NotFoundException('School not found in this organization');
    }
  }

  /** An account only "belongs" to an org in the sense of holding a grant there. */
  private async assertAccountInOrg(organizationId: string, accountId: string) {
    const grants = await this.grantRepo.find({ where: { userAccountId: accountId } });
    if (!grants.length) throw new NotFoundException('Account not found');
    const schools = await this.schoolRepo.find({
      where: { id: In(grants.map((g) => g.schoolId)) },
    });
    if (!schools.some((s) => s.organizationId === organizationId)) {
      throw new ForbiddenException('Account is not in your organization');
    }
  }

  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-4);
  }

  // ─── Organization admins ──────────────────────────────────────────────────
  listOrgAdmins(organizationId: string) {
    return this.orgAdminRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createOrgAdmin(organizationId: string, dto: CreateOrganizationAdminDto) {
    const org = await this.orgRepo.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');

    const email = dto.email.toLowerCase();
    if (await this.orgAdminRepo.findOne({ where: { email }, withDeleted: true })) {
      throw new ConflictException('An admin with this email already exists');
    }
    const admin = await this.orgAdminRepo.save(
      this.orgAdminRepo.create({
        organizationId,
        name: dto.name,
        email,
        passwordHash: await bcrypt.hash(dto.password, this.rounds),
        status: 'active',
      }),
    );
    return this.publicOrgAdmin(admin);
  }

  async removeOrgAdmin(id: string) {
    const admin = await this.orgAdminRepo.findOne({ where: { id } });
    if (!admin) throw new NotFoundException('Admin not found');
    await this.orgAdminRepo.softRemove(admin);
    return { deleted: true, id };
  }

  // ─── helpers (never leak password hashes) ─────────────────────────────────
  private publicAccount(a: UserAccount) {
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      status: a.status,
      createdAt: a.createdAt,
    };
  }
  private publicOrgAdmin(a: OrganizationAdmin) {
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      organizationId: a.organizationId,
      status: a.status,
      createdAt: a.createdAt,
    };
  }
}
