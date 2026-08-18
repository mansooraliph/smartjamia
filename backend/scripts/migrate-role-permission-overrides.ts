/**
 * One-off migration: creates the `role_permission_overrides` table across
 * every tenant schema that already has a `roles` table (i.e. every
 * provisioned school). Newly provisioned schools get it automatically via
 * SchemaMigrationService.provisionSchema (TypeORM synchronize).
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/migrate-role-permission-overrides.ts
 */

import 'reflect-metadata';
import { DataDataSource } from '../src/database/data-datasource';

async function schemasWithTable(table: string): Promise<string[]> {
  const rows: { table_schema: string }[] = await DataDataSource.query(
    `SELECT table_schema
       FROM information_schema.tables
      WHERE table_name = $1
        AND table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY table_schema;`,
    [table],
  );
  return rows.map((r) => r.table_schema);
}

async function tableExists(schema: string, table: string): Promise<boolean> {
  const rows: unknown[] = await DataDataSource.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2`,
    [schema, table],
  );
  return rows.length > 0;
}

async function main() {
  try {
    console.log('▸ Connecting to data DB…');
    await DataDataSource.initialize();

    const schemas = await schemasWithTable('roles');
    if (schemas.length === 0) {
      console.log('No provisioned schemas found — nothing to do.');
    } else {
      console.log(`▸ Checking ${schemas.length} schema(s): ${schemas.join(', ')}`);
      for (const schema of schemas) {
        if (await tableExists(schema, 'role_permission_overrides')) {
          console.log(`  · ${schema}: role_permission_overrides already present, skipping`);
          continue;
        }
        await DataDataSource.query(`
          CREATE TABLE "${schema}"."role_permission_overrides" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "school_id" uuid NOT NULL,
            "role_key" varchar(64) NOT NULL,
            "permissions" jsonb NOT NULL DEFAULT '[]',
            "created_at" TIMESTAMP NOT NULL DEFAULT now(),
            "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_role_permission_overrides" PRIMARY KEY ("id")
          );
        `);
        await DataDataSource.query(`
          CREATE INDEX "IDX_role_permission_overrides_school"
            ON "${schema}"."role_permission_overrides" ("school_id");
        `);
        await DataDataSource.query(`
          CREATE UNIQUE INDEX "IDX_role_permission_overrides_school_role"
            ON "${schema}"."role_permission_overrides" ("school_id", "role_key");
        `);
        console.log(`  + ${schema}: created role_permission_overrides table`);
      }
    }

    await DataDataSource.destroy();
    console.log('\n✔ Migration complete\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Migration failed:', err);
    process.exit(1);
  }
}

main();
