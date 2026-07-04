import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type Gender = 'male' | 'female' | 'other';
export type StudentStatus = 'active' | 'inactive' | 'transferred' | 'alumni';

@Entity({ name: 'students' })
@Index(['schoolId'])
@Index(['schoolId', 'admissionNumber'], { unique: true })
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 50, name: 'admission_number' })
  admissionNumber: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 100, name: 'student_name' })
  studentName: string;

  @Column({ type: 'date', name: 'date_of_birth' })
  dateOfBirth: Date;

  @Column({
    type: 'enum',
    enum: ['male', 'female', 'other'],
  })
  gender: Gender;

  @Column({ type: 'varchar', length: 5, name: 'blood_group', nullable: true })
  bloodGroup: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  religion: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  caste: string | null;

  @Column({ type: 'varchar', length: 12, name: 'aadhar_number', nullable: true })
  aadharNumber: string | null;

  @Column({ type: 'varchar', length: 500, name: 'photo_url', nullable: true })
  photoUrl: string | null;

  @Column({
    type: 'varchar',
    length: 8,
    name: 'mobile_country_code',
    nullable: true,
  })
  mobileCountryCode: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({
    type: 'varchar',
    length: 8,
    name: 'whatsapp_country_code',
    nullable: true,
  })
  whatsappCountryCode: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  whatsapp: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 255, name: 'previous_school', nullable: true })
  previousSchool: string | null;

  @Column({ type: 'date', name: 'admission_date' })
  admissionDate: Date;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'transferred', 'alumni'],
    default: 'active',
  })
  status: StudentStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
