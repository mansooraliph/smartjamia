import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IdentityService } from './identity.service';
import { UserAccount } from '../../../database/master/user-account.entity';
import { SchoolAccessGrant } from '../../../database/master/school-access-grant.entity';
import { OrganizationAdmin } from '../../../database/master/organization-admin.entity';
import { School } from '../../../database/master/school.entity';
import { Organization } from '../../../database/master/organization.entity';

describe('IdentityService — grants & accounts', () => {
  let repos: Record<string, any>;
  let tenantUser: { ensureUser: jest.Mock; deactivateUser: jest.Mock };
  let service: IdentityService;

  beforeEach(() => {
    repos = {
      account: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
      grant: {
        findOne: jest.fn(),
        create: jest.fn((x) => x),
        save: jest.fn(async (x) => ({ id: 'g1', ...x })),
      },
      orgAdmin: { findOne: jest.fn(), create: jest.fn(), save: jest.fn() },
      school: { findOne: jest.fn() },
      org: { findOne: jest.fn() },
    };
    const byEntity = new Map<unknown, any>([
      [UserAccount, repos.account],
      [SchoolAccessGrant, repos.grant],
      [OrganizationAdmin, repos.orgAdmin],
      [School, repos.school],
      [Organization, repos.org],
    ]);
    const ds = {
      getRepository: (e: unknown) => byEntity.get(e),
    } as unknown as DataSource;
    tenantUser = {
      ensureUser: jest.fn().mockResolvedValue('tu1'),
      deactivateUser: jest.fn(),
    };
    service = new IdentityService(
      ds,
      tenantUser as any,
      { get: (_k: string, d?: unknown) => d } as any,
    );
  });

  describe('createGrant', () => {
    it('provisions a mirror user and saves the grant', async () => {
      repos.account.findOne.mockResolvedValue({
        id: 'acc1',
        name: 'Priya',
        email: 'p@x.org',
      });
      repos.school.findOne.mockResolvedValue({
        id: 's1',
        schemaName: 'shared_pool',
      });
      repos.grant.findOne.mockResolvedValue(null);

      const res = await service.createGrant('acc1', {
        schoolId: 's1',
        role: 'teacher',
      });

      expect(tenantUser.ensureUser).toHaveBeenCalledWith(
        expect.objectContaining({
          schemaName: 'shared_pool',
          schoolId: 's1',
          email: 'p@x.org',
          role: 'teacher',
        }),
      );
      expect(res).toMatchObject({
        userAccountId: 'acc1',
        schoolId: 's1',
        role: 'teacher',
        tenantUserId: 'tu1',
        status: 'active',
      });
    });

    it('rejects a duplicate active grant', async () => {
      repos.account.findOne.mockResolvedValue({ id: 'acc1', name: 'P', email: 'p@x' });
      repos.school.findOne.mockResolvedValue({ id: 's1', schemaName: 'shared_pool' });
      repos.grant.findOne.mockResolvedValue({ id: 'g1', status: 'active' });

      await expect(
        service.createGrant('acc1', { schoolId: 's1', role: 'admin' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tenantUser.ensureUser).not.toHaveBeenCalled();
    });

    it('re-activates a previously revoked grant', async () => {
      repos.account.findOne.mockResolvedValue({ id: 'acc1', name: 'P', email: 'p@x' });
      repos.school.findOne.mockResolvedValue({ id: 's1', schemaName: 'shared_pool' });
      const revoked = { id: 'g1', status: 'revoked', role: 'staff', tenantUserId: null };
      repos.grant.findOne.mockResolvedValue(revoked);

      const res = await service.createGrant('acc1', { schoolId: 's1', role: 'manager' });
      expect(res.status).toBe('active');
      expect(res.role).toBe('manager');
      expect(res.tenantUserId).toBe('tu1');
    });

    it('rejects when the school does not exist', async () => {
      repos.account.findOne.mockResolvedValue({ id: 'acc1', name: 'P', email: 'p@x' });
      repos.school.findOne.mockResolvedValue(null);

      await expect(
        service.createGrant('acc1', { schoolId: 'nope', role: 'admin' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createAccount', () => {
    it('rejects a duplicate email before hashing', async () => {
      repos.account.findOne.mockResolvedValue({ id: 'acc1' });
      await expect(
        service.createAccount({ name: 'P', email: 'P@X.org', password: 'password1' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(repos.account.save).not.toHaveBeenCalled();
    });
  });

  describe('revokeGrant', () => {
    it('revokes and deactivates the mirror user', async () => {
      repos.grant.findOne.mockResolvedValue({
        id: 'g1',
        status: 'active',
        schoolId: 's1',
        tenantUserId: 'tu1',
      });
      repos.school.findOne.mockResolvedValue({ id: 's1', schemaName: 'shared_pool' });

      const res = await service.revokeGrant('g1');
      expect(res).toEqual({ revoked: true, id: 'g1' });
      expect(repos.grant.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'revoked' }),
      );
      expect(tenantUser.deactivateUser).toHaveBeenCalledWith('shared_pool', 'tu1');
    });
  });
});
