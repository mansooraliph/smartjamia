import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { School } from '../../../database/master/school.entity';
import { OrganizationsService } from '../organizations/organizations.service';
import { SchoolsService } from '../schools/schools.service';
import { IdentityService } from '../identity/identity.service';
import { CreateSchoolDto } from '../schools/dto/create-school.dto';
import { CreateOrgGrantDto } from './dto/create-org-grant.dto';

/**
 * Backing service for the Organization Admin portal. Every method is scoped to
 * the caller's `organizationId` (from the org token) so an org admin can only
 * ever see or touch their own organization's schools and grants.
 */
@Injectable()
export class OrgPortalService {
  private readonly schoolRepo: Repository<School>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly orgs: OrganizationsService,
    private readonly schools: SchoolsService,
    private readonly identity: IdentityService,
  ) {
    this.schoolRepo = ds.getRepository(School);
  }

  me(organizationId: string) {
    return this.orgs.findOne(organizationId);
  }

  listSchools(organizationId: string) {
    return this.schools.list(organizationId);
  }

  /** Create a school under the caller's org (limit enforced in SchoolsService). */
  createSchool(organizationId: string, dto: CreateSchoolDto) {
    return this.schools.create({ ...dto, organizationId });
  }

  async removeSchool(organizationId: string, schoolId: string) {
    await this.assertSchoolInOrg(organizationId, schoolId);
    return this.schools.remove(schoolId);
  }

  async listGrants(organizationId: string, schoolId: string) {
    await this.assertSchoolInOrg(organizationId, schoolId);
    return this.identity.listGrantsBySchool(schoolId);
  }

  async grant(
    organizationId: string,
    schoolId: string,
    dto: CreateOrgGrantDto,
  ) {
    await this.assertSchoolInOrg(organizationId, schoolId);
    return this.identity.grantAccessByEmail(schoolId, dto);
  }

  async revokeGrant(organizationId: string, grantId: string) {
    const grant = await this.identity.getGrant(grantId);
    if (!grant) throw new NotFoundException('Grant not found');
    await this.assertSchoolInOrg(organizationId, grant.schoolId);
    return this.identity.revokeGrant(grantId);
  }

  /** Ensure a school exists and belongs to the caller's organization. */
  private async assertSchoolInOrg(organizationId: string, schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId !== organizationId) {
      throw new ForbiddenException('School is not in your organization');
    }
    return school;
  }
}
