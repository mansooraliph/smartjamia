import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Prior academic record of a student — e.g. 10th/SSLC, Higher Secondary,
 * Diploma, Degree. Mostly used in college mode to capture the education
 * history that admissions require.
 */
@Entity({ name: 'student_qualifications' })
@Index(['schoolId'])
@Index(['studentId'])
export class StudentQualification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  /** e.g. "10th / SSLC", "Higher Secondary", "Diploma", "Bachelor's Degree". */
  @Column({ type: 'varchar', length: 150 })
  examName: string;

  /** Board or university — e.g. "CBSE", "State Board", "Calicut University". */
  @Column({ type: 'varchar', length: 200, name: 'board', nullable: true })
  board: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  institution: string | null;

  @Column({ type: 'integer', name: 'year_of_passing', nullable: true })
  yearOfPassing: number | null;

  /** Percentage / CGPA kept as text to allow "8.4 CGPA", "78%", etc. */
  @Column({ type: 'varchar', length: 30, nullable: true })
  percentage: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  grade: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    name: 'register_number',
    nullable: true,
  })
  registerNumber: string | null;

  /** Optional scanned certificate / marksheet. */
  @Column({ type: 'varchar', length: 500, name: 'file_url', nullable: true })
  fileUrl: string | null;

  @Column({ type: 'integer', name: 'order_index', default: 0 })
  orderIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
