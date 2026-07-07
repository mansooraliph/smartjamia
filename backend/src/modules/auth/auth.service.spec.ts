import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthService } from './auth.service';
import { Superadmin } from '../../database/master/superadmin.entity';
import { School } from '../../database/master/school.entity';
import { Organization } from '../../database/master/organization.entity';
import { OrganizationAdmin } from '../../database/master/organization-admin.entity';
import { UserAccount } from '../../database/master/user-account.entity';
import { SchoolAccessGrant } from '../../database/master/school-access-grant.entity';

/**
 * Unit tests for the multi-school access change: selecting a school must only
 * succeed for a school the login is actually entitled to, and an org admin is
 * confined to their own organization's schools.
 */
describe('AuthService — multi-school select-school authorization', () => {
  let repos: Record<string, any>;
  let tenantUser: { ensureUser: jest.Mock; deactivateUser: jest.Mock };
  let service: AuthService;
  let buildTenantSession: jest.Mock;

  const mirrorUser = {
    id: 'tu1',
    name: 'Priya',
    email: 'p@x.org',
    role: 'admin',
    roleKey: null,
  };

  beforeEach(() => {
    repos = {
      superadmin: { findOne: jest.fn() },
      school: { findOne: jest.fn() },
      org: { findOne: jest.fn() },
      orgAdmin: { findOne: jest.fn() },
      account: { findOne: jest.fn(), update: jest.fn() },
      grant: { findOne: jest.fn(), update: jest.fn() },
    };
    const byEntity = new Map<unknown, any>([
      [Superadmin, repos.superadmin],
      [School, repos.school],
      [Organization, repos.org],
      [OrganizationAdmin, repos.orgAdmin],
      [UserAccount, repos.account],
      [SchoolAccessGrant, repos.grant],
    ]);
    const ds = {
      getRepository: (e: unknown) => byEntity.get(e),
    } as unknown as DataSource;
    tenantUser = { ensureUser: jest.fn(), deactivateUser: jest.fn() };

    service = new AuthService(
      ds,
      { signAsync: jest.fn() } as any,
      { get: (_k: string, d?: unknown) => d } as any,
      {} as any,
      { runInSchema: jest.fn() } as any,
      tenantUser as any,
    );

    // Stub the shared session builder + mirror loader so the tests focus on the
    // authorization decision, not token/permission plumbing.
    buildTenantSession = jest
      .fn()
      .mockImplementation(async (tenant: any, user: any) => ({
        tenant,
        user,
        tokens: { accessToken: 'signed' },
      }));
    (service as any).buildTenantSession = buildTenantSession;
    (service as any).loadMirrorUser = jest.fn().mockResolvedValue(mirrorUser);
  });

  const activeSchool = (over = {}) => ({
    id: 's1',
    slug: 'sunrise',
    schemaName: 'shared_pool',
    status: 'active',
    organizationId: 'o1',
    ...over,
  });

  describe('accountSelectSchool', () => {
    it('enters a granted school and builds a tenant session', async () => {
      repos.account.findOne.mockResolvedValue({
        id: 'acc1',
        status: 'active',
        name: 'Priya',
        email: 'p@x.org',
      });
      repos.grant.findOne.mockResolvedValue({
        id: 'g1',
        role: 'admin',
        tenantUserId: 'tu1',
      });
      repos.school.findOne.mockResolvedValue(activeSchool());

      const res = await service.accountSelectSchool('acc1', 's1');
      expect(res.tokens.accessToken).toBe('signed');
      expect(buildTenantSession).toHaveBeenCalledTimes(1);
      const [tenantArg, userArg] = buildTenantSession.mock.calls[0];
      expect(tenantArg.schoolId).toBe('s1');
      expect(userArg.id).toBe('tu1');
      expect(tenantUser.ensureUser).not.toHaveBeenCalled(); // already provisioned
    });

    it('rejects a school the account was not granted', async () => {
      repos.account.findOne.mockResolvedValue({ id: 'acc1', status: 'active' });
      repos.grant.findOne.mockResolvedValue(null);

      await expect(service.accountSelectSchool('acc1', 's1')).rejects.toThrow(
        /do not have access/,
      );
      expect(buildTenantSession).not.toHaveBeenCalled();
    });

    it('provisions the mirror user on first entry (no tenantUserId yet)', async () => {
      repos.account.findOne.mockResolvedValue({
        id: 'acc1',
        status: 'active',
        name: 'Priya',
        email: 'p@x.org',
      });
      repos.grant.findOne.mockResolvedValue({
        id: 'g1',
        role: 'teacher',
        tenantUserId: null,
      });
      repos.school.findOne.mockResolvedValue(activeSchool());
      tenantUser.ensureUser.mockResolvedValue('tuNew');

      await service.accountSelectSchool('acc1', 's1');
      expect(tenantUser.ensureUser).toHaveBeenCalledWith(
        expect.objectContaining({ schoolId: 's1', role: 'teacher' }),
      );
      expect(repos.grant.update).toHaveBeenCalledWith(
        { id: 'g1' },
        { tenantUserId: 'tuNew' },
      );
    });

    it('rejects a suspended school even with a valid grant', async () => {
      repos.account.findOne.mockResolvedValue({ id: 'acc1', status: 'active' });
      repos.grant.findOne.mockResolvedValue({ id: 'g1', role: 'admin', tenantUserId: 'tu1' });
      repos.school.findOne.mockResolvedValue(activeSchool({ status: 'suspended' }));

      await expect(service.accountSelectSchool('acc1', 's1')).rejects.toThrow(
        /suspended/,
      );
      expect(buildTenantSession).not.toHaveBeenCalled();
    });

    it('rejects a disabled account', async () => {
      repos.account.findOne.mockResolvedValue({ id: 'acc1', status: 'inactive' });
      await expect(service.accountSelectSchool('acc1', 's1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('organizationSelectSchool', () => {
    beforeEach(() => {
      repos.org.findOne.mockResolvedValue({ id: 'o1', status: 'active' });
      repos.orgAdmin.findOne.mockResolvedValue({
        id: 'a1',
        status: 'active',
        name: 'Ramesh',
        email: 'r@o1.org',
      });
      tenantUser.ensureUser.mockResolvedValue('tu1');
    });

    it('enters a school in the admin’s own organization', async () => {
      repos.school.findOne.mockResolvedValue(activeSchool({ organizationId: 'o1' }));

      const res = await service.organizationSelectSchool('a1', 'o1', 's1');
      expect(res.tokens.accessToken).toBe('signed');
      expect(tenantUser.ensureUser).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin', schoolId: 's1' }),
      );
    });

    it('rejects a school in a different organization', async () => {
      repos.school.findOne.mockResolvedValue(activeSchool({ organizationId: 'other' }));

      await expect(
        service.organizationSelectSchool('a1', 'o1', 's1'),
      ).rejects.toThrow(/not in your organization/);
      expect(buildTenantSession).not.toHaveBeenCalled();
    });

    it('rejects when the organization is inactive', async () => {
      repos.org.findOne.mockResolvedValue({ id: 'o1', status: 'inactive' });

      await expect(
        service.organizationSelectSchool('a1', 'o1', 's1'),
      ).rejects.toThrow(/inactive/);
    });
  });
});
