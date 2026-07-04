import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Exam } from '../../../database/tenant/exam.entity';
import { Mark } from '../../../database/tenant/mark.entity';
import { ReportCard } from '../../../database/tenant/report-card.entity';
import { Subject } from '../../../database/tenant/subject.entity';
import { Student } from '../../../database/tenant/student.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { CreateExamDto, SaveMarksDto, UpdateExamDto } from './dto/exam.dto';

export function gradeFor(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

@Injectable()
export class ExamsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  list(
    schemaName: string,
    schoolId: string,
    opts: { academicYearId?: string; classId?: string } = {},
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(Exam).find({
        where: {
          schoolId,
          ...(opts.academicYearId
            ? { academicYearId: opts.academicYearId }
            : {}),
          ...(opts.classId ? { classId: opts.classId } : {}),
        },
        order: { startDate: 'DESC', createdAt: 'DESC' },
      });
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const exam = await em.getRepository(Exam).findOne({
        where: { id, schoolId },
      });
      if (!exam) throw new NotFoundException('Exam not found');
      return exam;
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateExamDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Exam);
      return repo.save(
        repo.create({
          schoolId,
          academicYearId: dto.academicYearId,
          name: dto.name,
          examType: dto.examType,
          classId: dto.classId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          status: dto.status ?? 'scheduled',
        }),
      );
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateExamDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Exam);
      const exam = await repo.findOne({ where: { id, schoolId } });
      if (!exam) throw new NotFoundException('Exam not found');
      const t = exam as unknown as Record<string, unknown>;
      for (const k of ['name', 'examType', 'status'] as const) {
        if (dto[k] !== undefined) t[k] = dto[k];
      }
      if (dto.startDate) exam.startDate = new Date(dto.startDate);
      if (dto.endDate) exam.endDate = new Date(dto.endDate);
      return repo.save(exam);
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Exam);
      const exam = await repo.findOne({ where: { id, schoolId } });
      if (!exam) throw new NotFoundException('Exam not found');
      await em.getRepository(Mark).delete({ schoolId, examId: id });
      await em.getRepository(ReportCard).delete({ schoolId, examId: id });
      await repo.remove(exam);
      return { deleted: true, id };
    });
  }

  /** Marks-entry grid: students (rows) × subjects (cols) + existing marks. */
  marksGrid(schemaName: string, schoolId: string, examId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const exam = await em
        .getRepository(Exam)
        .findOne({ where: { id: examId, schoolId } });
      if (!exam) throw new NotFoundException('Exam not found');

      const subjects = await em.getRepository(Subject).find({
        where: { schoolId, classId: exam.classId },
        order: { name: 'ASC' },
      });

      const enrollments = await em.getRepository(StudentEnrollment).find({
        where: {
          schoolId,
          classId: exam.classId,
          academicYearId: exam.academicYearId,
          status: 'active' as any,
        },
      });
      const rollById = new Map(
        enrollments.map((e) => [e.studentId, e.rollNumber]),
      );
      const studentIds = enrollments.map((e) => e.studentId);
      const students = studentIds.length
        ? await em
            .getRepository(Student)
            .find({ where: { id: In(studentIds), schoolId } })
        : [];

      const marks = await em
        .getRepository(Mark)
        .find({ where: { schoolId, examId } });
      const markMap: Record<
        string,
        { marksObtained: number | null; isAbsent: boolean }
      > = {};
      for (const m of marks) {
        markMap[`${m.studentId}:${m.subjectId}`] = {
          marksObtained: m.isAbsent ? null : Number(m.marksObtained),
          isAbsent: m.isAbsent,
        };
      }

      return {
        exam: {
          id: exam.id,
          name: exam.name,
          examType: exam.examType,
          classId: exam.classId,
          academicYearId: exam.academicYearId,
          status: exam.status,
        },
        subjects: subjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
          maxMarks: s.maxMarks,
          passMarks: s.passMarks,
        })),
        students: students
          .map((s) => ({
            id: s.id,
            admissionNumber: s.admissionNumber,
            studentName: s.studentName,
            rollNumber: rollById.get(s.id) ?? null,
          }))
          .sort((a, b) =>
            (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '', undefined, {
              numeric: true,
            }),
          ),
        marks: markMap,
      };
    });
  }

  saveMarks(
    schemaName: string,
    schoolId: string,
    examId: string,
    userId: string,
    dto: SaveMarksDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const exam = await em
        .getRepository(Exam)
        .findOne({ where: { id: examId, schoolId } });
      if (!exam) throw new NotFoundException('Exam not found');

      const subjects = await em
        .getRepository(Subject)
        .find({ where: { schoolId, classId: exam.classId } });
      const subjMax = new Map(subjects.map((s) => [s.id, s.maxMarks]));
      const repo = em.getRepository(Mark);
      let saved = 0;

      for (const e of dto.entries) {
        const maxMarks = e.maxMarks ?? subjMax.get(e.subjectId) ?? 100;
        const isAbsent = !!e.isAbsent;
        const obtained = isAbsent ? 0 : (e.marksObtained ?? 0);
        const pct = maxMarks > 0 ? (obtained / maxMarks) * 100 : 0;
        const grade = isAbsent ? 'AB' : gradeFor(pct);

        const existing = await repo.findOne({
          where: { schoolId, examId, studentId: e.studentId, subjectId: e.subjectId },
        });
        if (existing) {
          existing.marksObtained = obtained as any;
          existing.maxMarks = maxMarks;
          existing.isAbsent = isAbsent;
          existing.grade = grade;
          existing.enteredBy = userId;
          await repo.save(existing);
        } else {
          await repo.save(
            repo.create({
              schoolId,
              studentId: e.studentId,
              examId,
              subjectId: e.subjectId,
              marksObtained: obtained as any,
              maxMarks,
              isAbsent,
              grade,
              enteredBy: userId,
            }),
          );
        }
        saved++;
      }
      return { saved };
    });
  }
}
