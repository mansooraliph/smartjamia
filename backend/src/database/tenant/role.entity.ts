import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Custom (admin-created) roles. Built-in roles (owner/admin/.../cashier) are
 * NOT stored here — they live as code constants in common/rbac/permissions.ts
 * and are immutable. A custom role's `key` is the slug stored on
 * `users.role_key` to assign it.
 */
@Entity({ name: 'roles' })
@Index(['schoolId'])
@Index(['schoolId', 'key'], { unique: true })
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 64 })
  key: string; // slug, e.g. "librarian"

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
