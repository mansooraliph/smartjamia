import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CourseLevel =
  | 'ug'
  | 'pg'
  | 'diploma'
  | 'phd'
  | 'certificate'
  | 'other';

export type TermSystem = 'annual' | 'semester' | 'trimester';

/**
 * College program/course — the optional parent of classes (e.g. "B.Sc Computer
 * Science"). Schools don't use this (classes keep course_id NULL). Grouped by
 * `level` (UG/PG/…) in the UI.
 */
@Entity({ name: 'courses' })
@Index(['schoolId'])
@Index(['academicYearId'])
export class Course {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({
    type: 'enum',
    enum: ['ug', 'pg', 'diploma', 'phd', 'certificate', 'other'],
    default: 'ug',
  })
  level: CourseLevel;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  code: string | null;

  /** How the course is divided per year — drives auto-generated classes. */
  @Column({
    type: 'enum',
    enum: ['annual', 'semester', 'trimester'],
    name: 'term_system',
    default: 'annual',
  })
  termSystem: TermSystem;

  /** Programme length in years (e.g. 3 → 3 Years / 6 Semesters / 9 Trimesters). */
  @Column({ type: 'integer', name: 'duration_years', default: 1 })
  durationYears: number;

  @Column({ type: 'integer', name: 'order_index', default: 0 })
  orderIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
