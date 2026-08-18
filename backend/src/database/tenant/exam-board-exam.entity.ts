import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExamBoardExamType =
  | 'unit_test'
  | 'mid_term'
  | 'final'
  | 'quarterly'
  | 'half_yearly';

export type ExamBoardExamStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed';

/**
 * An exam scheduled and conducted by the Examination Board, scoped to one
 * batch (rather than a local class/section) — students enrolled in the batch
 * via `ExamBoardEnrollment` are the ones who sit it.
 */
@Entity({ name: 'exam_board_exams' })
@Index(['schoolId'])
@Index(['examBoardBatchId'])
export class ExamBoardExam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'exam_board_batch_id' })
  examBoardBatchId: string;

  @Column({ type: 'integer', name: 'term_number' })
  termNumber: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['unit_test', 'mid_term', 'final', 'quarterly', 'half_yearly'],
    name: 'exam_type',
  })
  examType: ExamBoardExamType;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: ['draft', 'scheduled', 'ongoing', 'completed'],
    default: 'draft',
  })
  status: ExamBoardExamStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
