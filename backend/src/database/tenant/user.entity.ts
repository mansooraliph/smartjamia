import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type UserRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'teacher'
  | 'staff'
  | 'cashier'
  | 'student'
  | 'parent';

@Entity({ name: 'users' })
@Index(['schoolId'])
@Index(['schoolId', 'email'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'password_hash',
    select: false,
    nullable: true,
  })
  passwordHash: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'pin_hash',
    select: false,
    nullable: true,
  })
  pinHash: string | null;

  @Column({
    type: 'enum',
    enum: [
      'owner',
      'admin',
      'manager',
      'teacher',
      'staff',
      'cashier',
      'student',
      'parent',
    ],
    default: 'staff',
  })
  role: UserRole;

  /**
   * Effective role identity. Null → use the `role` enum (built-in role).
   * Set to a custom role's slug to assign an admin-created role; permissions
   * then come from that role instead of the base enum.
   */
  @Column({ type: 'varchar', length: 64, name: 'role_key', nullable: true })
  roleKey: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 500, name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'refresh_token_hash',
    select: false,
    nullable: true,
  })
  refreshTokenHash: string | null;

  @Column({ type: 'timestamp', name: 'last_login_at', nullable: true })
  lastLoginAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
