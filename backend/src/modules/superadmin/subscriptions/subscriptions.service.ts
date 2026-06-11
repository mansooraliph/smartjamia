import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Subscription } from '../../../database/master/subscription.entity';
import { School } from '../../../database/master/school.entity';
import { Plan } from '../../../database/master/plan.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  private readonly repo: Repository<Subscription>;
  private readonly schoolRepo: Repository<School>;
  private readonly planRepo: Repository<Plan>;

  constructor(@InjectDataSource('master') ds: DataSource) {
    this.repo = ds.getRepository(Subscription);
    this.schoolRepo = ds.getRepository(School);
    this.planRepo = ds.getRepository(Plan);
  }

  list() {
    return this.repo.find({
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
    const periodEnd = new Date(now);
    if (dto.billingCycle === 'monthly') {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    } else {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    }

    const sub = this.repo.create({
      ...dto,
      currency: dto.currency ?? 'INR',
      status: dto.status ?? 'trial',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEndsAt: school.trialEndsAt ?? null,
    });
    return this.repo.save(sub);
  }

  async update(id: string, dto: UpdateSubscriptionDto) {
    const sub = await this.findOne(id);

    if (dto.schoolId) {
      const s = await this.schoolRepo.findOne({ where: { id: dto.schoolId } });
      if (!s) throw new NotFoundException('School not found');
    }
    if (dto.planId) {
      const p = await this.planRepo.findOne({ where: { id: dto.planId } });
      if (!p) throw new NotFoundException('Plan not found');
    }

    Object.assign(sub, dto);
    return this.repo.save(sub);
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
