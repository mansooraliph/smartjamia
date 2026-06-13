import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * An attendance punch received from a biometric device. Lives in the tenant
 * schema; `user_code` (device PIN) is resolved to a student or staff when
 * possible. The unique index prevents the same punch being ingested twice.
 */
@Entity({ name: 'biometric_transactions' })
@Index(['schoolId'])
@Index(['deviceSn'])
@Index(['schoolId', 'punchTime'])
@Index(['studentId', 'punchTime'])
@Index(['staffId', 'punchTime'])
@Index(['deviceSn', 'actualPunchTime', 'userCode'], { unique: true })
export class BiometricTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 100, name: 'device_sn' })
  deviceSn: string;

  /** PIN / employee code as reported by the device. */
  @Column({ type: 'varchar', length: 50, name: 'user_code' })
  userCode: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'uuid', name: 'student_id', nullable: true })
  studentId: string | null;

  @Column({ type: 'uuid', name: 'staff_id', nullable: true })
  staffId: string | null;

  /** Raw time reported by the device. */
  @Column({ type: 'timestamp', name: 'actual_punch_time' })
  actualPunchTime: Date;

  /** Adjusted time (after shift logic); defaults to actual. */
  @Column({ type: 'timestamp', name: 'punch_time' })
  punchTime: Date;

  /** 0 = check-in, 1 = check-out. */
  @Column({ type: 'smallint', name: 'punch_state', default: 0 })
  punchState: number;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'punch_state_display',
    default: 'Check In',
  })
  punchStateDisplay: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  area: string | null;

  @Column({ type: 'integer', name: 'area_id', nullable: true })
  areaId: number | null;

  @Column({ type: 'varchar', length: 100, name: 'terminal_sn', nullable: true })
  terminalSn: string | null;

  @Column({ type: 'timestamp', name: 'upload_time', nullable: true })
  uploadTime: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'Device' })
  source: string;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
