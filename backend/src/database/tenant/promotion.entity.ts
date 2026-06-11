import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PromotionStatus = 'promoted' | 'detained' | 'transferred';

@Entity({ name: 'promotions' })
@Index(['schoolId'])
@Index(['studentId'])
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'from_academic_year_id' })
  fromAcademicYearId: string;

  @Column({ type: 'uuid', name: 'to_academic_year_id' })
  toAcademicYearId: string;

  @Column({ type: 'uuid', name: 'from_class_id' })
  fromClassId: string;

  @Column({ type: 'uuid', name: 'to_class_id', nullable: true })
  toClassId: string | null;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'enrollment_id' })
  enrollmentId: string;

  @Column({
    type: 'enum',
    enum: ['promoted', 'detained', 'transferred'],
  })
  status: PromotionStatus;

  @Column({ type: 'text', nullable: true })
  remarks: string | null;

  @Column({ type: 'uuid', name: 'promoted_by' })
  promotedBy: string;

  @Column({ type: 'timestamp', name: 'promoted_at' })
  promotedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
