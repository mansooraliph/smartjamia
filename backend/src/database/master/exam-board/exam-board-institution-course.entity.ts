import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Enable-link: makes an `ExamBoardCourse` available to one institution
 * (college) under the org. Presence of a row = enabled for that school.
 */
@Entity({ name: 'exam_board_institution_courses' })
@Index(['organizationId'])
@Index(['schoolId'])
@Index(['schoolId', 'examBoardCourseId'], { unique: true })
export class ExamBoardInstitutionCourse {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'exam_board_course_id' })
  examBoardCourseId: string;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
