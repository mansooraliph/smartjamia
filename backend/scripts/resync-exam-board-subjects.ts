/**
 * One-off maintenance: re-run the Examination Board course/subject mirror
 * sync for every currently-enabled institution (see
 * ExamBoardService.syncInstitutionMirror). Re-materializes each enabled
 * institution's local `subjects` (and `academic_years`/`courses`) rows from
 * the org's Exam Board master — useful after a cleanup that removed the
 * mirrored rows (see remove-mirrored-subjects.ts), or whenever the master
 * data has drifted from what's mirrored locally.
 *
 * Idempotent: safe to run more than once. Run via:
 *   npx ts-node backend/scripts/resync-exam-board-subjects.ts
 * (from repo root, or adjust the path to match your db:setup invocation)
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExamBoardService } from '../src/modules/superadmin/exam-board/exam-board.service';

async function main() {
  console.log('▸ Booting application context…');
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const svc = app.get(ExamBoardService);
    console.log('▸ Resyncing all enabled institutions…');
    const { institutionsSynced } = await svc.resyncAllInstitutions();
    console.log(`\n✔ Resynced ${institutionsSynced} institution(s)\n`);
  } finally {
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Resync failed:', err);
  process.exit(1);
});
