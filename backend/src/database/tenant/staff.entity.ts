import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StaffStatus =
  | 'active'
  | 'on_leave'
  | 'resigned'
  | 'terminated';

@Entity({ name: 'staff' })
@Index(['schoolId'])
@Index(['schoolId', 'employeeId'], { unique: true })
export class Staff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50, name: 'employee_id' })
  employeeId: string;

  @Column({ type: 'varchar', length: 100 })
  designation: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  department: string | null;

  @Column({ type: 'text', nullable: true })
  qualification: string | null;

  @Column({ type: 'date', name: 'joining_date' })
  joiningDate: Date;

  // paise per month
  @Column({ type: 'integer', default: 0 })
  salary: number;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'bank_account',
    nullable: true,
  })
  bankAccount: string | null;

  @Column({ type: 'varchar', length: 20, name: 'bank_ifsc', nullable: true })
  bankIfsc: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pan: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  aadhar: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 500, name: 'photo_url', nullable: true })
  photoUrl: string | null;

  @Column({
    type: 'enum',
    enum: ['active', 'on_leave', 'resigned', 'terminated'],
    default: 'active',
  })
  status: StaffStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
