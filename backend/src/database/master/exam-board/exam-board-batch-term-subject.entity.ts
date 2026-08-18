import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Curriculum assignment: makes a subject part of a batch's syllabus for one
 * term (Year/Semester/Trimester N). This — not the scheme — is what actually
 * drives which subjects exams get scheduled against for that batch/term.
 */
@Entity({ name: 'exam_board_batch_term_subjects' })
@Index(['examBoardBatchId'])
@Index(['examBoardBatchId', 'termNumber'])
@Index(['examBoardBatchId', 'termNumber', 'examBoardSubjectId'], {
  unique: true,
})
export class ExamBoardBatchTermSubject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'exam_board_batch_id' })
  examBoardBatchId: string;

  @Column({ type: 'integer', name: 'term_number' })
  termNumber: number;

  @Column({ type: 'uuid', name: 'exam_board_subject_id' })
  examBoardSubjectId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
