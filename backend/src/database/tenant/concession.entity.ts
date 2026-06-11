import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ConcessionType = 'percentage' | 'fixed';

@Entity({ name: 'concessions' })
@Index(['schoolId'])
@Index(['studentId'])
export class Concession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'fee_head_id' })
  feeHeadId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({
    type: 'enum',
    enum: ['percentage', 'fixed'],
    default: 'percentage',
  })
  type: ConcessionType;

  @Column({ type: 'integer' })
  value: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', name: 'approved_by' })
  approvedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
