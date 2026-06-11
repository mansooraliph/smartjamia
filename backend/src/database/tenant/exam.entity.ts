import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExamType =
  | 'unit_test'
  | 'mid_term'
  | 'final'
  | 'quarterly'
  | 'half_yearly';

export type ExamStatus = 'draft' | 'scheduled' | 'ongoing' | 'completed';

@Entity({ name: 'exams' })
@Index(['schoolId'])
@Index(['academicYearId'])
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['unit_test', 'mid_term', 'final', 'quarterly', 'half_yearly'],
    name: 'exam_type',
  })
  examType: ExamType;

  @Column({ type: 'uuid', name: 'class_id' })
  classId: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;

  @Column({
    type: 'enum',
    enum: ['draft', 'scheduled', 'ongoing', 'completed'],
    default: 'draft',
  })
  status: ExamStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
