import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExamBoardBatchStatus = 'active' | 'closed';

/**
 * A batch of an `ExamBoardCourse`, run by one institution (college) for one
 * `ExamBoardAcademicYear`. Teachers at the college enroll their students into
 * a batch from the tenant-side Students module; exams are scheduled and
 * conducted per batch.
 */
@Entity({ name: 'exam_board_batches' })
@Index(['organizationId'])
@Index(['schoolId'])
@Index(['examBoardCourseId'])
@Index(['examBoardAcademicYearId'])
export class ExamBoardBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'exam_board_course_id' })
  examBoardCourseId: string;

  @Column({ type: 'uuid', name: 'exam_board_academic_year_id' })
  examBoardAcademicYearId: string;

  @Column({ type: 'uuid', name: 'exam_board_scheme_id', nullable: true })
  examBoardSchemeId: string | null;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  code: string | null;

  @Column({ type: 'integer', nullable: true })
  capacity: number | null;

  /** The Year/Semester/Trimester this batch is currently running. Drives the
   *  default term when scheduling a new exam for this batch. */
  @Column({ type: 'integer', name: 'current_term_number', default: 1 })
  currentTermNumber: number;

  @Column({
    type: 'enum',
    enum: ['active', 'closed'],
    default: 'active',
  })
  status: ExamBoardBatchStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
