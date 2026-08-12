import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { School } from '../../../database/master/school.entity';
import { Subscription } from '../../../database/master/subscription.entity';

type SchoolStatus =
  | 'trial'
  | 'active'
  | 'grace_period'
  | 'suspended'
  | 'cancelled';

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private readonly schools: Repository<School>;
  private readonly subs: Repository<Subscription>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly config: ConfigService,
  ) {
    this.schools = ds.getRepository(School);
    this.subs = ds.getRepository(Subscription);
  }

  private graceDays(): number {
    return Number(this.config.get('SUBSCRIPTION_GRACE_DAYS', 3));
  }

  /** Daily 1am — move expired trials/subscriptions through grace → suspended. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM, { name: 'subscription-expiry' })
  async dailyExpiry() {
    const r = await this.runExpiry();
    this.logger.log(
      `Expiry sweep: checked ${r.checked}, →grace ${r.toGrace}, →suspended ${r.toSuspended}, restored ${r.restored}`,
    );
    return r;
  }

  /** Re-evaluate every live school's status against its trial/subscription end. */
  async runExpiry(now: Date = new Date()) {
    const graceMs = this.graceDays() * 86400000;
    const schools = await this.schools.find({
      where: {
        status: In(['trial', 'active', 'grace_period']),
        deletedAt: IsNull(),
      },
    });

    const changes: {
      schoolId: string;
      code: string;
      from: SchoolStatus;
      to: SchoolStatus;
    }[] = [];

    for (const s of schools) {
      const sub = await this.subs.findOne({
        where: { schoolId: s.id },
        order: { createdAt: 'DESC' },
      });

      // Paid schools expire on subscriptionEndsAt; trials on trialEndsAt. Fall
      // back to the subscription's own period end if the school row is out of
      // sync (e.g. a subscription assigned before school.subscriptionEndsAt
      // was kept in sync) so a school with a live subscription doesn't get
      // expired off its long-past trial date.
      const activeSub =
        sub && sub.status !== 'cancelled' && sub.status !== 'expired'
          ? sub
          : null;
      const end =
        s.subscriptionEndsAt ?? activeSub?.currentPeriodEnd ?? s.trialEndsAt;
      if (!end) continue;
      const endMs = new Date(end).getTime();
      const base: SchoolStatus =
        s.subscriptionEndsAt || activeSub?.currentPeriodEnd
          ? 'active'
          : 'trial';

      // Repair a school row that's missing this even when status won't change.
      const needsRepair = !s.subscriptionEndsAt && !!activeSub?.currentPeriodEnd;
      if (needsRepair) {
        s.subscriptionStartsAt = activeSub!.currentPeriodStart;
        s.subscriptionEndsAt = activeSub!.currentPeriodEnd;
      }

      let target: SchoolStatus;
      if (now.getTime() <= endMs) target = base; // active/trial (or restored on renewal)
      else if (now.getTime() <= endMs + graceMs) target = 'grace_period';
      else target = 'suspended';

      if (target === s.status) {
        if (needsRepair) await this.schools.save(s);
        continue;
      }

      const from = s.status as SchoolStatus;
      s.status = target;
      await this.schools.save(s);

      if (sub) {
        sub.status =
          target === 'suspended'
            ? 'expired'
            : target === 'grace_period'
              ? 'grace_period'
              : (base as any);
        await this.subs.save(sub);
      }
      changes.push({ schoolId: s.id, code: s.code, from, to: target });
    }

    return {
      checked: schools.length,
      toGrace: changes.filter((c) => c.to === 'grace_period').length,
      toSuspended: changes.filter((c) => c.to === 'suspended').length,
      restored: changes.filter((c) => c.to === 'active' || c.to === 'trial')
        .length,
      changes,
    };
  }
}
