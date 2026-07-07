import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserAccount } from '../../../database/master/user-account.entity';
import { SchoolAccessGrant } from '../../../database/master/school-access-grant.entity';
import { OrganizationAdmin } from '../../../database/master/organization-admin.entity';
import { School } from '../../../database/master/school.entity';
import { Organization } from '../../../database/master/organization.entity';
import { TenantUserService } from '../../../common/tenant/tenant-user.service';
import { UserRole } from '../../../database/tenant/user.entity';
import {
  CreateGrantDto,
  CreateOrganizationAdminDto,
  CreateUserAccountDto,
} from './dto/identity.dto';

@Injectable()
export class IdentityService {
  private readonly accountRepo: Repository<UserAccount>;
  private readonly grantRepo: Repository<SchoolAccessGrant>;
  private readonly orgAdminRepo: Repository<OrganizationAdmin>;
  private readonly schoolRepo: Repository<School>;
  private readonly orgRepo: Repository<Organization>;

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
