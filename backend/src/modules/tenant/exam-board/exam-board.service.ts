import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { ExamBoardCourse } from '../../../database/master/exam-board/exam-board-course.entity';
import { ExamBoardAcademicYear } from '../../../database/master/exam-board/exam-board-academic-year.entity';
import { ExamBoardInstitutionCourse } from '../../../database/master/exam-board/exam-board-institution-course.entity';
import { ExamBoardInstitutionAcademicYear } from '../../../database/master/exam-board/exam-board-institution-academic-year.entity';
import { ExamBoardBatch } from '../../../database/master/exam-board/exam-board-batch.entity';
import { ExamBoardBatchTermSubject } from '../../../database/master/exam-board/exam-board-batch-term-subject.entity';
import { ExamBoardSubject } from '../../../database/master/exam-board/exam-board-subject.entity';
import { Student } from '../../../database/tenant/student.entity';
import { ExamBoardEnrollment } from '../../../database/tenant/exam-board-enrollment.entity';
import { ExamBoardExam } from '../../../database/tenant/exam-board-exam.entity';
import { ExamBoardExamSubject } from '../../../database/tenant/exam-board-exam-subject.entity';
import { ExamBoardMark } from '../../../database/tenant/exam-board-mark.entity';
import { EnrollExamBoardDto } from './dto/enroll.dto';
import {
  CreateExamBoardExamDto,
  CreateExamBoardExamSubjectDto,
  SaveExamBoardMarksDto,
  UpdateExamBoardExamDto,
  UpdateExamBoardExamSubjectDto,
} from './dto/exam.dto';

/**
 * Tenant-facing (college login) view of the Examination Board: only the
 * courses/academic-years/batches the org has enabled for THIS school are
 * visible here. Masters themselves are only ever written by the Org Admin
 * portal (see modules/superadmin/exam-board).
 */
@Injectable()
export class TenantExamBoardService {
  private readonly courseRepo: Repository<ExamBoardCourse>;
  private readonly yearRepo: Repository<ExamBoardAcademicYear>;
  private readonly institutionCourseRepo: Repository<ExamBoardInstitutionCourse>;
  private readonly institutionYearRepo: Repository<ExamBoardInstitutionAcademicYear>;
  private readonly batchRepo: Repository<ExamBoardBatch>;
  private readonly batchTermSubjectRepo: Repository<ExamBoardBatchTermSubject>;
  private readonly subjectRepo: Repository<ExamBoardSubject>;

  constructor(
    @InjectDataSource('master') masterDs: DataSource,
    private readonly tenant: TenantSchemaService,
  ) {
    this.courseRepo = masterDs.getRepository(ExamBoardCourse);
    this.yearRepo = masterDs.getRepository(ExamBoardAcademicYear);
    this.institutionCourseRepo = masterDs.getRepository(
      ExamBoardInstitutionCourse,
    );
    this.institutionYearRepo = masterDs.getRepository(
      ExamBoardInstitutionAcademicYear,
    );
    this.batchRepo = masterDs.getRepository(ExamBoardBatch);
    this.batchTermSubjectRepo = masterDs.getRepository(ExamBoardBatchTermSubject);
    this.subjectRepo = masterDs.getRepository(ExamBoardSubject);
  }

  async listCourses(schoolId: string) {
    const links = await this.institutionCourseRepo.find({
      where: { schoolId, isEnabled: true },
    });
    if (!links.length) return [];
    return this.courseRepo.find({
      where: { id: In(links.map((l) => l.examBoardCourseId)), isActive: true },
      order: { name: 'ASC' },
    });
  }

  async listAcademicYears(schoolId: string) {
    const links = await this.institutionYearRepo.find({
      where: { schoolId, isEnabled: true },
    });
    if (!links.length) return [];
    return this.yearRepo.find({
      where: {
        id: In(links.map((l) => l.examBoardAcademicYearId)),
        isActive: true,
      },
      order: { startDate: 'DESC' },
    });
  }

  async listBatches(
    schoolId: string,
    filters: { examBoardCourseId?: string; examBoardAcademicYearId?: string },
  ) {
    return this.batchRepo.find({
      where: { schoolId, status: 'active', ...filters },
      order: { name: 'ASC' },
    });
  }

  // ─── Course term structure (Year/Semester/Trimester 1..N) ─────────────────

