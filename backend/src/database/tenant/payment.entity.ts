import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type PaymentMode =
  | 'cash'
  | 'upi'
  | 'card'
  | 'netbanking'
  | 'cheque'
  | 'dd'
  | 'online';

export type PaymentStatus = 'pending' | 'success' | 'failed' | 'refunded';

@Entity({ name: 'payments' })
@Index(['schoolId'])
@Index(['studentId'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'student_id' })
  studentId: string;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 50,
    name: 'receipt_number',
    unique: true,
  })
  receiptNumber: string; // REC-2024-000001

  @Column({ type: 'integer', name: 'total_amount' })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: ['cash', 'upi', 'card', 'netbanking', 'cheque', 'dd', 'online'],
    name: 'payment_mode',
  })
  paymentMode: PaymentMode;

  @Column({ type: 'date', name: 'payment_date' })
  paymentDate: Date;

  @Column({ type: 'uuid', name: 'collected_by' })
  collectedBy: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'gateway_order_id',
    nullable: true,
  })
  gatewayOrderId: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'gateway_payment_id',
    nullable: true,
  })
  gatewayPaymentId: string | null;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'gateway_signature',
    nullable: true,
  })
  gatewaySignature: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending',
  })
  status: PaymentStatus;

  @Column({
    type: 'varchar',
    length: 500,
    name: 'receipt_pdf_url',
    nullable: true,
  })
  receiptPdfUrl: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
