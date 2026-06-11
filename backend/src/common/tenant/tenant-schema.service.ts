import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Sets the PostgreSQL search_path for a query/transaction so that
 * subsequent SQL reads/writes target the requested tenant schema.
 *
 * Usage:
 *   const result = await tenantSchema.runInSchema(schemaName, async (em) => {
 *     return em.find(Student, { where: { schoolId } });
 *   });
 */
@Injectable()
export class TenantSchemaService {
  private readonly logger = new Logger(TenantSchemaService.name);

  constructor(@InjectDataSource('data') private readonly data: DataSource) {}

  get dataSource(): DataSource {
    return this.data;
  }

  async runInSchema<T>(
    schemaName: string,
    fn: (em: EntityManager) => Promise<T>,
  ): Promise<T> {
    const safe = this.sanitizeSchemaName(schemaName);
    return this.data.transaction(async (em) => {
      await em.query(`SET LOCAL search_path TO "${safe}", public;`);
      return fn(em);
    });
  }

  async ensureSchemaExists(schemaName: string): Promise<void> {
    const safe = this.sanitizeSchemaName(schemaName);
    await this.data.query(`CREATE SCHEMA IF NOT EXISTS "${safe}";`);
    this.logger.log(`Schema ensured: ${safe}`);
  }

  async dropSchema(schemaName: string): Promise<void> {
    const safe = this.sanitizeSchemaName(schemaName);
    if (safe === 'shared_pool' || safe === 'public') {
      throw new Error(`Refusing to drop protected schema: ${safe}`);
    }
    await this.data.query(`DROP SCHEMA IF EXISTS "${safe}" CASCADE;`);
    this.logger.warn(`Schema dropped: ${safe}`);
  }

  async listSchemas(): Promise<string[]> {
    const rows: { schema_name: string }[] = await this.data.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
       ORDER BY schema_name;`,
    );
    return rows.map((r) => r.schema_name);
  }

  private sanitizeSchemaName(name: string): string {
    if (!/^[a-z_][a-z0-9_]{0,62}$/.test(name)) {
      throw new Error(`Invalid schema name: ${name}`);
    }
    return name;
  }
}
