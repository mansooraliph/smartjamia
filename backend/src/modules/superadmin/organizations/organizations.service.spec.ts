import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OrganizationsService } from './organizations.service';
import { Organization } from '../../../database/master/organization.entity';
import { School } from '../../../database/master/school.entity';

/**
 * Unit tests for the school-limit enforcement — the core rule that a school
 * cannot be created once an organization reaches `max_schools_allowed`.
 * Repositories are mocked; no DB required.
 */
describe('OrganizationsService — school limit enforcement', () => {
  let orgRepo: { findOne: jest.Mock; save: jest.Mock };
  let schoolRepo: { count: jest.Mock; update: jest.Mock };
  let service: OrganizationsService;

  const org = (over: Partial<Organization> = {}): Organization =>
    ({
      id: 'org-1',
      name: 'Sunrise Trust',
      adminEmail: 'admin@sunrise.org',
      adminName: null,
      adminPhone: null,
      maxSchoolsAllowed: 3,
      status: 'active',
      createdAt: new Date(0),
      updatedAt: new Date(0),
      deletedAt: null,
      ...over,
    }) as Organization;

  beforeEach(() => {
    orgRepo = { findOne: jest.fn(), save: jest.fn(async (x) => x) };
    schoolRepo = { count: jest.fn(), update: jest.fn() };
    const ds = {
      getRepository: (entity: unknown) =>
        entity === Organization
          ? orgRepo
          : entity === School
            ? schoolRepo
            : { findOne: jest.fn() }, // OrganizationAdmin repo (unused here)
    } as unknown as DataSource;
    const identity = { createOrgAdmin: jest.fn() } as any;
    service = new OrganizationsService(ds, identity);
  });

  describe('assertCanCreateSchool', () => {
    it('allows creation while under the limit', async () => {
      orgRepo.findOne.mockResolvedValue(org({ maxSchoolsAllowed: 5 }));
      schoolRepo.count.mockResolvedValue(3); // 3 of 5

      await expect(service.assertCanCreateSchool('org-1')).resolves.toMatchObject(
        { id: 'org-1' },
      );
    });

    it('allows creation on the last free slot (used = max - 1)', async () => {
      orgRepo.findOne.mockResolvedValue(org({ maxSchoolsAllowed: 5 }));
      schoolRepo.count.mockResolvedValue(4); // 4 of 5 → one slot left

      await expect(
        service.assertCanCreateSchool('org-1'),
      ).resolves.toBeDefined();
    });

    it('blocks creation once the limit is reached (used = max)', async () => {
      orgRepo.findOne.mockResolvedValue(org({ maxSchoolsAllowed: 5 }));
      schoolRepo.count.mockResolvedValue(5); // 5 of 5 → full

      await expect(service.assertCanCreateSchool('org-1')).rejects.toThrow(
        /School limit reached \(5\/5\)/,
      );
      await expect(
        service.assertCanCreateSchool('org-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks creation when already over the limit', async () => {
      orgRepo.findOne.mockResolvedValue(org({ maxSchoolsAllowed: 2 }));
      schoolRepo.count.mockResolvedValue(3); // 3 of 2

      await expect(service.assertCanCreateSchool('org-1')).rejects.toThrow(
        /School limit reached \(3\/2\)/,
      );
    });

    it('treats -1 as unlimited (never counts, never blocks)', async () => {
      orgRepo.findOne.mockResolvedValue(org({ maxSchoolsAllowed: -1 }));

      await expect(
        service.assertCanCreateSchool('org-1'),
      ).resolves.toBeDefined();
      expect(schoolRepo.count).not.toHaveBeenCalled();
    });

    it('rejects an inactive organization', async () => {
      orgRepo.findOne.mockResolvedValue(org({ status: 'inactive' }));

      await expect(service.assertCanCreateSchool('org-1')).rejects.toThrow(
        /inactive/,
      );
      expect(schoolRepo.count).not.toHaveBeenCalled();
    });

    it('rejects a missing organization', async () => {
      orgRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assertCanCreateSchool('missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('update — lowering max_schools_allowed', () => {
    it('blocks lowering the limit below current usage without force', async () => {
      orgRepo.findOne.mockResolvedValue(org({ maxSchoolsAllowed: 5 }));
      schoolRepo.count.mockResolvedValue(4);

      await expect(
        service.update('org-1', { maxSchoolsAllowed: 2 }),
      ).rejects.toThrow(/already has 4 school/);
    });

    it('allows lowering below usage when force is set', async () => {
      orgRepo.findOne.mockResolvedValue(org({ maxSchoolsAllowed: 5 }));
      schoolRepo.count.mockResolvedValue(4);

      await expect(
        service.update('org-1', { maxSchoolsAllowed: 2, force: true }),
      ).resolves.toMatchObject({ maxSchoolsAllowed: 2 });
      expect(orgRepo.save).toHaveBeenCalled();
    });

    it('allows lowering the limit while still at/above usage', async () => {
      orgRepo.findOne.mockResolvedValue(org({ maxSchoolsAllowed: 10 }));
      schoolRepo.count.mockResolvedValue(4);

      await expect(
        service.update('org-1', { maxSchoolsAllowed: 4 }),
      ).resolves.toMatchObject({ maxSchoolsAllowed: 4 });
    });
  });
});
