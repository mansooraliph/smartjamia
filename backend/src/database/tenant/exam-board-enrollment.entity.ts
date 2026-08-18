import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExamBoardEnrollmentStatus = 'active' | 'withdrawn';

/**
 * Links a local student to an Examination Board batch (batches live in the
 * master DB, owned by the org — no cross-DB FK is possible, so
 * `examBoardBatchId` is stored as a plain UUID and resolved via the org's
 * exam-board API). Created when a teacher bulk-enrolls students from the
 * Students module into a batch.
 */
@Entity({ name: 'exam_board_enrollments' })
@Index(['schoolId'])
@Index(['studentId'])
@Index(['examBoardBatchId'])
@Index(['studentId', 'examBoardBatchId'], { unique: true })
export class ExamBoardEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'exam_board_batch_id' })
  examBoardBatchId: string;

  @Column({ type: 'uuid', name: 'enrolled_by' })
  enrolledBy: string;

  @Column({ type: 'date', name: 'enrollment_date' })
  enrollmentDate: Date;

  @Column({
    type: 'enum',
    enum: ['active', 'withdrawn'],
    default: 'active',
  })
  status: ExamBoardEnrollmentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
