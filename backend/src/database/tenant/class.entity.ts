import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'classes' })
@Index(['schoolId'])
@Index(['academicYearId'])
export class ClassEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'academic_year_id' })
  academicYearId: string;

  /** Parent course/program (college mode). NULL for schools. */
  @Column({ type: 'uuid', name: 'course_id', nullable: true })
  courseId: string | null;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'integer', name: 'order_index', default: 0 })
  orderIndex: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
