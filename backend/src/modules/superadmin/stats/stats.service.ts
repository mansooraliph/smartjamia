import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { School } from '../../../database/master/school.entity';
import { Plan } from '../../../database/master/plan.entity';
import { Subscription } from '../../../database/master/subscription.entity';
import { Superadmin } from '../../../database/master/superadmin.entity';
import { Branch } from '../../../database/master/branch.entity';

@Injectable()
export class StatsService {
  constructor(@InjectDataSource('master') private readonly ds: DataSource) {}

  async overview() {
    const schoolRepo = this.ds.getRepository(School);
    const planRepo = this.ds.getRepository(Plan);
    const subRepo = this.ds.getRepository(Subscription);
    const saRepo = this.ds.getRepository(Superadmin);
    const branchRepo = this.ds.getRepository(Branch);

    const [
      totalSchools,
      activeSchools,
      trialSchools,
      totalPlans,
      activePlans,
      totalSubscriptions,
      activeSubscriptions,
      totalSuperadmins,
      totalBranches,
    ] = await Promise.all([
      schoolRepo.count(),
      schoolRepo.count({ where: { status: 'active' } }),
      schoolRepo.count({ where: { status: 'trial' } }),
      planRepo.count(),
      planRepo.count({ where: { isActive: true } }),
      subRepo.count(),
      subRepo.count({ where: { status: 'active' } }),
      saRepo.count(),
      branchRepo.count(),
    ]);

    return {
      schools: {
        total: totalSchools,
        active: activeSchools,
        trial: trialSchools,
      },
      plans: { total: totalPlans, active: activePlans },
      subscriptions: { total: totalSubscriptions, active: activeSubscriptions },
      branches: { total: totalBranches },
      superadmins: { total: totalSuperadmins },
    };
  }
}
