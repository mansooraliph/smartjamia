import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * One subject/paper within an Exam Board exam. Subject is a free-text label
 * rather than an FK — batches aren't tied to a single local class, so there's
 * no local `subjects` row to point at.
 */
@Entity({ name: 'exam_board_exam_subjects' })
@Index(['examBoardExamId'])
export class ExamBoardExamSubject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'exam_board_exam_id' })
  examBoardExamId: string;

  @Column({ type: 'varchar', length: 100, name: 'subject_name' })
  subjectName: string;

  @Column({ type: 'date', nullable: true })
  date: Date | null;

  @Column({ type: 'time', nullable: true })
  time: string | null;

  @Column({ type: 'integer', name: 'max_marks' })
  maxMarks: number;

  @Column({ type: 'integer', name: 'pass_marks' })
  passMarks: number;

  /** Continuous Evaluation (internal assessment) component — separate from the exam marks above. */
  @Column({ type: 'integer', name: 'ce_max_marks', nullable: true })
  ceMaxMarks: number | null;

  @Column({ type: 'integer', name: 'ce_pass_marks', nullable: true })
  cePassMarks: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
