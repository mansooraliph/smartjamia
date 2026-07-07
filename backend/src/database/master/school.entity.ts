import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Plan } from './plan.entity';
import { Organization } from './organization.entity';

export type SchoolStatus =
  | 'trial'
  | 'active'
  | 'grace_period'
  | 'suspended'
  | 'cancelled';

@Entity({ name: 'schools' })
@Index(['organizationId'])
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Owning organization. Nullable — schools created directly by a Super Admin
   * (platform-direct) have no organization. When set, the org's
   * `max_schools_allowed` limit applies on creation.
   */
  @Column({ type: 'uuid', name: 'organization_id', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 500, name: 'logo_url', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'uuid', name: 'plan_id', nullable: true })
  planId: string | null;

  @ManyToOne(() => Plan, { nullable: true })
  @JoinColumn({ name: 'plan_id' })
  plan: Plan | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'schema_name',
    default: 'shared_pool',
  })
  schemaName: string;

  @Column({
    type: 'boolean',
    name: 'is_schema_provisioned',
    default: false,
  })
  isSchemaProvisioned: boolean;

  @Column({
    type: 'enum',
    enum: ['trial', 'active', 'grace_period', 'suspended', 'cancelled'],
    default: 'trial',
  })
  status: SchoolStatus;

  /**
   * True when this school was suspended as a side-effect of its organization
   * being deactivated (cascade). Lets org re-activation restore exactly those
   * schools without touching schools suspended for other reasons.
   */
  @Column({ type: 'boolean', name: 'suspended_by_org', default: false })
  suspendedByOrg: boolean;

  @Column({ type: 'timestamp', name: 'trial_starts_at', nullable: true })
  trialStartsAt: Date | null;

  @Column({ type: 'timestamp', name: 'trial_ends_at', nullable: true })
  trialEndsAt: Date | null;

  @Column({
    type: 'timestamp',
    name: 'subscription_starts_at',
    nullable: true,
  })
  subscriptionStartsAt: Date | null;

  @Column({
    type: 'timestamp',
    name: 'subscription_ends_at',
    nullable: true,
  })
  subscriptionEndsAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
