import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'holiday'
  | 'half_day';

@Entity({ name: 'attendance' })
@Index(['schoolId'])
@Index(['studentId', 'date'], { unique: true })
@Index(['sectionId', 'date'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({ type: 'uuid', name: 'section_id' })
  sectionId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({
    type: 'enum',
    enum: ['present', 'absent', 'late', 'holiday', 'half_day'],
  })
  status: AttendanceStatus;

  @Column({ type: 'uuid', name: 'marked_by' })
  markedBy: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
