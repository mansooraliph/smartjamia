import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type StaffDocumentType =
  | 'aadhaar'
  | 'pan'
  | 'id_proof'
  | 'address_proof'
  | 'resume'
  | 'certificate'
  | 'qualification'
  | 'experience'
  | 'contract'
  | 'photo'
  | 'other';

/** An uploaded document attached to a staff member (ID, certificate, contract…). */
@Entity({ name: 'staff_documents' })
@Index(['schoolId'])
@Index(['staffId'])
export class StaffDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'staff_id' })
  staffId: string;

  @Column({
    type: 'enum',
    enum: [
      'aadhaar',
      'pan',
      'id_proof',
      'address_proof',
      'resume',
      'certificate',
      'qualification',
      'experience',
      'contract',
      'photo',
      'other',
    ],
    default: 'other',
  })
  type: StaffDocumentType;

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
