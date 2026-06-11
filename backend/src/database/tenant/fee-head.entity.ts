import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type FeeHeadType =
  | 'tuition'
  | 'transport'
  | 'hostel'
  | 'library'
  | 'lab'
  | 'other';

@Entity({ name: 'fee_heads' })
@Index(['schoolId'])
export class FeeHead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ['tuition', 'transport', 'hostel', 'library', 'lab', 'other'],
    default: 'other',
  })
  type: FeeHeadType;

  @Column({ type: 'boolean', name: 'is_recurring', default: true })
  isRecurring: boolean;

  @Column({ type: 'boolean', name: 'is_optional', default: false })
  isOptional: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
