import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'announcements' })
@Index(['schoolId'])
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'varchar',
    array: true,
    length: 50,
    name: 'target_roles',
    default: () => "'{}'::varchar[]",
  })
  targetRoles: string[];

  @Column({
    type: 'uuid',
    array: true,
    name: 'target_class_ids',
    default: () => "'{}'::uuid[]",
  })
  targetClassIds: string[];

  @Column({ type: 'boolean', name: 'is_pinned', default: false })
  isPinned: boolean;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'attachment_url',
    nullable: true,
  })
  attachmentUrl: string | null;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @Column({ type: 'timestamp', name: 'expires_at', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
