import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, ILike, In, IsNull, Not, Repository } from 'typeorm';
import { Organization } from '../../../database/master/organization.entity';
import { OrganizationAdmin } from '../../../database/master/organization-admin.entity';
import { School } from '../../../database/master/school.entity';
import { IdentityService } from '../identity/identity.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

/** School statuses that still occupy a slot against the org's limit. */
const COUNTED_SCHOOL_STATUSES = ['trial', 'active', 'grace_period', 'suspended'];

export interface OrganizationWithUsage extends Organization {
  /** Schools currently occupying a slot (excludes soft-deleted & cancelled). */
  schoolsUsed: number;
}

@Injectable()
export class OrganizationsService {
  private readonly repo: Repository<Organization>;
  private readonly schoolRepo: Repository<School>;
  private readonly orgAdminRepo: Repository<OrganizationAdmin>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly identity: IdentityService,
  ) {
    this.repo = ds.getRepository(Organization);
    this.schoolRepo = ds.getRepository(School);
    this.orgAdminRepo = ds.getRepository(OrganizationAdmin);
  }

  /**
   * How many schools count against the org's limit: non-deleted schools that
   * are not cancelled. A suspended school still occupies its slot.
   */
  countSchools(organizationId: string): Promise<number> {
    return this.schoolRepo.count({
      where: {
        organizationId,
        status: In(COUNTED_SCHOOL_STATUSES),
      },
    });
  }

  /**
   * Assert a new school may be created under this organization. Throws if the
   * org is missing/inactive or its school limit is reached. Returns the org.
   * `maxSchoolsAllowed === -1` means unlimited.
   */
  async assertCanCreateSchool(organizationId: string): Promise<Organization> {
    const org = await this.repo.findOne({ where: { id: organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    if (org.status !== 'active') {
      throw new BadRequestException(
        'This organization is inactive — reactivate it to add schools.',
      );
    }
    if (org.maxSchoolsAllowed === -1) return org;

    const used = await this.countSchools(organizationId);
    if (used >= org.maxSchoolsAllowed) {
      throw new BadRequestException(
        `School limit reached (${used}/${org.maxSchoolsAllowed}). ` +
          'Contact Super Admin to increase the limit.',
      );
    }
    return org;
  }

  async list(): Promise<OrganizationWithUsage[]> {
    const orgs = await this.repo.find({ order: { createdAt: 'DESC' } });
    if (orgs.length === 0) return [];

    // One grouped query for all counts, then merge (avoids N+1).
    const counts = await this.schoolRepo
      .createQueryBuilder('s')
      .select('s.organization_id', 'organizationId')
      .addSelect('COUNT(*)', 'count')
      .where('s.organization_id IN (:...ids)', { ids: orgs.map((o) => o.id) })
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.status IN (:...statuses)', {
        statuses: COUNTED_SCHOOL_STATUSES,
      })
      .groupBy('s.organization_id')
      .getRawMany<{ organizationId: string; count: string }>();

    const byId = new Map(counts.map((c) => [c.organizationId, Number(c.count)]));
    return orgs.map((o) => ({ ...o, schoolsUsed: byId.get(o.id) ?? 0 }));
  }

  async findOne(id: string): Promise<OrganizationWithUsage> {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    return { ...org, schoolsUsed: await this.countSchools(id) };
  }

  async create(dto: CreateOrganizationDto) {
    const email = dto.adminEmail.toLowerCase();
    if (await this.repo.findOne({ where: { adminEmail: email } })) {
      throw new ConflictException(
        'An organization with this admin email already exists',
      );
    }
    // If we're going to create a login, make sure the admin email is free in
    // the login table BEFORE writing the org (avoids a half-created org).
    if (dto.adminPassword) {
      const taken = await this.orgAdminRepo.findOne({
        where: { email },
        withDeleted: true,
      });
      if (taken) {
        throw new ConflictException(
          'An organization admin with this email already exists',
        );
      }
    }

    const org = await this.repo.save(
      this.repo.create({
        name: dto.name,
        adminName: dto.adminName ?? null,
        adminEmail: email,
        adminPhone: dto.adminPhone ?? null,
        maxSchoolsAllowed: dto.maxSchoolsAllowed,
        status: dto.status ?? 'active',
      }),
    );

    // Optionally create the org-admin login so they can sign in immediately.
    if (dto.adminPassword) {
      await this.identity.createOrgAdmin(org.id, {
        name: dto.adminName ?? dto.name,
        email,
        password: dto.adminPassword,
      });
    }

    return this.findOne(org.id);
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    if (dto.adminEmail) {
      const email = dto.adminEmail.toLowerCase();
      if (email !== org.adminEmail) {
        if (await this.repo.findOne({ where: { adminEmail: email } })) {
          throw new ConflictException(
            'An organization with this admin email already exists',
          );
        }
        org.adminEmail = email;
      }
    }

    // Guard: never silently drop the limit below what's already in use.
    if (
      dto.maxSchoolsAllowed !== undefined &&
      dto.maxSchoolsAllowed !== -1 &&
      dto.maxSchoolsAllowed < org.maxSchoolsAllowed
    ) {
      const used = await this.countSchools(id);
      if (dto.maxSchoolsAllowed < used && !dto.force) {
        throw new BadRequestException(
          `This organization already has ${used} school(s). ` +
            `Lowering the limit to ${dto.maxSchoolsAllowed} needs confirmation.`,
        );
      }
    }

    if (dto.name !== undefined) org.name = dto.name;
    if (dto.adminName !== undefined) org.adminName = dto.adminName ?? null;
    if (dto.adminPhone !== undefined) org.adminPhone = dto.adminPhone ?? null;
    if (dto.maxSchoolsAllowed !== undefined)
      org.maxSchoolsAllowed = dto.maxSchoolsAllowed;
    if (dto.status !== undefined) org.status = dto.status;

    await this.repo.save(org);
    return this.findOne(id);
  }

  async remove(id: string) {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');
    await this.repo.softRemove(org);
    return { deleted: true, id };
  }

  /** Schools not yet assigned to any organization (candidates to attach). */
  availableSchools() {
    return this.schoolRepo.find({
      where: { organizationId: IsNull() },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Attach an existing (unassigned) school to an organization. Enforces the
   * org's school limit and per-org name uniqueness, same as creating one.
   */
  async attachSchool(organizationId: string, schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId === organizationId) return school; // idempotent

    if (school.organizationId) {
      throw new ConflictException(
        'This school already belongs to another organization. Detach it first.',
      );
    }

    await this.assertCanCreateSchool(organizationId); // org active + limit

    const nameDup = await this.schoolRepo.findOne({
      where: { organizationId, name: ILike(school.name) },
    });
    if (nameDup) {
      throw new ConflictException(
        'A school with this name already exists in this organization',
      );
    }

    school.organizationId = organizationId;
    await this.schoolRepo.save(school);
    return school;
  }

  /** Remove a school from an organization (it becomes platform-direct again). */
  async detachSchool(organizationId: string, schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId !== organizationId) {
      throw new BadRequestException('School is not in this organization');
    }
    school.organizationId = null;
    await this.schoolRepo.save(school);
    return { detached: true, id: schoolId };
  }

  /**
   * Deactivate an organization. When `suspendSchools` is true, also suspend
   * every live school under it (cascade) — those are tagged `suspendedByOrg`
   * so re-activation can restore exactly them.
   */
  async deactivate(id: string, suspendSchools: boolean) {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    org.status = 'inactive';
    await this.repo.save(org);

    let schoolsSuspended = 0;
    if (suspendSchools) {
      const result = await this.schoolRepo.update(
        {
          organizationId: id,
          status: In(['trial', 'active', 'grace_period']),
        },
        { status: 'suspended', suspendedByOrg: true },
      );
      schoolsSuspended = result.affected ?? 0;
    }

    return { id, status: org.status, schoolsSuspended };
  }

  /**
   * Re-activate an organization, restoring only the schools that were
   * suspended by its deactivation (`suspendedByOrg`). Their status returns to
   * 'active'; the daily expiry sweep re-derives trial/grace as needed.
   */
  async activate(id: string) {
    const org = await this.repo.findOne({ where: { id } });
    if (!org) throw new NotFoundException('Organization not found');

    org.status = 'active';
    await this.repo.save(org);

    const result = await this.schoolRepo.update(
      { organizationId: id, suspendedByOrg: true, status: Not('cancelled') },
      { status: 'active', suspendedByOrg: false },
    );

    return { id, status: org.status, schoolsRestored: result.affected ?? 0 };
  }
}