  async listCourseTerms(courseId: string) {
    const course = await this.courseRepo.findOne({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    return this.termsForCourse(course);
  }

  private termsForCourse(course: {
    termSystem: string;
    durationYears: number;
  }): { number: number; label: string }[] {
    const perYear =
      course.termSystem === 'semester' ? 2 : course.termSystem === 'trimester' ? 3 : 1;
    const label =
      course.termSystem === 'semester'
        ? 'Semester'
        : course.termSystem === 'trimester'
          ? 'Trimester'
          : 'Year';
    const count = Math.max(1, course.durationYears) * perYear;
    return Array.from({ length: count }, (_, i) => ({
      number: i + 1,
      label: `${label} ${i + 1}`,
    }));
  }

  private assertValidTerm(
    course: { termSystem: string; durationYears: number },
    termNumber: number,
  ) {
    const terms = this.termsForCourse(course);
    if (!terms.some((t) => t.number === termNumber)) {
      throw new BadRequestException(
        `Term ${termNumber} is out of range for this course (1-${terms.length})`,
      );
    }
  }

  private async assertBatchForSchool(schoolId: string, batchId: string) {
    const batch = await this.batchRepo.findOne({ where: { id: batchId } });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.schoolId !== schoolId) {
      throw new BadRequestException('Batch does not belong to this school');
    }
    return batch;
  }

  /** Subjects assigned to this batch's term — the curriculum an exam's papers are drawn from. */
  async listAssignedSubjects(schoolId: string, batchId: string, termNumber: number) {
    await this.assertBatchForSchool(schoolId, batchId);
    const assignments = await this.batchTermSubjectRepo.find({
      where: { examBoardBatchId: batchId, termNumber },
    });
    if (!assignments.length) return [];
    return this.subjectRepo.find({
      where: { id: In(assignments.map((a) => a.examBoardSubjectId)) },
      order: { name: 'ASC' },
    });
  }

  async listEnrollments(
    schemaName: string,
    schoolId: string,
    batchId: string,
  ) {
    await this.assertBatchForSchool(schoolId, batchId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const enrollments = await em.getRepository(ExamBoardEnrollment).find({
        where: { schoolId, examBoardBatchId: batchId, status: 'active' },
      });
      if (!enrollments.length) return [];
      const students = await em.getRepository(Student).find({
        where: { id: In(enrollments.map((e) => e.studentId)) },
      });
      const byId = new Map(students.map((s) => [s.id, s]));
      return enrollments.map((e) => ({
        ...e,
        student: byId.get(e.studentId) ?? null,
      }));
    });
  }

  async enroll(
    schemaName: string,
    schoolId: string,
    enrolledBy: string,
    dto: EnrollExamBoardDto,
  ) {
    const batch = await this.assertBatchForSchool(
      schoolId,
      dto.examBoardBatchId,
    );
    if (batch.status !== 'active') {
      throw new BadRequestException('Batch is closed');
    }

    return this.tenant.runInSchema(schemaName, async (em) => {
      const studentRepo = em.getRepository(Student);
      const students = await studentRepo.find({
        where: { id: In(dto.studentIds), schoolId },
      });
      if (students.length !== dto.studentIds.length) {
        throw new BadRequestException(
          'One or more students were not found in this school',
        );
      }

      const enrollRepo = em.getRepository(ExamBoardEnrollment);
      const existing = await enrollRepo.find({
        where: {
          examBoardBatchId: dto.examBoardBatchId,
          studentId: In(dto.studentIds),
        },
      });
      const alreadyEnrolled = new Set(existing.map((e) => e.studentId));
      const toCreate = dto.studentIds.filter((id) => !alreadyEnrolled.has(id));

      const today = new Date().toISOString().slice(0, 10);
      const created = await enrollRepo.save(
        toCreate.map((studentId) =>
          enrollRepo.create({
            schoolId,
            studentId,
            examBoardBatchId: dto.examBoardBatchId,
            enrolledBy,
            enrollmentDate: today as unknown as Date,
            status: 'active',
          }),
        ),
      );

      return {
        enrolled: created.length,
        alreadyEnrolled: alreadyEnrolled.size,
      };
    });
  }

  // ─── Exams (scheduled/conducted per batch) ─────────────────────────────────

