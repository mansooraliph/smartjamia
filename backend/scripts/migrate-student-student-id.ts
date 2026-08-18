/**
 * One-off migration: adds the `student_id` column (+ its partial unique
 * index) to `students` across every tenant schema. The TypeORM entity
 * picked this up (Student.studentId) but the DB column was never created,
 * causing "column Student.student_id does not exist" / "column s.student_id
 * does not exist".
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/migrate-student-student-id.ts
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

async function columnExists(schema: string, table: string, column: string): Promise<boolean> {
  const rows: unknown[] = await DataDataSource.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schema, table, column],
  );
  return rows.length > 0;
}

async function indexExists(schema: string, indexName: string): Promise<boolean> {
  const rows: unknown[] = await DataDataSource.query(
    `SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2`,
    [schema, indexName],
  );
  return rows.length > 0;
}

async function main() {
  try {
    console.log('▸ Connecting to data DB…');
    await DataDataSource.initialize();

    const schemas = await schemasWithTable('students');
    if (schemas.length === 0) {
      console.log('No schemas with students found — nothing to do.');
    } else {
      console.log(`▸ Checking ${schemas.length} schema(s): ${schemas.join(', ')}`);
      for (const schema of schemas) {
        if (await columnExists(schema, 'students', 'student_id')) {
          console.log(`  · ${schema}: student_id column already present, skipping`);
        } else {
          await DataDataSource.query(
            `ALTER TABLE "${schema}"."students" ADD COLUMN "student_id" varchar(50);`,
          );
          console.log(`  + ${schema}: added student_id column`);
        }

        const indexName = `IDX_students_school_student_id_unique`;
        if (await indexExists(schema, indexName)) {
          console.log(`  · ${schema}: unique index already present, skipping`);
        } else {
          await DataDataSource.query(
            `CREATE UNIQUE INDEX "${indexName}" ON "${schema}"."students" ("school_id", "student_id") WHERE "student_id" IS NOT NULL;`,
          );
          console.log(`  + ${schema}: added unique (school_id, student_id) index`);
        }
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
