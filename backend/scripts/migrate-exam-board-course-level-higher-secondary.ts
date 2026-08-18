/**
 * One-off migration: adds the 'higher_secondary' value to the
 * exam_board_courses_level_enum Postgres enum type (master DB). The
 * TypeORM entity picked this up (ExamBoardCourse.level) but the DB enum
 * type never had the value added.
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/migrate-exam-board-course-level-higher-secondary.ts
 */

import 'reflect-metadata';
import { MasterDataSource } from '../src/database/master-datasource';

async function enumValueExists(enumType: string, value: string): Promise<boolean> {
  const rows: unknown[] = await MasterDataSource.query(
    `SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = $1 AND e.enumlabel = $2`,
    [enumType, value],
  );
  return rows.length > 0;
}

async function main() {
  try {
    console.log('▸ Connecting to master DB…');
    await MasterDataSource.initialize();

    if (await enumValueExists('exam_board_courses_level_enum', 'higher_secondary')) {
      console.log('  · exam_board_courses_level_enum: higher_secondary already present, skipping');
    } else {
      await MasterDataSource.query(
        `ALTER TYPE "public"."exam_board_courses_level_enum" ADD VALUE 'higher_secondary';`,
      );
      console.log('  + exam_board_courses_level_enum: added higher_secondary');
    }

    await MasterDataSource.destroy();
    console.log('\n✔ Migration complete\n');
    process.exit(0);
  } catch (err) {
    console.error('\n✗ Migration failed:', err);
    process.exit(1);
  }
}

main();
