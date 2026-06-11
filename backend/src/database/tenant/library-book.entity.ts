import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'library_books' })
@Index(['schoolId'])
export class LibraryBook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'school_id' })
  schoolId: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  isbn: string | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255 })
  author: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  publisher: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  edition: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'integer', name: 'total_copies', default: 1 })
  totalCopies: number;

  @Column({ type: 'integer', name: 'available_copies', default: 1 })
  availableCopies: number;

  @Column({
    type: 'varchar',
    length: 20,
    name: 'rack_number',
    nullable: true,
  })
  rackNumber: string | null;

  @Index({ unique: true })
  @Column({
    type: 'varchar',
    length: 50,
    unique: true,
    nullable: true,
  })
  barcode: string | null;

  @Column({ type: 'varchar', length: 500, name: 'cover_url', nullable: true })
  coverUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
