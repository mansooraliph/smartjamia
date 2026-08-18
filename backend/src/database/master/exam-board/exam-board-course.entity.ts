import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ExamBoardCourseLevel =
  | 'higher_secondary'
  | 'ug'
  | 'pg'
  | 'diploma'
  | 'phd'
  | 'certificate'
  | 'other';

export type ExamBoardTermSystem = 'annual' | 'semester' | 'trimester';

/**
 * Org-owned course catalog for the Examination Board wing. Maintained by the
 * Organization Admin and enabled per-institution via
 * `ExamBoardInstitutionCourse`. Mirrors the shape of the tenant-side `Course`
 * entity, but lives in the master DB since it's shared across the org's
 * colleges (which live in separate tenant schemas with no cross-DB FK).
 */
@Entity({ name: 'exam_board_courses' })
@Index(['organizationId'])
export class ExamBoardCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({
    type: 'enum',
    enum: ['higher_secondary', 'ug', 'pg', 'diploma', 'phd', 'certificate', 'other'],
    default: 'ug',
  })
  level: ExamBoardCourseLevel;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  code: string | null;

  @Column({
    type: 'enum',
    enum: ['annual', 'semester', 'trimester'],
    name: 'term_system',
    default: 'annual',
  })
  termSystem: ExamBoardTermSystem;

  @Column({ type: 'integer', name: 'duration_years', default: 1 })
  durationYears: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
