import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type LeaveType =
  | 'casual'
  | 'sick'
  | 'earned'
  | 'unpaid'
  | 'maternity'
  | 'other';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

@Entity({ name: 'leaves' })
@Index(['schoolId'])
@Index(['userId'])
export class Leave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ['casual', 'sick', 'earned', 'unpaid', 'maternity', 'other'],
    name: 'leave_type',
  })
  leaveType: LeaveType;

  @Column({ type: 'date', name: 'from_date' })
  fromDate: Date;

  @Column({ type: 'date', name: 'to_date' })
  toDate: Date;

  @Column({ type: 'integer' })
  days: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  status: LeaveStatus;

  @Column({ type: 'uuid', name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
