/**
 * One-off migration: adds the 'higher_secondary' value to the
 * courses_level_enum Postgres enum type in every tenant schema. The
 * TypeORM entity picked this up (Course.level) but the DB enum type never
 * had the value added.
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/migrate-course-level-higher-secondary.ts
 */

import 'reflect-metadata';
import { DataDataSource } from '../src/database/data-datasource';

async function schemasWithEnum(typeName: string): Promise<string[]> {
  const rows: { schema: string }[] = await DataDataSource.query(
    `SELECT n.nspname AS schema
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE t.typname = $1
      ORDER BY n.nspname;`,
    [typeName],
  );
  return rows.map((r) => r.schema);
}

async function enumValueExists(schema: string, typeName: string, value: string): Promise<boolean> {
  const rows: unknown[] = await DataDataSource.query(
    `SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1 AND t.typname = $2 AND e.enumlabel = $3`,
    [schema, typeName, value],
  );
  return rows.length > 0;
}

async function main() {
  try {
    console.log('▸ Connecting to data DB…');
    await DataDataSource.initialize();

    const schemas = await schemasWithEnum('courses_level_enum');
    if (schemas.length === 0) {
      console.log('No schemas with courses_level_enum found — nothing to do.');
    } else {
      console.log(`▸ Checking ${schemas.length} schema(s): ${schemas.join(', ')}`);
      for (const schema of schemas) {
        if (await enumValueExists(schema, 'courses_level_enum', 'higher_secondary')) {
          console.log(`  · ${schema}: higher_secondary already present, skipping`);
          continue;
        }
        await DataDataSource.query(
          `ALTER TYPE "${schema}"."courses_level_enum" ADD VALUE 'higher_secondary';`,
        );
        console.log(`  + ${schema}: added higher_secondary`);
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
