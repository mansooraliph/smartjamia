import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * One row per central-account login event (and per school entered), so an
 * org admin can review a user's login history — separate from
 * `UserAccount.lastLoginAt`, which only ever holds the most recent moment.
 */
@Entity({ name: 'user_login_activity' })
@Index(['userAccountId'])
export class UserLoginActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_account_id' })
  userAccountId: string;

  /** Set when this row represents entering a specific school. */
  @Column({ type: 'uuid', name: 'school_id', nullable: true })
  schoolId: string | null;

  @Column({ type: 'varchar', length: 20 })
  event: 'login' | 'select_school';

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 255, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
