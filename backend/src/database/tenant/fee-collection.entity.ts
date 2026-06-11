import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FeeCollectionStatus =
  | 'pending'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'waived';

@Entity({ name: 'fee_collections' })
@Index(['schoolId'])
@Index(['studentId'])
@Index(['academicYearId'])
@Index(['status'])
export class FeeCollection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'uuid', name: 'fee_head_id' })
  feeHeadId: string;

  @Column({ type: 'integer', name: 'amount_due', default: 0 })
  amountDue: number;

  @Column({ type: 'integer', name: 'amount_paid', default: 0 })
  amountPaid: number;

  @Column({ type: 'integer', name: 'amount_waived', default: 0 })
  amountWaived: number;

  @Column({ type: 'date', name: 'due_date' })
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: ['pending', 'partial', 'paid', 'overdue', 'waived'],
    default: 'pending',
  })
  status: FeeCollectionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
