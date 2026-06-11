import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type EnrollmentStatus =
  | 'active'
  | 'transferred'
  | 'promoted'
  | 'detained';

@Entity({ name: 'student_enrollments' })
@Index(['schoolId'])
@Index(['studentId'])
@Index(['academicYearId'])
@Index(['sectionId'])
export class StudentEnrollment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId: string;

  @Column({ type: 'uuid', name: 'section_id' })
  sectionId: string;

  @Column({ type: 'varchar', length: 20, name: 'roll_number', nullable: true })
  rollNumber: string | null;

  @Column({ type: 'date', name: 'enrollment_date' })
  enrollmentDate: Date;

  @Column({
    type: 'enum',
    enum: ['active', 'transferred', 'promoted', 'detained'],
    default: 'active',
  })
  status: EnrollmentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
