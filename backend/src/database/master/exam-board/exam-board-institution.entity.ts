import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Marks a school as participating in the org's Examination Board wing (the
 * "copy institution from the Organizations level" action). Only institutions
 * with a row here (isEnabled=true) get per-course/per-academic-year
 * enablement and have their local Academic Year/Course lists mirrored from
 * the org master (see ExamBoardService.syncInstitutionMirror).
 */
@Entity({ name: 'exam_board_institutions' })
@Index(['organizationId'])
@Index(['schoolId'], { unique: true })
export class ExamBoardInstitution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'organization_id' })
  organizationId: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'boolean', name: 'is_enabled', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
