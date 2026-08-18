import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'academic_years' })
@Index(['schoolId'])
export class AcademicYear {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'date', name: 'start_date' })
  startDate: Date;

  @Column({ type: 'date', name: 'end_date' })
  endDate: Date;

  @Column({ type: 'boolean', name: 'is_current', default: false })
  isCurrent: boolean;

  @Column({ type: 'boolean', name: 'is_locked', default: false })
  isLocked: boolean;

  /**
   * Set when this row is mirrored from the org's Examination Board master
   * (see ExamBoardService.syncInstitutionMirror) instead of being created
   * manually. Blocks manual edit/delete in the tenant UI while set.
   */
  @Column({
    type: 'uuid',
    name: 'exam_board_academic_year_id',
    nullable: true,
  })
  examBoardAcademicYearId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
