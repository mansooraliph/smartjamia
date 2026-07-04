import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EntityManager, In } from 'typeorm';
import { ReportCard } from '../../../database/tenant/report-card.entity';
import { Exam } from '../../../database/tenant/exam.entity';
import { Mark } from '../../../database/tenant/mark.entity';
import { Subject } from '../../../database/tenant/subject.entity';
import { Student } from '../../../database/tenant/student.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { gradeFor } from '../exams/exams.service';
import {
  REPORT_CARD_PDF_JOB,
  REPORTS_QUEUE,
  ReportCardPdfJobData,
} from './report-card.constants';

@Injectable()
export class ReportCardsService {
  constructor(
    private readonly tenant: TenantSchemaService,
    @InjectQueue(REPORTS_QUEUE) private readonly reports: Queue,
  ) {}

  private enqueuePdf(data: ReportCardPdfJobData) {
    return this.reports.add(REPORT_CARD_PDF_JOB, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /** Compute totals + rank for an exam, (re)write report_cards, queue PDFs. */
  generateForExam(
    schemaName: string,
    schoolId: string,
    examId: string,
  ) {
    return this.tenant
      .runInSchema(schemaName, async (em) => {
        const exam = await em
          .getRepository(Exam)
          .findOne({ where: { id: examId, schoolId } });
        if (!exam) throw new NotFoundException('Exam not found');

        const marks = await em
          .getRepository(Mark)
          .find({ where: { schoolId, examId } });
        if (marks.length === 0) {
          throw new BadRequestException(
            'No marks entered for this exam yet — enter marks first.',
          );
        }

        const subjects = await em
          .getRepository(Subject)
          .find({ where: { schoolId, classId: exam.classId } });
        const passById = new Map(subjects.map((s) => [s.id, s.passMarks ?? 35]));

        // group marks by student
        const byStudent = new Map<string, Mark[]>();
        for (const m of marks) {
          const arr = byStudent.get(m.studentId) ?? [];
          arr.push(m);
          byStudent.set(m.studentId, arr);
        }

        // compute per-student aggregates
        const computed = [...byStudent.entries()].map(([studentId, list]) => {
          let totalObtained = 0;
          let totalMax = 0;
          let allPassed = true;
          for (const m of list) {
            const obtained = m.isAbsent ? 0 : Number(m.marksObtained);
            const pass = passById.get(m.subjectId) ?? 35;
            if (m.isAbsent || obtained < pass) allPassed = false;
            totalObtained += obtained;
            totalMax += m.maxMarks;
          }
          const percentage =
            totalMax > 0
              ? Math.round((totalObtained / totalMax) * 100 * 100) / 100
              : 0;
          return {
            studentId,
            totalObtained,
            totalMax,
            percentage,
            grade: gradeFor(percentage),
            isPassed: allPassed,
          };
        });

        // competition ranking by percentage (desc), tie → same rank
        computed.sort((a, b) => b.percentage - a.percentage);
        let rank = 0;
        let prevPct: number | null = null;
        computed.forEach((c, i) => {
          if (prevPct === null || c.percentage < prevPct) rank = i + 1;
          (c as any).rank = rank;
          prevPct = c.percentage;
        });

        // replace existing report cards for this exam
        const repo = em.getRepository(ReportCard);
        await repo.delete({ schoolId, examId });

        const now = new Date();
        const rows = computed.map((c) =>
          repo.create({
            schoolId,
            studentId: c.studentId,
            academicYearId: exam.academicYearId,
            examId,
            totalMarks: c.totalObtained as any,
            maxTotalMarks: c.totalMax as any,
            percentage: c.percentage as any,
            grade: c.grade,
            rank: (c as any).rank,
            isPassed: c.isPassed,
            pdfUrl: null,
            generatedAt: now,
          }),
        );
        const saved = await repo.save(rows);
        return { exam, saved };
      })
      .then(async ({ exam, saved }) => {
        // queue PDFs outside the tenant transaction
        for (const rc of saved) {
          await this.enqueuePdf({
            schemaName,
            schoolId,
            reportCardId: rc.id,
          });
        }
        return {
          examId: exam.id,
          generated: saved.length,
          queuedPdfs: saved.length,
        };
      });
  }

  /** Ranked report-card list for an exam (admin view). */
  listForExam(schemaName: string, schoolId: string, examId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const cards = await em.getRepository(ReportCard).find({
        where: { schoolId, examId },
        order: { rank: 'ASC' },
      });
      const students = await this.studentMap(
        em,
        schoolId,
        cards.map((c) => c.studentId),
      );
      return {
        count: cards.length,
        items: cards.map((c) => {
          const s = students.get(c.studentId);
          return {
            id: c.id,
            studentId: c.studentId,
            studentName: s ? s.studentName : '—',
            admissionNumber: s?.admissionNumber ?? '',
            totalMarks: Number(c.totalMarks),
            maxTotalMarks: Number(c.maxTotalMarks),
            percentage: Number(c.percentage),
            grade: c.grade,
            rank: c.rank,
            isPassed: c.isPassed,
            pdfUrl: c.pdfUrl,
            generatedAt: c.generatedAt,
          };
        }),
      };
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const rc = await em
        .getRepository(ReportCard)
        .findOne({ where: { id, schoolId } });
      if (!rc) throw new NotFoundException('Report card not found');
      return rc;
    });
  }

  regeneratePdf(schemaName: string, schoolId: string, id: string) {
    return this.tenant
      .runInSchema(schemaName, async (em) => {
        const repo = em.getRepository(ReportCard);
        const rc = await repo.findOne({ where: { id, schoolId } });
        if (!rc) throw new NotFoundException('Report card not found');
        await repo.update({ id, schoolId }, { pdfUrl: null });
        return rc;
      })
      .then(async () => {
        await this.enqueuePdf({ schemaName, schoolId, reportCardId: id });
        return { queued: true, id };
      });
  }

  /** Portal helper: examId → {pdfUrl, generatedAt} for a student. */
  async reportCardsByExam(
    em: EntityManager,
    schoolId: string,
    studentId: string,
  ): Promise<Map<string, { id: string; pdfUrl: string | null; rank: number | null }>> {
    const cards = await em
      .getRepository(ReportCard)
      .find({ where: { schoolId, studentId } });
    return new Map(
      cards.map((c) => [c.examId, { id: c.id, pdfUrl: c.pdfUrl, rank: c.rank }]),
    );
  }

  private async studentMap(
    em: EntityManager,
    schoolId: string,
    ids: string[],
  ): Promise<Map<string, Student>> {
    if (!ids.length) return new Map();
    const students = await em.getRepository(Student).find({
      where: { id: In(ids), schoolId },
      withDeleted: true,
    });
    return new Map(students.map((s) => [s.id, s]));
  }
}
