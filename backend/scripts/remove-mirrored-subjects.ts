/**
 * One-off data cleanup: delete the `subjects` rows that were auto-mirrored
 * into existing institutions from the org's Examination Board Subject master
 * (see ExamBoardService.syncInstitutionMirror / mirrorSubjectsForCourse).
 *
 * Mirrored rows are identified by a non-null `exam_board_subject_id`. Manually
 * created subjects (exam_board_subject_id IS NULL) are left untouched.
 *
 * Re-enabling a course/academic-year for an institution re-mirrors its
 * subjects automatically, so this is safe to run even on schools that are
 * actively using the Exam Board wing — the rows just get recreated on the
 * next sync.
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/remove-mirrored-subjects.ts
 * (from repo root, or adjust the path to match your db:setup invocation)
 */

import 'reflect-metadata';
import { DataDataSource } from '../src/database/data-datasource';

async function schemasWithSubjects(): Promise<string[]> {
  const rows: { table_schema: string }[] = await DataDataSource.query(
    `SELECT table_schema
       FROM information_schema.tables
      WHERE table_name = 'subjects'
        AND table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY table_schema;`,
  );
  return rows.map((r) => r.table_schema);
}

async function columnExists(schema: string, column: string): Promise<boolean> {
  const rows: unknown[] = await DataDataSource.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = 'subjects' AND column_name = $2`,
    [schema, column],
  );
  return rows.length > 0;
}

async function cleanSchema(schema: string) {
  if (!(await columnExists(schema, 'exam_board_subject_id'))) {
    console.log(`  · ${schema}: no exam_board_subject_id column, skipping`);
    return;
  }
  const result: [unknown[], number] = await DataDataSource.query(
    `SET search_path TO "${schema}"; DELETE FROM "subjects" WHERE "exam_board_subject_id" IS NOT NULL;`,
  );
  const deleted = result?.[1] ?? 0;
  if (deleted > 0) {
    console.log(`  - ${schema}: removed ${deleted} mirrored subject(s)`);
  }
}

async function main() {
  try {
    console.log('▸ Connecting to data DB…');
    await DataDataSource.initialize();

    const schemas = await schemasWithSubjects();
    if (schemas.length === 0) {
      console.log('No schemas with a subjects table found — nothing to do.');
    } else {
      console.log(`▸ Checking ${schemas.length} schema(s): ${schemas.join(', ')}`);
      for (const s of schemas) await cleanSchema(s);
    }

    await DataDataSource.destroy();
    console.log('\n✔ Mirrored subject cleanup complete\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Cleanup failed:', err);
    process.exit(1);
  }
}

main();
