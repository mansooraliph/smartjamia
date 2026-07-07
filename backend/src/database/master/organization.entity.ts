import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type OrganizationStatus = 'active' | 'inactive';

/**
 * A tenant-owning group that sits above Schools: Super Admin → Organization →
 * Schools. Lives in the master DB. Carries the primary admin's contact details
 * (login accounts for org admins live in `organization_admins`) and the cap on
 * how many schools this org may create (`max_schools_allowed`; -1 = unlimited).
 */
@Entity({ name: 'organizations' })
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, name: 'admin_name', nullable: true })
  adminName: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, name: 'admin_email', unique: true })
  adminEmail: string;

  @Column({ type: 'varchar', length: 20, name: 'admin_phone', nullable: true })
  adminPhone: string | null;

  /** Max schools this org may create. -1 = unlimited. */
  @Column({ type: 'integer', name: 'max_schools_allowed', default: 5 })
  maxSchoolsAllowed: number;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: OrganizationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
