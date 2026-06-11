import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FeeFrequency =
  | 'monthly'
  | 'quarterly'
  | 'half_yearly'
  | 'yearly'
  | 'one_time';

@Entity({ name: 'fee_structures' })
@Index(['schoolId'])
@Index(['academicYearId'])
@Index(['classId'])
export class FeeStructure {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId: string;

  @Column({ type: 'uuid', name: 'fee_head_id' })
  feeHeadId: string;

  // paise
  @Column({ type: 'integer', default: 0 })
  amount: number;

  @Column({
    type: 'enum',
    enum: ['monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time'],
    default: 'monthly',
  })
  frequency: FeeFrequency;

  @Column({ type: 'integer', name: 'due_day', default: 5 })
  dueDay: number;

  @Column({ type: 'integer', name: 'late_fee_per_day', default: 0 })
  lateFeePerDay: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
