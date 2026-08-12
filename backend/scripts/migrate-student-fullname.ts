/**
 * One-off data migration: students.first_name + students.last_name → full_name.
 *
 * Runtime is `synchronize: false`, so entity changes don't touch the DB. This
 * script materializes the new `full_name` column across EVERY tenant schema
 * (shared_pool + school_*), backfills it from the existing first/last names,
 * then drops the now-unused columns.
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/migrate-student-fullname.ts
 * (from repo root, or adjust the path to match your db:setup invocation)
 */

import 'reflect-metadata';
import { DataDataSource } from '../src/database/data-datasource';

async function schemasWithStudents(): Promise<string[]> {
  const rows: { table_schema: string }[] = await DataDataSource.query(
    `SELECT table_schema
       FROM information_schema.tables
      WHERE table_name = 'students'
        AND table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY table_schema;`,
  );
  return rows.map((r) => r.table_schema);
}

async function columnExists(schema: string, column: string): Promise<boolean> {
  const rows: unknown[] = await DataDataSource.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'students' AND column_name = $2`,
    [schema, column],
  );
  return rows.length > 0;
}

async function migrateSchema(schema: string) {
  const q = (sql: string) => DataDataSource.query(`SET search_path TO "${schema}"; ${sql}`);

  const hasFirst = await columnExists(schema, 'first_name');
  const hasLast = await columnExists(schema, 'last_name');
  const hasFull = await columnExists(schema, 'full_name');

  // 1. Add the new column (nullable for now so the backfill can run).
  if (!hasFull) {
    await q(`ALTER TABLE "students" ADD COLUMN "full_name" varchar(200);`);
    console.log(`  + ${schema}: added full_name`);
  }

  // 2. Backfill from first/last where empty.
  if (hasFirst || hasLast) {
    const first = hasFirst ? `coalesce("first_name", '')` : `''`;
    const last = hasLast ? `coalesce("last_name", '')` : `''`;
    await q(
      `UPDATE "students"
          SET "full_name" = btrim(${first} || ' ' || ${last})
        WHERE "full_name" IS NULL OR "full_name" = '';`,
    );
    console.log(`  ~ ${schema}: backfilled full_name from first/last`);
  }

  // 3. Guard against any leftover NULLs (rows that had neither name) before NOT NULL.
  await q(`UPDATE "students" SET "full_name" = 'Unknown' WHERE "full_name" IS NULL OR "full_name" = '';`);

  // 4. Enforce NOT NULL to match the entity.
  await q(`ALTER TABLE "students" ALTER COLUMN "full_name" SET NOT NULL;`);

  // 5. Drop the old columns (NOT NULL on them would otherwise block new inserts).
  if (hasFirst) {
    await q(`ALTER TABLE "students" DROP COLUMN "first_name";`);
    console.log(`  - ${schema}: dropped first_name`);
  }
  if (hasLast) {
    await q(`ALTER TABLE "students" DROP COLUMN "last_name";`);
    console.log(`  - ${schema}: dropped last_name`);
  }
}

async function main() {
  try {
    console.log('▸ Connecting to data DB…');
    await DataDataSource.initialize();

    const schemas = await schemasWithStudents();
    if (schemas.length === 0) {
      console.log('No schemas with a students table found — nothing to do.');
    } else {
      console.log(`▸ Migrating ${schemas.length} schema(s): ${schemas.join(', ')}`);
      for (const s of schemas) await migrateSchema(s);
    }

    await DataDataSource.destroy();
    console.log('\n✔ Student full_name migration complete\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Migration failed:', err);
    process.exit(1);
  }
}

main();
