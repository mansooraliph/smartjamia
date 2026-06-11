import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SchemaMigrationLog } from '../../database/master/schema-migration-log.entity';
import { TENANT_ENTITIES } from '../../database/data-datasource';
import { TenantSchemaService } from './tenant-schema.service';

/**
 * Responsible for provisioning new tenant schemas and applying
 * tenant migrations to them.
 *
 * Two modes supported:
 *   - `provisionSchema(schemaName)`  → CREATE SCHEMA + materialize TypeORM tables
 *   - `replaySchemaMigrations(schemaName)` → re-run the recorded migrations
 */
@Injectable()
export class SchemaMigrationService {
  private readonly logger = new Logger(SchemaMigrationService.name);

  constructor(
    @InjectDataSource('master') private readonly master: DataSource,
    @InjectDataSource('data') private readonly data: DataSource,
    private readonly schema: TenantSchemaService,
  ) {}

  async provisionSchema(schemaName: string): Promise<void> {
    await this.schema.ensureSchemaExists(schemaName);

    // Build all tenant tables in the new schema using a scoped DataSource
    // that points at the requested schema. We clone the existing options
    // and override the `schema` field.
    const scoped = new DataSource({
      ...(this.data.options as any),
      schema: schemaName,
      entities: TENANT_ENTITIES,
      name: `data_${schemaName}`,
      synchronize: false,
    });

    try {
      await scoped.initialize();
      await scoped.synchronize(false);
      await this.recordMigration(
        schemaName,
        'initial_schema',
        'success',
        null,
      );
      this.logger.log(`Provisioned tenant schema: ${schemaName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.recordMigration(
        schemaName,
        'initial_schema',
        'failed',
        message,
      );
      this.logger.error(
        `Failed to provision schema ${schemaName}: ${message}`,
      );
      throw err;
    } finally {
      if (scoped.isInitialized) {
        await scoped.destroy();
      }
    }
  }

  async recordMigration(
    schemaName: string,
    migrationName: string,
    status: 'success' | 'failed',
    errorMessage: string | null,
  ): Promise<void> {
    const repo = this.master.getRepository(SchemaMigrationLog);
    await repo.save(
      repo.create({
        schemaName,
        migrationName,
        status,
        errorMessage,
      }),
    );
  }
}
