import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserAccountStatus = 'active' | 'inactive';

/**
 * A central login identity in the master DB. One account = one email/password
 * that can hold access to multiple schools via `school_access_grants`. The
 * email is globally unique across the platform, which is what gives us
 * system-wide login-email uniqueness for free.
 *
 * When an account is granted a school, a mirror `users` row is provisioned in
 * that school's tenant schema (so all existing tenant code / audit trails keep
 * a real user to reference); selecting a school then issues a normal tenant
 * token pointing at that mirror user.
 */
@Entity({ name: 'user_accounts' })
export class UserAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'password_hash',
    select: false,
  })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: UserAccountStatus;

  @Column({ type: 'timestamp', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
