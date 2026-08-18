import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * A curriculum regulation/scheme under a course (e.g. "2026 Scheme" for
 * B.Sc Computer Science). Selected once per batch — the batch's subject
 * assignment (see ExamBoardBatchTermSubject) is what actually drives the
 * curriculum content, the scheme is the regulatory label for it.
 */
@Entity({ name: 'exam_board_schemes' })
@Index(['organizationId'])
@Index(['examBoardCourseId'])
export class ExamBoardScheme {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'uuid', name: 'exam_board_course_id' })
  examBoardCourseId: string;

  /** Academic year this scheme/regulation first takes effect from. */
  @Column({ type: 'uuid', name: 'starting_academic_year_id', nullable: true })
  startingAcademicYearId: string | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  code: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
