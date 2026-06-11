import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { School } from '../../../database/master/school.entity';
import { Plan } from '../../../database/master/plan.entity';
import { Subscription } from '../../../database/master/subscription.entity';
import { PlatformInvoice } from '../../../database/master/platform-invoice.entity';
import { CheckoutDto, VerifyPaymentDto } from './dto/billing.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly schools: Repository<School>;
  private readonly plans: Repository<Plan>;
  private readonly subs: Repository<Subscription>;
  private readonly invoices: Repository<PlatformInvoice>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly config: ConfigService,
  ) {
    this.schools = ds.getRepository(School);
    this.plans = ds.getRepository(Plan);
    this.subs = ds.getRepository(Subscription);
    this.invoices = ds.getRepository(PlatformInvoice);
  }

  private keyId() {
    return this.config.get<string>('RAZORPAY_KEY_ID') || '';
  }
  private keySecret() {
    return this.config.get<string>('RAZORPAY_KEY_SECRET') || '';
  }
  private gatewayReady() {
    return !!this.keyId() && !!this.keySecret();
  }

  // ── Billing overview for the school ─────────────────────────────────────────
  async getBilling(schoolId: string) {
    const school = await this.schools.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');

    const plan = school.planId
      ? await this.plans.findOne({ where: { id: school.planId } })
      : null;
    const subscription = await this.subs.findOne({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });
    const invoices = await this.invoices.find({
      where: { schoolId },
      order: { createdAt: 'DESC' },
      take: 24,
    });
    const available = await this.plans.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });

    const now = Date.now();
    const trialEnd = school.trialEndsAt
      ? new Date(school.trialEndsAt).getTime()
      : null;
    const trialDaysLeft =
      trialEnd != null
        ? Math.max(0, Math.ceil((trialEnd - now) / 86400000))
        : null;

    return {
      status: school.status,
      isTrial: school.status === 'trial',
      trialStartsAt: school.trialStartsAt,
      trialEndsAt: school.trialEndsAt,
      trialDaysLeft,
      subscriptionEndsAt: school.subscriptionEndsAt,
      plan: plan
        ? {
            id: plan.id,
            name: plan.name,
            slug: plan.slug,
            priceMonthly: plan.priceMonthly,
            priceYearly: plan.priceYearly,
            isCustom: plan.isCustom,
          }
        : null,
      subscription: subscription
        ? {
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            amount: subscription.amount,
            currency: subscription.currency,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            paymentGateway: subscription.paymentGateway,
          }
        : null,
      invoices: invoices.map((i) => ({
        invoiceNumber: i.invoiceNumber,
        amount: i.amount,
        currency: i.currency,
        status: i.status,
        paidAt: i.paidAt,
        createdAt: i.createdAt,
      })),
      availablePlans: available.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        priceMonthly: p.priceMonthly,
        priceYearly: p.priceYearly,
        isCustom: p.isCustom,
        isFeatured: p.isFeatured,
        features: p.features ?? [],
        maxStudents: p.maxStudents,
        maxStaff: p.maxStaff,
      })),
      gatewayConfigured: this.gatewayReady(),
      razorpayKeyId: this.keyId(),
    };
  }

  // ── Create a Razorpay order for an upgrade ──────────────────────────────────
  async checkout(schoolId: string, dto: CheckoutDto) {
    if (!this.gatewayReady()) {
      throw new BadRequestException(
        'Online payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
      );
    }
    const plan = await this.plans.findOne({ where: { id: dto.planId } });
    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found');
    if (plan.isCustom) {
      throw new BadRequestException('Enterprise is custom-priced — contact sales.');
    }
    const amount =
      dto.billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    if (amount <= 0) throw new BadRequestException('Invalid plan amount');

    const auth = Buffer.from(`${this.keyId()}:${this.keySecret()}`).toString(
      'base64',
    );
    const receipt = `rcpt_${schoolId.slice(0, 8)}_${plan.slug}`.slice(0, 40);
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt,
        notes: { schoolId, planId: plan.id, billingCycle: dto.billingCycle },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Razorpay order failed (${res.status}): ${text}`);
      throw new BadRequestException(
        'Could not start payment. Please try again or contact support.',
      );
    }
    const order = (await res.json()) as { id: string; amount: number };
    return {
      orderId: order.id,
      amount: order.amount,
      currency: 'INR',
      keyId: this.keyId(),
      planName: plan.name,
    };
  }

  // ── Verify a completed payment + activate the subscription ──────────────────
  async verifyAndActivate(schoolId: string, dto: VerifyPaymentDto) {
    const expected = crypto
      .createHmac('sha256', this.keySecret())
      .update(`${dto.razorpayOrderId}|${dto.razorpayPaymentId}`)
      .digest('hex');
    const valid =
      expected.length === dto.razorpaySignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(dto.razorpaySignature),
      );
    if (!valid) {
      throw new BadRequestException('Payment signature verification failed');
    }
    await this.activate(
      schoolId,
      dto.planId,
      dto.billingCycle,
      dto.razorpayPaymentId,
    );
    return this.getBilling(schoolId);
  }

  /** Activate (or renew) a paid subscription + write a paid invoice. Idempotent per payment. */
  async activate(
    schoolId: string,
    planId: string,
    billingCycle: 'monthly' | 'yearly',
    gatewayPaymentId: string,
  ) {
    const school = await this.schools.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    const plan = await this.plans.findOne({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');

    // Idempotency: skip if this payment was already recorded.
    const dup = await this.invoices.findOne({ where: { gatewayPaymentId } });
    if (dup) return;

    const amount =
      billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
    const now = new Date();
    const end = new Date(now);
    if (billingCycle === 'yearly') end.setFullYear(end.getFullYear() + 1);
    else end.setMonth(end.getMonth() + 1);

    let sub = await this.subs.findOne({
      where: { schoolId },
      order: { createdAt: 'DESC' },
    });
    if (!sub) {
      sub = this.subs.create({ schoolId });
    }
    Object.assign(sub, {
      planId: plan.id,
      status: 'active',
      billingCycle,
      amount,
      currency: 'INR',
      currentPeriodStart: now,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: false,
      paymentGateway: 'razorpay',
    });
    sub = await this.subs.save(sub);

    school.planId = plan.id;
    school.status = 'active';
    school.subscriptionStartsAt = now;
    school.subscriptionEndsAt = end;
    await this.schools.save(school);

    const count = await this.invoices.count();
    const invoiceNumber = `EDU-INV-${String(count + 1).padStart(6, '0')}`;
    await this.invoices.save(
      this.invoices.create({
        schoolId,
        subscriptionId: sub.id,
        invoiceNumber,
        amount,
        currency: 'INR',
        status: 'paid',
        paidAt: now,
        paymentGateway: 'razorpay',
        gatewayPaymentId,
      }),
    );
    this.logger.log(`Activated ${school.slug} → ${plan.name} (${invoiceNumber})`);
  }

  // ── Razorpay webhook (signature over raw body) ──────────────────────────────
  async handleWebhook(rawBody: Buffer, signature: string) {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET') || '';
    if (!secret) return { ok: false, reason: 'webhook not configured' };
    const expected = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    if (
      expected.length !== signature.length ||
      !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }
    const event = JSON.parse(rawBody.toString());
    if (event.event === 'payment.captured') {
      const p = event.payload?.payment?.entity ?? {};
      const notes = p.notes ?? {};
      if (notes.schoolId && notes.planId && notes.billingCycle) {
        await this.activate(
          notes.schoolId,
          notes.planId,
          notes.billingCycle,
          p.id,
        );
      }
    }
    return { ok: true };
  }
}
