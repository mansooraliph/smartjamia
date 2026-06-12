import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StudentDocumentType =
  | 'aadhaar'
  | 'birth_certificate'
  | 'transfer_certificate'
  | 'marksheet'
  | 'id_proof'
  | 'address_proof'
  | 'caste_certificate'
  | 'income_certificate'
  | 'photo'
  | 'other';

/** An uploaded proof/document attached to a student (Aadhaar, TC, marksheet…). */
@Entity({ name: 'student_documents' })
@Index(['schoolId'])
@Index(['studentId'])
export class StudentDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Column({
    type: 'enum',
    enum: [
      'aadhaar',
      'birth_certificate',
      'transfer_certificate',
      'marksheet',
      'id_proof',
      'address_proof',
      'caste_certificate',
      'income_certificate',
      'photo',
      'other',
    ],
    default: 'other',
  })
  type: StudentDocumentType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 500, name: 'file_url' })
  fileUrl: string;

  @Column({ type: 'varchar', length: 255, name: 'file_name', nullable: true })
  fileName: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
