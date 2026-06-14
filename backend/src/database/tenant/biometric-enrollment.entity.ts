import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A biometric template (fingerprint / face / palm / photo) received from a
 * device. Lives in the tenant schema. Unique per (school, user, type, index)
 * so a given finger/slot stores one template, refreshed on re-enrollment.
 */
@Entity({ name: 'biometric_enrollments' })
@Index(['schoolId'])
@Index(['schoolId', 'userCode', 'type'])
@Index(['schoolId', 'userCode', 'type', 'index'], { unique: true })
export class BiometricEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 50, name: 'user_code' })
  userCode: string;

  @Column({ type: 'uuid', name: 'student_id', nullable: true })
  studentId: string | null;

  @Column({ type: 'uuid', name: 'staff_id', nullable: true })
  staffId: string | null;

  @Column({ type: 'uuid', name: 'visitor_id', nullable: true })
  visitorId: string | null;

  /** 'student' | 'teacher' | 'staff' | 'visitor' — set on admin enrollment. */
  @Column({ type: 'varchar', length: 20, name: 'user_type', nullable: true })
  userType: string | null;

  /** Display name captured at enrollment time. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string | null;

  /** 'pending' (admin queued) | 'enrolled' (template received). */
  @Column({ type: 'varchar', length: 20, nullable: true })
  status: string | null;

  @Column({ type: 'varchar', length: 100, name: 'device_sn', nullable: true })
  deviceSn: string | null;

  /** 'FP' | 'FACE' | 'PALM' | 'USERPIC' | 'BIOPHOTO'. */
  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'varchar', length: 50, name: 'f_id', nullable: true })
  fId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'face_id', nullable: true })
  faceId: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  size: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  valid: string | null;

  /** Biometric template payload. */
  @Column({ type: 'text', nullable: true })
  tmp: string | null;

  /** Image data / filename. */
  @Column({ type: 'text', nullable: true })
  image: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  no: string | null;

  /** Finger / slot index. Default '0' so the unique index has a stable value. */
  @Column({ type: 'varchar', length: 50, default: '0' })
  index: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  duress: string | null;

  /** Raw "Type" field from the device record. */
  @Column({ type: 'varchar', length: 10, name: 'type_', nullable: true })
  typeRaw: string | null;

  @Column({ type: 'varchar', length: 10, name: 'major_ver', nullable: true })
  majorVer: string | null;

  @Column({ type: 'varchar', length: 10, name: 'minor_ver', nullable: true })
  minorVer: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  format: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
