import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'subjects' })
@Index(['schoolId'])
@Index(['classId'])
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId: string;

  @Column({ type: 'boolean', name: 'is_optional', default: false })
  isOptional: boolean;

  @Column({ type: 'integer', name: 'max_marks', default: 100 })
  maxMarks: number;

  @Column({ type: 'integer', name: 'pass_marks', default: 35 })
  passMarks: number;

  /** Continuous Evaluation (internal assessment) component — separate from the exam marks above. */
  @Column({ type: 'integer', name: 'ce_max_marks', nullable: true })
  ceMaxMarks: number | null;

  @Column({ type: 'integer', name: 'ce_pass_marks', nullable: true })
  cePassMarks: number | null;

  /**
   * Set when this row is mirrored from the org's Examination Board master
   * (see ExamBoardService.syncInstitutionMirror) instead of being created
   * manually. Blocks manual edit/delete in the tenant UI while set.
   */
  @Column({ type: 'uuid', name: 'exam_board_subject_id', nullable: true })
  examBoardSubjectId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
