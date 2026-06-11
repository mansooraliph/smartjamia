import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type TcReason =
  | 'transfer'
  | 'completion'
  | 'expulsion'
  | 'withdrawal'
  | 'other';

export type TcConduct = 'excellent' | 'good' | 'satisfactory' | 'poor';

@Entity({ name: 'transfer_certificates' })
@Index(['schoolId'])
export class TransferCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, name: 'tc_number', unique: true })
  tcNumber: string; // TC-2024-000001

  @Column({ type: 'date', name: 'issue_date' })
  issueDate: Date;

  @Column({
    type: 'enum',
    enum: ['transfer', 'completion', 'expulsion', 'withdrawal', 'other'],
  })
  reason: TcReason;

  @Column({ type: 'varchar', length: 50, name: 'last_class' })
  lastClass: string;

  @Column({
    type: 'enum',
    enum: ['excellent', 'good', 'satisfactory', 'poor'],
    default: 'good',
  })
  conduct: TcConduct;

  @Column({ type: 'boolean', name: 'fees_cleared', default: false })
  feesCleared: boolean;

  @Column({ type: 'varchar', length: 500, name: 'pdf_url', nullable: true })
  pdfUrl: string | null;

  @Column({ type: 'uuid', name: 'issued_by' })
  issuedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
