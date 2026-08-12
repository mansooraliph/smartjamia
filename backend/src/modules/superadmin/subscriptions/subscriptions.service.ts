import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  BillingCycle,
  Subscription,
} from '../../../database/master/subscription.entity';
import { School } from '../../../database/master/school.entity';
import { Plan } from '../../../database/master/plan.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  // Sentinel "never expires" end date for lifetime subscriptions — keeps the
  // expiry sweep's plain date-comparison logic working with no special-casing.
  private static readonly LIFETIME_END = new Date('2099-12-31T00:00:00.000Z');

  private readonly repo: Repository<Subscription>;
  private readonly schoolRepo: Repository<School>;
  private readonly planRepo: Repository<Plan>;

  constructor(@InjectDataSource('master') ds: DataSource) {
    this.repo = ds.getRepository(Subscription);
    this.schoolRepo = ds.getRepository(School);
    this.planRepo = ds.getRepository(Plan);
  }

  list(schoolId?: string) {
    return this.repo.find({
      where: schoolId ? { schoolId } : {},
      relations: { school: true, plan: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const sub = await this.repo.findOne({
      where: { id },
      relations: { school: true, plan: true },
    });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async create(dto: CreateSubscriptionDto) {
    const school = await this.schoolRepo.findOne({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('School not found');
    const plan = await this.planRepo.findOne({ where: { id: dto.planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    if (dto.amount <= 0 && !plan.isCustom) {
      throw new BadRequestException('Amount must be > 0 for non-custom plans');
    }

    const now = new Date();
    const periodEnd = this.computePeriodEnd(dto.billingCycle, now);

    const sub = this.repo.create({
      ...dto,
      currency: dto.currency ?? 'INR',
      status: dto.status ?? 'trial',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt: school.trialEndsAt ?? null,
    });
    const saved = await this.repo.save(sub);

    // Keep the school row in sync — the daily expiry sweep (MaintenanceService)
    // reads school.subscriptionEndsAt directly, not the subscriptions table, so
    // without this a subscription created here never actually protects the
    // school from being expired on trialEndsAt.
    await this.syncSchoolFromSubscription(school, saved, plan);

    return saved;
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const sub = await this.findOne(id);

    let school = sub.school;
    if (dto.schoolId) {
      const s = await this.schoolRepo.findOne({ where: { id: dto.schoolId } });
      if (!s) throw new NotFoundException('School not found');
      school = s;
    }
    let plan = sub.plan;
    if (dto.planId) {
      const p = await this.planRepo.findOne({ where: { id: dto.planId } });
      if (!p) throw new NotFoundException('Plan not found');
      plan = p;
    }

    // Changing the billing cycle (e.g. upgrading to lifetime) restarts the
    // current period from now, same as a fresh subscription would.
    const cycleChanged = dto.billingCycle && dto.billingCycle !== sub.billingCycle;

    Object.assign(sub, dto);
    if (cycleChanged) {
      const now = new Date();
      sub.currentPeriodStart = now;
      sub.currentPeriodEnd = this.computePeriodEnd(sub.billingCycle, now);
    }
    const saved = await this.repo.save(sub);

    if (school) {
      await this.syncSchoolFromSubscription(school, saved, plan ?? null);
    }

    return saved;
  }

  private computePeriodEnd(cycle: BillingCycle, from: Date): Date {
    if (cycle === 'lifetime') return new Date(SubscriptionsService.LIFETIME_END);
    const end = new Date(from);
    if (cycle === 'monthly') end.setMonth(end.getMonth() + 1);
    else end.setFullYear(end.getFullYear() + 1);
    return end;
  }

  /** Mirror a subscription's plan/period/status onto its school so the expiry
   * sweep evaluates the real subscription instead of falling back to the
   * (usually long-expired) trial end date. */
  private async syncSchoolFromSubscription(
    school: School,
    sub: Subscription,
    plan: Plan | null,
  ) {
    const statusMap: Record<string, School['status']> = {
      trial: 'trial',
      active: 'active',
      grace_period: 'grace_period',
      cancelled: 'cancelled',
      expired: 'suspended',
    };
    school.planId = plan?.id ?? school.planId;
    school.status = statusMap[sub.status] ?? school.status;
    school.subscriptionStartsAt = sub.currentPeriodStart;
    school.subscriptionEndsAt = sub.currentPeriodEnd;
    await this.schoolRepo.save(school);
  }

  async cancel(id: string, immediate = false) {
    const sub = await this.findOne(id);
    if (immediate) {
      sub.status = 'cancelled';
      sub.cancelledAt = new Date();
    } else {
      sub.cancelAtPeriodEnd = true;
    }
    return this.repo.save(sub);
  }

  async remove(id: string) {
    const sub = await this.findOne(id);
    await this.repo.remove(sub);
    return { deleted: true, id };
  }
}
