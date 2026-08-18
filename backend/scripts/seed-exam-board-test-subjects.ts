/**
 * Dev/test data helper: fills in any Examination Board course terms that have
 * no subjects yet with a couple of placeholder subjects, then assigns every
 * subject into every term of every scheme AND every batch (schemes are just
 * the course-level curriculum template — a batch only actually sees subjects,
 * e.g. when scheduling exams, once they're assigned at the batch-term level),
 * and re-mirrors enabled institutions so the new subjects show up locally.
 *
 * Safe to re-run — terms that already have subjects are left untouched, and
 * scheme/batch term assignment + institution mirroring are all idempotent.
 *
 * Run via:
 *   npx ts-node backend/scripts/seed-exam-board-test-subjects.ts
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { ExamBoardService } from '../src/modules/superadmin/exam-board/exam-board.service';
import { CreateExamBoardSubjectDto } from '../src/modules/superadmin/exam-board/dto/exam-board.dto';

// Placeholder subject names per term, reused/cycled per course.
const SUBJECT_POOL = [
  ['Core Paper A', 'Core Paper B'],
  ['Core Paper C', 'Elective Paper A'],
  ['Core Paper D', 'Elective Paper B'],
  ['Core Paper E', 'Project Work'],
  ['Core Paper F', 'Elective Paper C'],
  ['Core Paper G', 'Dissertation'],
];

function subjectsFor(termNumber: number): string[] {
  return SUBJECT_POOL[(termNumber - 1) % SUBJECT_POOL.length];
}

async function main() {
  console.log('▸ Booting application context…');
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const svc = app.get(ExamBoardService);
    const masterDs = app.get<DataSource>(getDataSourceToken('master'));

    // listCourses/listCourseTerms are org-scoped, so discover every org that
    // has at least one Exam Board course (there's normally just one in dev).
    const orgRows: { organization_id: string }[] = await masterDs.query(
      'SELECT DISTINCT organization_id FROM exam_board_courses',
    );
    const orgIds = orgRows.map((r) => r.organization_id);

    let created = 0;
    for (const organizationId of orgIds) {
      const orgCourses = await svc.listCourses(organizationId);
      for (const course of orgCourses) {
        const terms = await svc.listCourseTerms(organizationId, course.id);
        const existingSubjects = await svc.listSubjects(organizationId, course.id);
        const termsWithSubjects = new Set(existingSubjects.map((s) => s.termNumber));
        for (const term of terms) {
          if (termsWithSubjects.has(term.number)) continue;
          for (const name of subjectsFor(term.number)) {
            const dto: CreateExamBoardSubjectDto = {
              examBoardCourseId: course.id,
              termNumber: term.number,
              name: `${name} (${course.name})`,
              maxMarks: 100,
              passMarks: 35,
            };
            await svc.createSubject(organizationId, dto);
            created++;
          }
          console.log(`  + ${course.name} — ${term.label}: added ${subjectsFor(term.number).length} subject(s)`);
        }
      }
    }
    console.log(`\n▸ Created ${created} subject(s) total`);

    console.log('▸ Assigning all subjects into every term of every scheme…');
    const { schemesUpdated, assignmentsCreated } = await svc.assignAllSubjectsToAllSchemeTerms();
    console.log(`  ✔ ${schemesUpdated} scheme(s) updated, ${assignmentsCreated} assignment(s) created`);

    console.log("▸ Assigning all subjects into every term of every batch…");
    const { batchesUpdated, assignmentsCreated: batchAssignments } =
      await svc.assignAllSubjectsToAllBatchTerms();
    console.log(`  ✔ ${batchesUpdated} batch(es) updated, ${batchAssignments} assignment(s) created`);

    console.log('▸ Resyncing enabled institutions…');
    const { institutionsSynced } = await svc.resyncAllInstitutions();
    console.log(`  ✔ ${institutionsSynced} institution(s) resynced`);

    console.log('\n✔ Done\n');
  } finally {
    await app.close();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('\n✗ Seeding failed:', err);
  process.exit(1);
});
