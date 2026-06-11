import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'sections' })
@Index(['schoolId'])
@Index(['classId'])
export class Section {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'class_id' })
  classId: string;

  @Column({ type: 'varchar', length: 10 })
  name: string;

  @Column({ type: 'integer', default: 40 })
  capacity: number;

  @Column({ type: 'uuid', name: 'class_teacher_id', nullable: true })
  classTeacherId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
