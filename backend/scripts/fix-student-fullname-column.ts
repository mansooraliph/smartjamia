/**
 * One-off fix: drops the stale `full_name` column from `students` across
 * every tenant schema.
 *
 * `migrate-student-fullname.ts` was run against a data model that doesn't
 * match this codebase's actual Student entity — the entity has always used
 * a single `student_name` column, never `first_name`/`last_name`/`full_name`.
 * That migration added `full_name` as NOT NULL, but nothing in the app ever
 * writes to it, so every student INSERT since has failed with:
 *   null value in column "full_name" of relation "students" violates
 *   not-null constraint
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/fix-student-fullname-column.ts
 */

import 'reflect-metadata';
import { DataDataSource } from '../src/database/data-datasource';

async function schemasWithColumn(table: string, column: string): Promise<string[]> {
  const rows: { table_schema: string }[] = await DataDataSource.query(
    `SELECT table_schema
       FROM information_schema.columns
      WHERE table_name = $1 AND column_name = $2
      ORDER BY table_schema;`,
    [table, column],
  );
  return rows.map((r) => r.table_schema);
}

async function main() {
  try {
    console.log('▸ Connecting to data DB…');
    await DataDataSource.initialize();

    const schemas = await schemasWithColumn('students', 'full_name');
    if (schemas.length === 0) {
      console.log('No schemas with students.full_name found — nothing to do.');
    } else {
      console.log(`▸ Checking ${schemas.length} schema(s): ${schemas.join(', ')}`);
      for (const schema of schemas) {
        await DataDataSource.query(
          `ALTER TABLE "${schema}"."students" DROP COLUMN "full_name";`,
        );
        console.log(`  - ${schema}: dropped full_name`);
      }
    }

    await DataDataSource.destroy();
    console.log('\n✔ Fix complete\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Fix failed:', err);
    process.exit(1);
  }
}

main();
