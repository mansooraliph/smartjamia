import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Org-owned subject catalog for a course, scoped to one term (Year/Semester/
 * Trimester N within the course's structure). Assigned into individual
 * batches per term via ExamBoardBatchTermSubject.
 */
@Entity({ name: 'exam_board_subjects' })
@Index(['organizationId'])
@Index(['examBoardCourseId'])
@Index(['examBoardCourseId', 'termNumber'])
export class ExamBoardSubject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'uuid', name: 'exam_board_course_id' })
  examBoardCourseId: string;

  /** Year/Semester/Trimester number within the course (1-based). */
  @Column({ type: 'integer', name: 'term_number' })
  termNumber: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 150, name: 'name_arabic', nullable: true })
  nameArabic: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  code: string | null;

  @Column({ type: 'integer', name: 'max_marks', default: 100 })
  maxMarks: number;

  @Column({ type: 'integer', name: 'pass_marks', default: 35 })
  passMarks: number;

  /** Continuous Evaluation (internal assessment) component — separate from the exam marks above. */
  @Column({ type: 'integer', name: 'ce_max_marks', nullable: true })
  ceMaxMarks: number | null;

  @Column({ type: 'integer', name: 'ce_pass_marks', nullable: true })
  cePassMarks: number | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
