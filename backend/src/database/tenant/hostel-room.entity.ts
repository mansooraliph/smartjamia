import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type HostelRoomType = 'single' | 'double' | 'dormitory';
export type HostelRoomStatus = 'available' | 'full' | 'maintenance';

@Entity({ name: 'hostel_rooms' })
@Index(['schoolId'])
export class HostelRoom {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 20, name: 'room_number' })
  roomNumber: string;

  @Column({ type: 'integer' })
  floor: number;

  @Column({ type: 'integer' })
  capacity: number;

  @Column({
    type: 'enum',
    enum: ['single', 'double', 'dormitory'],
  })
  type: HostelRoomType;

  // paise
  @Column({ type: 'integer', name: 'monthly_fee', default: 0 })
  monthlyFee: number;

  @Column({
    type: 'enum',
    enum: ['available', 'full', 'maintenance'],
    default: 'available',
  })
  status: HostelRoomStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
