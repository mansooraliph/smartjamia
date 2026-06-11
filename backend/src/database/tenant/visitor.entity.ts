import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type VisitorGender = 'male' | 'female' | 'other';

/**
 * A registered visitor, always associated with the student they come to visit
 * (e.g. a parent/guardian/relative of that student).
 */
@Entity({ name: 'visitors' })
@Index(['schoolId'])
@Index(['schoolId', 'studentId'])
@Index(['schoolId', 'mobile'])
export class Visitor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string; // the student this visitor visits

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  relation: string | null; // relation to the student e.g. Father, Mother, Guardian, Uncle

  @Column({
    type: 'enum',
    enum: ['male', 'female', 'other'],
    nullable: true,
  })
  gender: VisitorGender | null;

  @Column({ type: 'varchar', length: 20 })
  mobile: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  place: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 50, name: 'id_proof_type', nullable: true })
  idProofType: string | null; // Aadhar, Driving License, Passport…

  @Column({
    type: 'varchar',
    length: 100,
    name: 'id_proof_number',
    nullable: true,
  })
  idProofNumber: string | null;

  @Column({ type: 'varchar', length: 500, name: 'photo_url', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', name: 'is_blacklisted', default: false })
  isBlacklisted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
