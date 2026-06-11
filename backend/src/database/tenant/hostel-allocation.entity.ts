import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HostelAllocationStatus = 'active' | 'vacated';

@Entity({ name: 'hostel_allocations' })
@Index(['schoolId'])
@Index(['roomId'])
@Index(['studentId'])
export class HostelAllocation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'room_id' })
  roomId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'date', name: 'from_date' })
  fromDate: Date;

  @Column({ type: 'date', name: 'to_date', nullable: true })
  toDate: Date | null;

  @Column({
    type: 'enum',
    enum: ['active', 'vacated'],
    default: 'active',
  })
  status: HostelAllocationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
