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
import { UserAccount } from './user-account.entity';
import { School } from './school.entity';

export type GrantStatus = 'active' | 'revoked';

/**
 * Grants a `UserAccount` access to one `School`, with a role that applies only
 * within that school (so the same account can be an admin in School A and a
 * teacher in School B). `tenantUserId` points at the mirror `users` row in the
 * school's schema; selecting this school issues a tenant token for that user.
 */
@Entity({ name: 'school_access_grants' })
@Index(['userAccountId'])
@Index(['schoolId'])
@Index(['userAccountId', 'schoolId'], { unique: true })
export class SchoolAccessGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_account_id' })
  userAccountId: string;

  @ManyToOne(() => UserAccount, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_account_id' })
  userAccount: UserAccount;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  /** Role within this school — a base tenant role (owner/admin/…/cashier). */
  @Column({ type: 'varchar', length: 64 })
  role: string;

  /** The mirror `users` row id in the school's tenant schema. */
  @Column({ type: 'uuid', name: 'tenant_user_id', nullable: true })
  tenantUserId: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'revoked'],
    default: 'active',
  })
  status: GrantStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
