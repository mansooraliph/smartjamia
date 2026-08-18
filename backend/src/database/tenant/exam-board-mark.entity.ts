import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'exam_board_marks' })
@Index(['schoolId'])
@Index(['studentId', 'examBoardExamSubjectId'], { unique: true })
export class ExamBoardMark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'exam_board_exam_id' })
  examBoardExamId: string;

  @Column({ type: 'uuid', name: 'exam_board_exam_subject_id' })
  examBoardExamSubjectId: string;

  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'marks_obtained',
    default: 0,
  })
  marksObtained: number;

  @Column({ type: 'integer', name: 'max_marks' })
  maxMarks: number;

  /** Continuous Evaluation (internal assessment) marks — only used when the subject defines CE max/pass marks. */
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    name: 'ce_marks_obtained',
    nullable: true,
  })
  ceMarksObtained: number | null;

  @Column({ type: 'boolean', name: 'is_absent', default: false })
  isAbsent: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true })
  grade: string | null;

  @Column({ type: 'uuid', name: 'entered_by' })
  enteredBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
