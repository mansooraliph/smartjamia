import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'plans' })
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // paise
  @Column({ type: 'integer', name: 'price_monthly', default: 0 })
  priceMonthly: number;

  @Column({ type: 'integer', name: 'price_yearly', default: 0 })
  priceYearly: number;

  @Column({ type: 'integer', name: 'trial_days', default: 14 })
  trialDays: number;

  @Column({ type: 'integer', name: 'max_users', default: 1 })
  maxUsers: number;

  @Column({ type: 'integer', name: 'max_students', default: 100 })
  maxStudents: number;

  @Column({ type: 'integer', name: 'max_staff', default: 5 })
  maxStaff: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  features: string[];

  @Column({ type: 'jsonb', default: () => "'{}'" })
  limits: Record<string, unknown>;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ type: 'boolean', name: 'is_custom', default: false })
  isCustom: boolean;

  @Column({ type: 'integer', name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
