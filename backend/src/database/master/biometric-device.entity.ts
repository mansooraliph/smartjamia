import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from './school.entity';

/**
 * A push-protocol biometric terminal (ZKTeco "iclock" / ESSL). Lives in the
 * MASTER db because a device registers globally (by serial number) the moment
 * it first contacts the server, before being assigned to any one school.
 */
@Entity({ name: 'biometric_devices' })
@Index(['schoolId'])
@Index(['isApproved'])
export class BiometricDevice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Device serial number — globally unique across all schools. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true })
  sn: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alias: string | null;

  @Column({ type: 'varchar', length: 255, name: 'terminal_name', nullable: true })
  terminalName: string | null;

  /** 'iclock' (ZKTeco) | 'essl'. */
  @Column({ type: 'varchar', length: 20, name: 'device_type', default: 'iclock' })
  deviceType: string;

  @Column({ type: 'varchar', length: 100, name: 'device_model', nullable: true })
  deviceModel: string | null;

  @Column({ type: 'text', name: 'device_config', nullable: true })
  deviceConfig: string | null;

  @Column({
    type: 'varchar',
    length: 10,
    name: 'communication_method',
    default: 'push',
  })
  communicationMethod: string;

  @Column({ type: 'varchar', length: 50, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 50, name: 'fw_ver', nullable: true })
  fwVer: string | null;

  @Column({ type: 'varchar', length: 50, name: 'push_ver', nullable: true })
  pushVer: string | null;

  /** '0' = offline, '1' = online. */
  @Column({ type: 'varchar', length: 20, nullable: true })
  state: string | null;

  /** Terminal timezone offset in minutes. */
  @Column({ type: 'integer', name: 'terminal_tz', nullable: true })
  terminalTz: number | null;

  @Column({ type: 'integer', name: 'user_count', nullable: true })
  userCount: number | null;

  @Column({ type: 'integer', name: 'fp_count', nullable: true })
  fpCount: number | null;

  @Column({ type: 'integer', name: 'face_count', nullable: true })
  faceCount: number | null;

  @Column({ type: 'integer', name: 'palm_count', nullable: true })
  palmCount: number | null;

  @Column({ type: 'integer', name: 'transaction_count', nullable: true })
  transactionCount: number | null;

  /** Last time the device polled for commands (getrequest). */
  @Column({ type: 'varchar', length: 50, name: 'push_time', nullable: true })
  pushTime: string | null;

  @Column({ type: 'varchar', length: 50, name: 'transfer_time', nullable: true })
  transferTime: string | null;

  @Column({ type: 'integer', name: 'transfer_interval', nullable: true })
  transferInterval: number | null;

  @Column({ type: 'integer', name: 'is_attendance', nullable: true })
  isAttendance: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  area: string | null;

  @Column({ type: 'integer', name: 'area_id', nullable: true })
  areaId: number | null;

  /** NULL = unassigned (sitting in the superadmin pool). */
  @Column({ type: 'uuid', name: 'school_id', nullable: true })
  schoolId: string | null;

  @ManyToOne(() => School, { nullable: true })
  @JoinColumn({ name: 'school_id' })
  school: School | null;

  @Column({ type: 'timestamp', name: 'assigned_at', nullable: true })
  assignedAt: Date | null;

  @Column({ type: 'uuid', name: 'assigned_by', nullable: true })
  assignedBy: string | null;

  @Column({ type: 'boolean', name: 'is_approved', default: false })
  isApproved: boolean;

  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'uuid', name: 'deactivated_by', nullable: true })
  deactivatedBy: string | null;

  @Column({ type: 'timestamp', name: 'deactivated_at', nullable: true })
  deactivatedAt: Date | null;

  @Column({ type: 'text', name: 'deactivation_reason', nullable: true })
  deactivationReason: string | null;

  @Column({ type: 'timestamp', name: 'last_sync_at', nullable: true })
  lastSyncAt: Date | null;

  @Column({ type: 'varchar', length: 100, name: 'last_activity', nullable: true })
  lastActivity: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
