import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

@Entity({ name: 'timetables' })
@Index(['schoolId'])
@Index(['sectionId'])
@Index(['staffId'])
export class Timetable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'section_id' })
  sectionId: string;

  @Column({ type: 'uuid', name: 'subject_id' })
  subjectId: string;

  @Column({ type: 'uuid', name: 'staff_id', nullable: true })
  staffId: string | null;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  @Column({
    type: 'enum',
    enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
    name: 'day_of_week',
  })
  dayOfWeek: DayOfWeek;

  @Column({ type: 'integer', name: 'period_number' })
  periodNumber: number;

  @Column({ type: 'time', name: 'start_time' })
  startTime: string;

  @Column({ type: 'time', name: 'end_time' })
  endTime: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
