/**
 * Seeds the 4 default plans on the master DB.
 * Idempotent: existing plans (by slug) are updated.
 *
 *   Starter      ₹999  / month
 *   Growth       ₹2,499 / month
 *   Professional ₹4,999 / month
 *   Enterprise   custom
 */

import 'reflect-metadata';
import { MasterDataSource } from '../src/database/master-datasource';
import { Plan } from '../src/database/master/plan.entity';

const PAISE = 100;
const r = (rupees: number) => rupees * PAISE;

const PLANS: Partial<Plan>[] = [
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For small schools getting started',
    priceMonthly: r(999),
    priceYearly: r(9_990),
    trialDays: 14,
    maxUsers: 5,
    maxStudents: 200,
    maxStaff: 10,
    features: ['attendance', 'fees', 'basic_reports', 'sms_alerts'],
    limits: { storage_gb: 2, sms_per_month: 200 },
    isActive: true,
    isFeatured: false,
    isCustom: false,
    displayOrder: 1,
  },
  {
    name: 'Growth',
    slug: 'growth',
    description: 'For growing schools needing more features',
    priceMonthly: r(2_499),
    priceYearly: r(24_990),
    trialDays: 14,
    maxUsers: 20,
    maxStudents: 1_000,
    maxStaff: 50,
    features: [
      'attendance',
      'fees',
      'basic_reports',
      'sms_alerts',
      'exams',
      'parent_app',
      'online_payments',
      'library',
    ],
    limits: { storage_gb: 10, sms_per_month: 1_000 },
    isActive: true,
    isFeatured: true,
    isCustom: false,
    displayOrder: 2,
  },
  {
    name: 'Professional',
    slug: 'professional',
    description: 'Full-featured for established institutions',
    priceMonthly: r(4_999),
    priceYearly: r(49_990),
    trialDays: 14,
    maxUsers: 50,
    maxStudents: 5_000,
    maxStaff: 200,
    features: [
      'attendance',
      'fees',
      'basic_reports',
      'sms_alerts',
      'exams',
      'parent_app',
      'online_payments',
      'library',
      'transport',
      'hostel',
      'advanced_reports',
      'api_access',
      'biometric_devices',
    ],
    limits: { storage_gb: 50, sms_per_month: 5_000 },
    isActive: true,
    isFeatured: false,
    isCustom: false,
    displayOrder: 3,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Custom pricing for large institutions',
    priceMonthly: 0,
    priceYearly: 0,
    trialDays: 30,
    maxUsers: -1,
    maxStudents: -1,
    maxStaff: -1,
    features: [
      'attendance',
      'fees',
      'basic_reports',
      'sms_alerts',
      'exams',
      'parent_app',
      'online_payments',
      'library',
      'transport',
      'hostel',
      'advanced_reports',
      'api_access',
      'custom_domain',
      'sso',
      'dedicated_support',
      'biometric_devices',
    ],
    limits: { storage_gb: -1, sms_per_month: -1 },
    isActive: true,
    isFeatured: false,
    isCustom: true,
    displayOrder: 4,
  },
];

async function main() {
  try {
    await MasterDataSource.initialize();
    const repo = MasterDataSource.getRepository(Plan);

    for (const p of PLANS) {
      const existing = await repo.findOne({ where: { slug: p.slug! } });
      if (existing) {
        await repo.update({ id: existing.id }, p);
        console.log(`↻ Updated plan: ${p.slug}`);
      } else {
        await repo.save(repo.create(p));
        console.log(`+ Created plan: ${p.slug}`);
      }
    }

    await MasterDataSource.destroy();
    console.log('\n✔ Plans seeded successfully\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Failed to seed plans:', err);
    process.exit(1);
  }
}

main();
