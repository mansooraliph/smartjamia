import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import slugify from 'slugify';
import * as bcrypt from 'bcrypt';
import { School } from '../../database/master/school.entity';
import { Plan } from '../../database/master/plan.entity';
import { Subscription } from '../../database/master/subscription.entity';
import { User } from '../../database/tenant/user.entity';
import { TenantSchemaService } from '../../common/tenant/tenant-schema.service';
import { AuthService } from '../auth/auth.service';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class PublicService {
  private readonly schools: Repository<School>;
  private readonly plans: Repository<Plan>;
  private readonly subs: Repository<Subscription>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly tenantSchema: TenantSchemaService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {
    this.schools = ds.getRepository(School);
    this.plans = ds.getRepository(Plan);
    this.subs = ds.getRepository(Subscription);
  }

  /** Public pricing — active plans, marketing-safe fields only. */
  async activePlans() {
    const plans = await this.plans.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceMonthly: p.priceMonthly,
      priceYearly: p.priceYearly,
      trialDays: p.trialDays,
      maxUsers: p.maxUsers,
      maxStudents: p.maxStudents,
      maxStaff: p.maxStaff,
      features: p.features ?? [],
      limits: p.limits ?? {},
      isFeatured: p.isFeatured,
      isCustom: p.isCustom,
    }));
  }

  /** Self-service school signup → starts a trial + auto-logs the owner in. */
  async signup(dto: SignupDto) {
    const plan = await this.plans.findOne({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('Selected plan is not available');
    }
    if (plan.isCustom) {
      throw new BadRequestException(
        'The Enterprise plan is custom-priced — please contact our sales team.',
      );
    }

    if (await this.schools.findOne({ where: { email: dto.email } })) {
      throw new ConflictException(
        'An account with this email already exists. Try logging in instead.',
      );
    }

    const slug = await this.uniqueSlug(dto.schoolName);
    const code = await this.uniqueCode(dto.schoolName);

    const trialDays = plan.trialDays ?? 14;
    const now = new Date();
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + trialDays);

    const school = await this.schools.save(
      this.schools.create({
        name: dto.schoolName,
        slug,
        code,
        email: dto.email,
        phone: dto.phone ?? null,
        planId: plan.id,
        schemaName: 'shared_pool',
        isSchemaProvisioned: false,
        status: 'trial',
        trialStartsAt: now,
        trialEndsAt: trialEnd,
      }),
    );

    // Owner login user (tenant schema).
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 12));
    const passwordHash = await bcrypt.hash(dto.password, rounds);
    await this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      await em.getRepository(User).save(
        em.getRepository(User).create({
          schoolId: school.id,
          name: dto.ownerName,
          email: dto.email,
          passwordHash,
          pinHash: null,
          role: 'owner',
          isActive: true,
        }),
      );
    });

    // Formal trial subscription (basis for billing).
    const billingCycle = dto.billingCycle ?? 'monthly';
    const amount =
      billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    await this.subs.save(
      this.subs.create({
        schoolId: school.id,
        planId: plan.id,
        status: 'trial',
        billingCycle,
        amount,
        currency: 'INR',
        trialEndsAt: trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        cancelAtPeriodEnd: false,
      }),
    );

    // Auto-login the owner so signup lands straight in the app.
    const session = await this.auth.tenantLogin(
      school.code,
      dto.email,
      dto.password,
    );

    return {
      ...session,
      trial: { endsAt: trialEnd, days: trialDays },
      plan: { name: plan.name, slug: plan.slug },
    };
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base =
      slugify(name, { lower: true, strict: true, trim: true }) || 'school';
    let slug = base;
    let i = 2;
    while (await this.schools.findOne({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  private async uniqueCode(name: string): Promise<string> {
    const cleaned = name
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    let base =
      words.length >= 2
        ? words.map((w) => w[0]).join('').slice(0, 6)
        : (words[0] ?? 'SCHOOL').slice(0, 8);
    if (base.length < 2) base = 'SCHOOL';
    let code = base;
    let i = 2;
    while (await this.schools.findOne({ where: { code } })) {
      code = `${base}${i++}`;
    }
    return code;
  }
}
