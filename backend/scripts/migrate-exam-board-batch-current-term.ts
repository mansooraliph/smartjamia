/**
 * One-off migration: adds the `current_term_number` column to
 * `exam_board_batches` in the master DB. The TypeORM entity picked this up
 * (ExamBoardBatch.currentTermNumber) but the DB column was never created.
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/migrate-exam-board-batch-current-term.ts
 */

import 'reflect-metadata';
import { MasterDataSource } from '../src/database/master-datasource';

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows: unknown[] = await MasterDataSource.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

async function main() {
  try {
    console.log('▸ Connecting to master DB…');
    await MasterDataSource.initialize();

    if (await columnExists('exam_board_batches', 'current_term_number')) {
      console.log('  · exam_board_batches: current_term_number column already present, skipping');
    } else {
      await MasterDataSource.query(
        `ALTER TABLE "public"."exam_board_batches" ADD COLUMN "current_term_number" integer NOT NULL DEFAULT 1;`,
      );
      console.log('  + exam_board_batches: added current_term_number column');
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
