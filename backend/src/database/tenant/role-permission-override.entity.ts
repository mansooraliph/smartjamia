import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Per-school override of a built-in (system) role's permission set. Built-in
 * roles themselves stay defined as code constants in common/rbac/permissions.ts
 * — a row here means "for this school, role `roleKey` uses these permissions
 * instead of the constant default." Deleting the row reverts to the default.
 */
@Entity({ name: 'role_permission_overrides' })
@Index(['schoolId'])
@Index(['schoolId', 'roleKey'], { unique: true })
export class RolePermissionOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 64, name: 'role_key' })
  roleKey: string; // e.g. "owner", "manager", "teacher"

  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
