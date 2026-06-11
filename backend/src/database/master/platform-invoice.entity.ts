import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { School } from './school.entity';
import { Subscription } from './subscription.entity';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'failed' | 'void';

@Entity({ name: 'platform_invoices' })
@Index(['schoolId'])
export class PlatformInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @ManyToOne(() => School, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_id' })
  school: School;

  @Column({ type: 'uuid', name: 'subscription_id' })
  subscriptionId: string;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Subscription;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 50,
    name: 'invoice_number',
    unique: true,
  })
  invoiceNumber: string; // EDU-INV-000001

  @Column({ type: 'integer', default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'INR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: ['draft', 'sent', 'paid', 'failed', 'void'],
    default: 'draft',
  })
  status: InvoiceStatus;

  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'timestamp', name: 'paid_at', nullable: true })
  paidAt: Date | null;

  @Column({
    type: 'varchar',
    length: 50,
    name: 'payment_gateway',
    nullable: true,
  })
  paymentGateway: string | null;

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
    name: 'invoice_pdf_url',
    nullable: true,
  })
  invoicePdfUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
