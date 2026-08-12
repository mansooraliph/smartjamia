import { Module } from '@nestjs/common';

import { PlansController } from './plans/plans.controller';
import { PlansService } from './plans/plans.service';

import { SchoolsController } from './schools/schools.controller';
import { SchoolsService } from './schools/schools.service';
import { SchoolProvisioningService } from './schools/school-provisioning.service';

import { MaintenanceController } from './maintenance/maintenance.controller';
import { MaintenanceService } from './maintenance/maintenance.service';

import { SubscriptionsController } from './subscriptions/subscriptions.controller';
import { SubscriptionsService } from './subscriptions/subscriptions.service';

import { BranchesController } from './branches/branches.controller';
import { BranchesService } from './branches/branches.service';

import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';

import { OrganizationsController } from './organizations/organizations.controller';
import { OrganizationsService } from './organizations/organizations.service';

import { IdentityController } from './identity/identity.controller';
import { IdentityService } from './identity/identity.service';

import { OrgPortalController } from './organization-portal/org-portal.controller';
import { OrgPortalService } from './organization-portal/org-portal.service';

import { SuperadminGuard } from '../../common/guards/superadmin.guard';
import { OrganizationGuard } from '../../common/guards/organization.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [
    PlansController,
    SchoolsController,
    OrganizationsController,
    IdentityController,
    OrgPortalController,
    SubscriptionsController,
    BranchesController,
    StatsController,
    MaintenanceController,
  ],
  providers: [
    PlansService,
    SchoolsService,
    SchoolProvisioningService,
    OrganizationsService,
    IdentityService,
    OrgPortalService,
    SubscriptionsService,
    BranchesService,
    StatsService,
    MaintenanceService,
    SuperadminGuard,
    OrganizationGuard,
  ],
})
export class SuperadminModule {}
