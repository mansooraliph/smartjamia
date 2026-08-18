import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Curriculum assignment: makes a subject part of a scheme's syllabus for one
 * term (Year/Semester/Trimester N). Every batch that adopts the scheme
 * inherits this list — defined once here instead of duplicated per batch.
 */
@Entity({ name: 'exam_board_scheme_term_subjects' })
@Index(['examBoardSchemeId'])
@Index(['examBoardSchemeId', 'termNumber'])
@Index(['examBoardSchemeId', 'termNumber', 'examBoardSubjectId'], {
  unique: true,
})
export class ExamBoardSchemeTermSubject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'exam_board_scheme_id' })
  examBoardSchemeId: string;

  @Column({ type: 'integer', name: 'term_number' })
  termNumber: number;

  @Column({ type: 'uuid', name: 'exam_board_subject_id' })
  examBoardSubjectId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
