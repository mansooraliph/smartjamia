import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'report_cards' })
@Index(['schoolId'])
@Index(['studentId'])
@Index(['examId'])
export class ReportCard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'uuid', name: 'exam_id' })
  examId: string;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    name: 'total_marks',
    default: 0,
  })
  totalMarks: number;

  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    name: 'max_total_marks',
    default: 0,
  })
  maxTotalMarks: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  percentage: number;

  @Column({ type: 'varchar', length: 5, nullable: true })
  grade: string | null;

  @Column({ type: 'integer', nullable: true })
  rank: number | null;

  @Column({ type: 'boolean', name: 'is_passed', default: false })
  isPassed: boolean;

  @Column({ type: 'varchar', length: 500, name: 'pdf_url', nullable: true })
  pdfUrl: string | null;

  @Column({ type: 'timestamp', name: 'generated_at', nullable: true })
  generatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