  async listExams(
    schemaName: string,
    schoolId: string,
    batchId?: string,
    termNumber?: number,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(ExamBoardExam).find({
        where: {
          schoolId,
          ...(batchId ? { examBoardBatchId: batchId } : {}),
          ...(termNumber ? { termNumber } : {}),
        },
        order: { startDate: 'DESC' },
      });
    });
  }

  async createExam(
    schemaName: string,
    schoolId: string,
    dto: CreateExamBoardExamDto,
  ) {
    const batch = await this.assertBatchForSchool(schoolId, dto.examBoardBatchId);
    const course = await this.courseRepo.findOne({ where: { id: batch.examBoardCourseId } });
    if (!course) throw new NotFoundException('Course not found');
    this.assertValidTerm(course, dto.termNumber);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(ExamBoardExam);
      return repo.save(
        repo.create({
          schoolId,
          examBoardBatchId: dto.examBoardBatchId,
          termNumber: dto.termNumber,
          name: dto.name,
          examType: dto.examType,
          startDate: dto.startDate as unknown as Date,
          endDate: dto.endDate as unknown as Date,
          status: 'draft',
        }),
      );
    });
  }

  async updateExam(
    schemaName: string,
    schoolId: string,
    examId: string,
    dto: UpdateExamBoardExamDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(ExamBoardExam);
      const exam = await repo.findOne({ where: { id: examId, schoolId } });
      if (!exam) throw new NotFoundException('Exam not found');
      Object.assign(exam, {
        ...dto,
        startDate: dto.startDate ? (dto.startDate as unknown as Date) : exam.startDate,
        endDate: dto.endDate ? (dto.endDate as unknown as Date) : exam.endDate,
      });
      return repo.save(exam);
    });
  }

  private async getExam(schemaName: string, schoolId: string, examId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const exam = await em
        .getRepository(ExamBoardExam)
        .findOne({ where: { id: examId, schoolId } });
      if (!exam) throw new NotFoundException('Exam not found');
      return exam;
    });
  }

  // ─── Subjects/papers within an exam ────────────────────────────────────────

  async listSubjects(schemaName: string, schoolId: string, examId: string) {
    await this.getExam(schemaName, schoolId, examId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(ExamBoardExamSubject).find({
        where: { examBoardExamId: examId },
        order: { subjectName: 'ASC' },
      });
    });
  }

  async addSubject(
    schemaName: string,
    schoolId: string,
    examId: string,
    dto: CreateExamBoardExamSubjectDto,
  ) {
    await this.getExam(schemaName, schoolId, examId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(ExamBoardExamSubject);
      return repo.save(
        repo.create({
          examBoardExamId: examId,
          subjectName: dto.subjectName,
          date: dto.date ? (dto.date as unknown as Date) : null,
          time: dto.time ?? null,
          maxMarks: dto.maxMarks,
          passMarks: dto.passMarks,
          ceMaxMarks: dto.ceMaxMarks ?? null,
          cePassMarks: dto.cePassMarks ?? null,
        }),
      );
    });
  }

  async updateSubject(
    schemaName: string,
    schoolId: string,
    examId: string,
    subjectId: string,
    dto: UpdateExamBoardExamSubjectDto,
  ) {
    await this.getExam(schemaName, schoolId, examId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(ExamBoardExamSubject);
      const subject = await repo.findOne({ where: { id: subjectId, examBoardExamId: examId } });
      if (!subject) throw new NotFoundException('Exam subject not found');
      Object.assign(subject, {
        ...dto,
        date: dto.date !== undefined ? (dto.date as unknown as Date) : subject.date,
      });
      return repo.save(subject);
    });
  }

  // ─── Marks ──────────────────────────────────────────────────────────────────

  async listMarks(
    schemaName: string,
    schoolId: string,
    examId: string,
    subjectId?: string,
  ) {
    await this.getExam(schemaName, schoolId, examId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(ExamBoardMark).find({
        where: {
          schoolId,
          examBoardExamId: examId,
          ...(subjectId ? { examBoardExamSubjectId: subjectId } : {}),
        },
      });
    });
  }

  async saveMarks(
    schemaName: string,
    schoolId: string,
    examId: string,
    subjectId: string,
    enteredBy: string,
    dto: SaveExamBoardMarksDto,
  ) {
    await this.getExam(schemaName, schoolId, examId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const subjectRepo = em.getRepository(ExamBoardExamSubject);
      const subject = await subjectRepo.findOne({
        where: { id: subjectId, examBoardExamId: examId },
      });
      if (!subject) throw new NotFoundException('Exam subject not found');

      const markRepo = em.getRepository(ExamBoardMark);
      const studentIds = dto.marks.map((m) => m.studentId);
      const enrollRepo = em.getRepository(ExamBoardEnrollment);
      const exam = await em
        .getRepository(ExamBoardExam)
        .findOneOrFail({ where: { id: examId } });
      const enrolled = await enrollRepo.find({
        where: {
          examBoardBatchId: exam.examBoardBatchId,
          studentId: In(studentIds),
          status: 'active',
        },
      });
      if (enrolled.length !== studentIds.length) {
        throw new BadRequestException(
          'One or more students are not enrolled in this batch',
        );
      }

      const existing = await markRepo.find({
        where: {
          examBoardExamSubjectId: subjectId,
          studentId: In(studentIds),
        },
      });
      const existingByStudent = new Map(existing.map((m) => [m.studentId, m]));

      const rows = dto.marks.map((entry) => {
        const row =
          existingByStudent.get(entry.studentId) ??
          markRepo.create({
            schoolId,
            studentId: entry.studentId,
            examBoardExamId: examId,
            examBoardExamSubjectId: subjectId,
          });
        row.marksObtained = entry.isAbsent ? 0 : entry.marksObtained;
        row.maxMarks = subject.maxMarks;
        row.ceMarksObtained = entry.isAbsent
          ? 0
          : entry.ceMarksObtained ?? null;
        row.isAbsent = entry.isAbsent ?? false;
        row.enteredBy = enteredBy;
        return row;
      });
      const saved = await markRepo.save(rows);
      return { saved: saved.length };
    });
  }
}
