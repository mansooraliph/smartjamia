import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from './school.entity';
import { Plan } from './plan.entity';

export type SubStatus =
  | 'trial'
  | 'active'
  | 'grace_period'
  | 'cancelled'
  | 'expired';

export type BillingCycle = 'monthly' | 'yearly' | 'lifetime';
export type PaymentGatewayType = 'razorpay' | 'stripe' | 'manual';

@Entity({ name: 'subscriptions' })
@Index(['schoolId'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ type: 'uuid', name: 'plan_id' })
  planId: string;

  @ManyToOne(() => Plan)
  @JoinColumn({ name: 'plan_id' })
  plan: Plan;

  @Column({
    type: 'enum',
    enum: ['trial', 'active', 'grace_period', 'cancelled', 'expired'],
    default: 'trial',
  })
  status: SubStatus;

  @Column({
    type: 'enum',
    enum: ['monthly', 'yearly', 'lifetime'],
    name: 'billing_cycle',
    default: 'monthly',
  })
  billingCycle: BillingCycle;

  // paise, locked at subscription time
  @Column({ type: 'integer', default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({ type: 'timestamp', name: 'trial_ends_at', nullable: true })
  trialEndsAt: Date | null;

  @Column({ type: 'timestamp', name: 'current_period_start', nullable: true })
  currentPeriodStart: Date | null;

  @Column({ type: 'timestamp', name: 'current_period_end', nullable: true })
  currentPeriodEnd: Date | null;

  @Column({
    type: 'boolean',
    name: 'cancel_at_period_end',
    default: false,
  })
  cancelAtPeriodEnd: boolean;

  @Column({ type: 'timestamp', name: 'cancelled_at', nullable: true })
  cancelledAt: Date | null;

  @Column({
    type: 'enum',
    enum: ['razorpay', 'stripe', 'manual'],
    name: 'payment_gateway',
    nullable: true,
  })
  paymentGateway: PaymentGatewayType | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'gateway_subscription_id',
    nullable: true,
  })
  gatewaySubscriptionId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'gateway_customer_id',
    nullable: true,
  })
  gatewayCustomerId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
