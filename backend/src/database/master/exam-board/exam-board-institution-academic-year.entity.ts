import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Enable-link: makes an `ExamBoardAcademicYear` available to one institution
 * (college) under the org. Presence of a row = enabled for that school.
 */
@Entity({ name: 'exam_board_institution_academic_years' })
@Index(['organizationId'])
@Index(['schoolId'])
@Index(['schoolId', 'examBoardAcademicYearId'], { unique: true })
export class ExamBoardInstitutionAcademicYear {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'exam_board_academic_year_id' })
  examBoardAcademicYearId: string;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
