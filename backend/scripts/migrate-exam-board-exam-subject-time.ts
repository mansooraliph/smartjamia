/**
 * One-off migration: adds the `time` column to `exam_board_exam_subjects`
 * across every tenant schema. The TypeORM entity picked this up
 * (ExamBoardExamSubject.time) but the DB column was never created, causing
 * "column \"time\" of relation \"exam_board_exam_subjects\" does not exist".
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/migrate-exam-board-exam-subject-time.ts
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

async function main() {
  try {
    console.log('▸ Connecting to data DB…');
    await DataDataSource.initialize();

    const schemas = await schemasWithTable('exam_board_exam_subjects');
    if (schemas.length === 0) {
      console.log('No schemas with exam_board_exam_subjects found — nothing to do.');
    } else {
      console.log(`▸ Checking ${schemas.length} schema(s): ${schemas.join(', ')}`);
      for (const schema of schemas) {
        if (await columnExists(schema, 'exam_board_exam_subjects', 'time')) {
          console.log(`  · ${schema}: time column already present, skipping`);
          continue;
        }
        await DataDataSource.query(
          `ALTER TABLE "${schema}"."exam_board_exam_subjects" ADD COLUMN "time" time;`,
        );
        console.log(`  + ${schema}: added time column`);
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
