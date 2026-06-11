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

import { SuperadminGuard } from '../../common/guards/superadmin.guard';

@Module({
  controllers: [
    PlansController,
    SchoolsController,
    SubscriptionsController,
    BranchesController,
    StatsController,
    MaintenanceController,
  ],
  providers: [
    PlansService,
    SchoolsService,
    SchoolProvisioningService,
    SubscriptionsService,
    BranchesService,
    StatsService,
    MaintenanceService,
    SuperadminGuard,
  ],
})
export class SuperadminModule {}
