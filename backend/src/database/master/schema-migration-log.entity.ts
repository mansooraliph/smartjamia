import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type SchemaMigrationStatus = 'success' | 'failed';

@Entity({ name: 'schema_migration_logs' })
@Index('uq_schema_migration', ['schemaName', 'migrationName'], { unique: true })
export class SchemaMigrationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, name: 'schema_name' })
  schemaName: string;

  @Column({ type: 'varchar', length: 255, name: 'migration_name' })
  migrationName: string;

  @Column({
    type: 'enum',
    enum: ['success', 'failed'],
    default: 'success',
  })
  status: SchemaMigrationStatus;

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'executed_at' })
  executedAt: Date;
}
