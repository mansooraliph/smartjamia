import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BookIssueStatus = 'issued' | 'returned' | 'overdue' | 'lost';

@Entity({ name: 'book_issues' })
@Index(['schoolId'])
@Index(['bookId'])
@Index(['userId'])
export class BookIssue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'date', name: 'issue_date' })
  issueDate: Date;

  @Column({ type: 'date', name: 'due_date' })
  dueDate: Date;

  @Column({ type: 'date', name: 'return_date', nullable: true })
  returnDate: Date | null;

  @Column({ type: 'integer', name: 'fine_amount', default: 0 })
  fineAmount: number;

  @Column({
    type: 'enum',
    enum: ['issued', 'returned', 'overdue', 'lost'],
    default: 'issued',
  })
  status: BookIssueStatus;

  @Column({ type: 'uuid', name: 'issued_by' })
  issuedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
