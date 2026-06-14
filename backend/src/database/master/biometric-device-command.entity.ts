import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A command queued for a device, polled by the device via GET /iclock/getrequest.
 * Kept in MASTER (keyed by device SN) because commands can be queued before a
 * device is fully assigned to a school. The (sn, status) composite index is
 * critical for getRequest polling latency.
 */
@Entity({ name: 'biometric_device_commands' })
@Index(['sn'])
@Index(['schoolId'])
@Index(['status'])
@Index(['sn', 'status'])
export class BiometricDeviceCommand {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Target device serial number. */
  @Column({ type: 'varchar', length: 100 })
  sn: string;

  @Column({ type: 'uuid', name: 'school_id', nullable: true })
  schoolId: string | null;

  /** Raw command string, e.g. "DATA USER PIN=1\tName=John\tPri=0\tCard=\tPasswd=". */
  @Column({ type: 'text' })
  command: string;

  /** 0 = pending, 1 = success, 2 = error. */
  @Column({ type: 'smallint', default: 0 })
  status: number;

  @Column({ type: 'integer', name: 'device_return_code', nullable: true })
  deviceReturnCode: number | null;

  @Column({ type: 'uuid', name: 'created_by_user_id', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
