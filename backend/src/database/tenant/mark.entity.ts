import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'marks' })
@Index(['schoolId'])
@Index(['studentId', 'examId', 'subjectId'], { unique: true })
export class Mark {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'exam_id' })
  examId: string;

  @Column({ type: 'uuid', name: 'subject_id' })
  subjectId: string;

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

  @Column({ type: 'boolean', name: 'is_absent', default: false })
  isAbsent: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true })
  grade: string | null;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'uuid', name: 'entered_by' })
  enteredBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
