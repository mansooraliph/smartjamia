import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VisitStatus =
  | 'requested'
  | 'approved'
  | 'rejected'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

/**
 * A single visit lifecycle: request → approve/reject → check-in → check-out.
 * A visit is a visitor coming to see a student. Captures both the scheduled
 * (requested) and actual (entry/exit) times so history + time-spent are auditable.
 */
@Entity({ name: 'visits' })
@Index(['schoolId'])
@Index(['schoolId', 'status'])
@Index(['schoolId', 'visitorId'])
@Index(['schoolId', 'studentId'])
@Index(['schoolId', 'scheduledDate'])
export class Visit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'visitor_id' })
  visitorId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string; // the student being visited (denormalized from the visitor)

  // ── Optional specific person to also meet (e.g. class teacher, warden) ───────
  @Column({ type: 'varchar', length: 255, name: 'meeting_with', nullable: true })
  meetingWith: string | null;

  // ── Purpose ─────────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 255 })
  purpose: string; // e.g. Meet ward, Drop belongings, Parent-teacher meeting

  @Column({ type: 'text', nullable: true })
  reason: string | null; // free-text detail

  @Column({ type: 'integer', name: 'party_size', default: 1 })
  partySize: number;

  @Column({ type: 'varchar', length: 30, name: 'vehicle_number', nullable: true })
  vehicleNumber: string | null;

  // ── Request (scheduled) ─────────────────────────────────────────────────────
  @Column({ type: 'date', name: 'scheduled_date' })
  scheduledDate: Date;

  @Column({ type: 'time', name: 'scheduled_time', nullable: true })
  scheduledTime: string | null;

  @Column({
    type: 'enum',
    enum: [
      'requested',
      'approved',
      'rejected',
      'checked_in',
      'checked_out',
      'cancelled',
      'no_show',
    ],
    default: 'requested',
  })
  status: VisitStatus;

  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'timestamp', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', name: 'rejection_reason', nullable: true })
  rejectionReason: string | null;

  // ── Entry / exit (actual) ───────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 50, name: 'pass_number', nullable: true })
  passNumber: string | null;

  @Column({ type: 'timestamp', name: 'check_in_at', nullable: true })
  checkInAt: Date | null;

  @Column({ type: 'timestamp', name: 'check_out_at', nullable: true })
  checkOutAt: Date | null;

  @Column({ type: 'integer', name: 'duration_minutes', nullable: true })
  durationMinutes: number | null; // time spent, computed at check-out

  @Column({ type: 'text', nullable: true })
  belongings: string | null; // items carried in

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'uuid', name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
