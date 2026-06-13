import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Lightweight audit of raw device ↔ server traffic, for debugging push-protocol
 * issues. Written fire-and-forget (never awaited on the device response path)
 * and purged by a scheduled job.
 */
@Entity({ name: 'biometric_device_logs' })
@Index(['sn'])
@Index(['sn', 'createdAt'])
export class BiometricDeviceLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  sn: string | null;

  @Column({ type: 'varchar', length: 255 })
  url: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'varchar', length: 50, name: 'table_name', nullable: true })
  tableName: string | null;

  /** Raw request data, truncated to ~10kb. */
  @Column({ type: 'text', nullable: true })
  data: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
