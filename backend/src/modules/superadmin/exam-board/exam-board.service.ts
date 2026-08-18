import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, In, IsNull, Repository } from 'typeorm';
import { paginate } from '../../../common/dto/pagination.dto';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { School } from '../../../database/master/school.entity';
import { ExamBoardCourse } from '../../../database/master/exam-board/exam-board-course.entity';
import { ExamBoardAcademicYear } from '../../../database/master/exam-board/exam-board-academic-year.entity';
import { ExamBoardInstitution } from '../../../database/master/exam-board/exam-board-institution.entity';
import { ExamBoardInstitutionCourse } from '../../../database/master/exam-board/exam-board-institution-course.entity';
import { ExamBoardInstitutionAcademicYear } from '../../../database/master/exam-board/exam-board-institution-academic-year.entity';
import { ExamBoardBatch } from '../../../database/master/exam-board/exam-board-batch.entity';
import { ExamBoardScheme } from '../../../database/master/exam-board/exam-board-scheme.entity';
import { ExamBoardSubject } from '../../../database/master/exam-board/exam-board-subject.entity';
import { ExamBoardBatchTermSubject } from '../../../database/master/exam-board/exam-board-batch-term-subject.entity';
import { ExamBoardSchemeTermSubject } from '../../../database/master/exam-board/exam-board-scheme-term-subject.entity';
import { ExamBoardSchemeSyllabus } from '../../../database/master/exam-board/exam-board-scheme-syllabus.entity';
import { StorageService } from '../../../common/storage/storage.service';
import { AcademicYear as TenantAcademicYear } from '../../../database/tenant/academic-year.entity';
import { Course as TenantCourse } from '../../../database/tenant/course.entity';
import { ClassEntity as TenantClass } from '../../../database/tenant/class.entity';
import { Subject as TenantSubject } from '../../../database/tenant/subject.entity';
import { Student as TenantStudent } from '../../../database/tenant/student.entity';
import { ExamBoardEnrollment as TenantExamBoardEnrollment } from '../../../database/tenant/exam-board-enrollment.entity';
import { ExamBoardExam as TenantExamBoardExam } from '../../../database/tenant/exam-board-exam.entity';
import { ExamBoardExamSubject as TenantExamBoardExamSubject } from '../../../database/tenant/exam-board-exam-subject.entity';
import {
  CopyBatchConfigDto,
  CopySchemeConfigDto,
  CreateBatchExamDto,
  CreateBatchExamSubjectDto,
  UpdateBatchExamSubjectDto,
  CreateExamBoardAcademicYearDto,
  CreateExamBoardBatchDto,
  CreateExamBoardCourseDto,
  CreateExamBoardSchemeDto,
  CreateExamBoardSubjectDto,
  SetBatchTermSubjectsDto,
  SetInstitutionEnablementDto,
  UpdateExamBoardAcademicYearDto,
  UpdateExamBoardBatchDto,
  UpdateExamBoardCourseDto,
  UpdateExamBoardSchemeDto,
  UpdateExamBoardSubjectDto,
} from './dto/exam-board.dto';

/**
 * Backing service for the Examination Board wing of the Organization Admin
 * portal. Every method is scoped to the caller's `organizationId` so an org
 * admin can only ever see or touch their own organization's exam-board data.
 */
@Injectable()
export class ExamBoardService {
  private readonly schoolRepo: Repository<School>;
  private readonly courseRepo: Repository<ExamBoardCourse>;
  private readonly yearRepo: Repository<ExamBoardAcademicYear>;
  private readonly institutionRepo: Repository<ExamBoardInstitution>;
  private readonly institutionCourseRepo: Repository<ExamBoardInstitutionCourse>;
  private readonly institutionYearRepo: Repository<ExamBoardInstitutionAcademicYear>;
  private readonly batchRepo: Repository<ExamBoardBatch>;
  private readonly schemeRepo: Repository<ExamBoardScheme>;
  private readonly subjectRepo: Repository<ExamBoardSubject>;
  private readonly batchTermSubjectRepo: Repository<ExamBoardBatchTermSubject>;
  private readonly schemeTermSubjectRepo: Repository<ExamBoardSchemeTermSubject>;
  private readonly schemeSyllabusRepo: Repository<ExamBoardSchemeSyllabus>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly tenantSchema: TenantSchemaService,
    private readonly storage: StorageService,
  ) {
    this.schoolRepo = ds.getRepository(School);
    this.courseRepo = ds.getRepository(ExamBoardCourse);
    this.yearRepo = ds.getRepository(ExamBoardAcademicYear);
    this.institutionRepo = ds.getRepository(ExamBoardInstitution);
    this.institutionCourseRepo = ds.getRepository(ExamBoardInstitutionCourse);
    this.institutionYearRepo = ds.getRepository(
      ExamBoardInstitutionAcademicYear,
    );
    this.batchRepo = ds.getRepository(ExamBoardBatch);
    this.schemeRepo = ds.getRepository(ExamBoardScheme);
    this.subjectRepo = ds.getRepository(ExamBoardSubject);
    this.batchTermSubjectRepo = ds.getRepository(ExamBoardBatchTermSubject);
    this.schemeTermSubjectRepo = ds.getRepository(ExamBoardSchemeTermSubject);
    this.schemeSyllabusRepo = ds.getRepository(ExamBoardSchemeSyllabus);
  }

  // ─── Institutions (the org's existing schools, copied into Exam Board) ────

  async listInstitutions(organizationId: string) {
    const [schools, links] = await Promise.all([
      this.schoolRepo.find({ where: { organizationId }, order: { name: 'ASC' } }),
      this.institutionRepo.find({ where: { organizationId } }),
    ]);
    const linkBySchoolId = new Map(links.map((l) => [l.schoolId, l]));
    return schools.map((school) => ({
      school,
      isEnabled: linkBySchoolId.get(school.id)?.isEnabled ?? false,
    }));
  }

  /** "Copy" a school from the Organizations level into the Exam Board wing. */
  async setInstitutionEnabled(
    organizationId: string,
    schoolId: string,
    isEnabled: boolean,
  ) {
    await this.assertSchoolInOrg(organizationId, schoolId);
    let link = await this.institutionRepo.findOne({ where: { schoolId } });
    if (!link) {
      link = this.institutionRepo.create({ organizationId, schoolId });
    }
    link.isEnabled = isEnabled;
    const saved = await this.institutionRepo.save(link);
    if (isEnabled) {
      await this.syncInstitutionMirror(organizationId, schoolId);
    }
    return saved;
  }

  /** Re-run the course/subject mirror sync for every currently-enabled institution. */
  async resyncAllInstitutions() {
    const links = await this.institutionRepo.find({ where: { isEnabled: true } });
    let synced = 0;
    for (const link of links) {
      await this.syncInstitutionMirror(link.organizationId, link.schoolId);
      synced++;
    }
    return { institutionsSynced: synced };
  }

  private async isInstitutionEnabled(schoolId: string): Promise<boolean> {
    const link = await this.institutionRepo.findOne({ where: { schoolId } });
    return link?.isEnabled ?? false;
  }

  async assertSchoolInOrg(organizationId: string, schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('School not found');
    if (school.organizationId !== organizationId) {
      throw new ForbiddenException('School is not in your organization');
    }
    return school;
  }

  // ─── Course master ─────────────────────────────────────────────────────────

  listCourses(organizationId: string) {
    return this.courseRepo.find({
      where: { organizationId },
      order: { name: 'ASC' },
    });
  }

  createCourse(organizationId: string, dto: CreateExamBoardCourseDto) {
    const course = this.courseRepo.create({ ...dto, organizationId });
    return this.courseRepo.save(course);
  }

  async updateCourse(
    organizationId: string,
    id: string,
    dto: UpdateExamBoardCourseDto,
  ) {
    const course = await this.getOrgCourse(organizationId, id);
    Object.assign(course, dto);
    return this.courseRepo.save(course);
  }

  async removeCourse(organizationId: string, id: string) {
    const course = await this.getOrgCourse(organizationId, id);
    const batchCount = await this.batchRepo.count({ where: { examBoardCourseId: id } });
    if (batchCount > 0) {
      throw new BadRequestException(
        `Cannot delete — ${batchCount} batch(es) use this course. Delete them first.`,
      );
    }
    await this.institutionCourseRepo.delete({ examBoardCourseId: id });
    await this.subjectRepo.delete({ examBoardCourseId: id });
    await this.schemeRepo.delete({ examBoardCourseId: id });
    await this.courseRepo.remove(course);
    return { deleted: true, id };
  }

  async getOrgCourse(organizationId: string, id: string) {
    const course = await this.courseRepo.findOne({ where: { id } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.organizationId !== organizationId) {
      throw new ForbiddenException('Course is not in your organization');
    }
    return course;
  }

  /**
   * List an institution's own locally-created courses (not already mirrored
   * from the org master) so the org admin can copy them into the Exam Board
   * course catalog instead of re-typing them. Deduplicated by name, since a
   * course repeats once per academic year in the tenant schema.
   */
  async listInstitutionLocalCourses(organizationId: string, schoolId: string) {
    const school = await this.assertSchoolInOrg(organizationId, schoolId);
    const existingMaster = await this.courseRepo.find({ where: { organizationId } });
    const existingNames = new Set(existingMaster.map((c) => c.name.trim().toLowerCase()));

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const courses = await em.getRepository(TenantCourse).find({
        where: { schoolId, examBoardCourseId: IsNull() },
        order: { name: 'ASC' },
      });
      const seen = new Set<string>();
      const candidates: {
        id: string;
        name: string;
        code: string | null;
        level: string;
        termSystem: string;
        durationYears: number;
        alreadyInMaster: boolean;
      }[] = [];
      for (const course of courses) {
        const key = course.name.trim().toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({
          id: course.id,
          name: course.name,
          code: course.code,
          level: course.level,
          termSystem: course.termSystem,
          durationYears: course.durationYears,
          alreadyInMaster: existingNames.has(key),
        });
      }
      return candidates;
    });
  }

  /** Copy the given (locally-created) courses of an institution into the org's Exam Board course master. */
  async importInstitutionCourses(
    organizationId: string,
    schoolId: string,
    courseIds: string[],
  ) {
    const school = await this.assertSchoolInOrg(organizationId, schoolId);
    if (!courseIds.length) {
      throw new BadRequestException('Select at least one course to copy');
    }
    const localCourses = await this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      return em.getRepository(TenantCourse).find({
        where: { id: In(courseIds), schoolId },
      });
    });
    if (!localCourses.length) {
      throw new BadRequestException('No matching courses found for this institution');
    }

    const existingMaster = await this.courseRepo.find({ where: { organizationId } });
    const existingNames = new Set(existingMaster.map((c) => c.name.trim().toLowerCase()));

    let created = 0;
    let skipped = 0;
    for (const course of localCourses) {
      const key = course.name.trim().toLowerCase();
      if (existingNames.has(key)) {
        skipped++;
        continue;
      }
      existingNames.add(key);
      await this.courseRepo.save(
        this.courseRepo.create({
          organizationId,
          name: course.name,
          code: course.code,
          level: course.level,
          termSystem: course.termSystem,
          durationYears: course.durationYears,
        }),
      );
      created++;
    }
    return { created, skipped };
  }

  // ─── Academic year master ──────────────────────────────────────────────────

  listAcademicYears(organizationId: string) {
    return this.yearRepo.find({
      where: { organizationId },
      order: { startDate: 'DESC' },
    });
  }

  createAcademicYear(
    organizationId: string,
    dto: CreateExamBoardAcademicYearDto,
  ) {
    const year = this.yearRepo.create({ ...dto, organizationId });
    return this.yearRepo.save(year);
  }

  async updateAcademicYear(
    organizationId: string,
    id: string,
    dto: UpdateExamBoardAcademicYearDto,
  ) {
    const year = await this.getOrgYear(organizationId, id);
    Object.assign(year, dto);
    return this.yearRepo.save(year);
  }

  async setCurrentAcademicYear(organizationId: string, id: string) {
    const year = await this.getOrgYear(organizationId, id);
    await this.yearRepo.update({ organizationId }, { isCurrent: false });
    year.isCurrent = true;
    return this.yearRepo.save(year);
  }

  async removeAcademicYear(organizationId: string, id: string) {
    const year = await this.getOrgYear(organizationId, id);
    const batchCount = await this.batchRepo.count({
      where: { examBoardAcademicYearId: id },
    });
    if (batchCount > 0) {
      throw new BadRequestException(
        `Cannot delete — ${batchCount} batch(es) use this academic year. Delete them first.`,
      );
    }
    await this.institutionYearRepo.delete({ examBoardAcademicYearId: id });
    await this.yearRepo.remove(year);
    return { deleted: true, id };
  }

  private async getOrgYear(organizationId: string, id: string) {
    const year = await this.yearRepo.findOne({ where: { id } });
    if (!year) throw new NotFoundException('Academic year not found');
    if (year.organizationId !== organizationId) {
      throw new ForbiddenException('Academic year is not in your organization');
    }
    return year;
  }

  // ─── Per-institution enablement ────────────────────────────────────────────

  async listInstitutionCourses(organizationId: string, schoolId: string) {
    await this.assertSchoolInOrg(organizationId, schoolId);
    const [courses, links] = await Promise.all([
      this.listCourses(organizationId),
      this.institutionCourseRepo.find({ where: { schoolId } }),
    ]);
    const linkByCourseId = new Map(
      links.map((l) => [l.examBoardCourseId, l]),
    );
    return courses.map((course) => ({
      course,
      isEnabled: linkByCourseId.get(course.id)?.isEnabled ?? false,
    }));
  }

  async setInstitutionCourse(
    organizationId: string,
    schoolId: string,
    courseId: string,
    dto: SetInstitutionEnablementDto,
  ) {
    await this.assertSchoolInOrg(organizationId, schoolId);
    await this.getOrgCourse(organizationId, courseId);
    let link = await this.institutionCourseRepo.findOne({
      where: { schoolId, examBoardCourseId: courseId },
    });
    if (!link) {
      link = this.institutionCourseRepo.create({
        organizationId,
        schoolId,
        examBoardCourseId: courseId,
      });
    }
    link.isEnabled = dto.isEnabled;
    const saved = await this.institutionCourseRepo.save(link);
    if (dto.isEnabled && (await this.isInstitutionEnabled(schoolId))) {
      await this.syncInstitutionMirror(organizationId, schoolId);
    }
    return saved;
  }

  async listInstitutionAcademicYears(organizationId: string, schoolId: string) {
    await this.assertSchoolInOrg(organizationId, schoolId);
    const [years, links] = await Promise.all([
      this.listAcademicYears(organizationId),
      this.institutionYearRepo.find({ where: { schoolId } }),
    ]);
    const linkByYearId = new Map(
      links.map((l) => [l.examBoardAcademicYearId, l]),
    );
    return years.map((year) => ({
      academicYear: year,
      isEnabled: linkByYearId.get(year.id)?.isEnabled ?? false,
    }));
  }

  async setInstitutionAcademicYear(
    organizationId: string,
    schoolId: string,
    yearId: string,
    dto: SetInstitutionEnablementDto,
  ) {
    await this.assertSchoolInOrg(organizationId, schoolId);
    await this.getOrgYear(organizationId, yearId);
    let link = await this.institutionYearRepo.findOne({
      where: { schoolId, examBoardAcademicYearId: yearId },
    });
    if (!link) {
      link = this.institutionYearRepo.create({
        organizationId,
        schoolId,
        examBoardAcademicYearId: yearId,
      });
    }
    link.isEnabled = dto.isEnabled;
    const saved = await this.institutionYearRepo.save(link);
    if (dto.isEnabled && (await this.isInstitutionEnabled(schoolId))) {
      await this.syncInstitutionMirror(organizationId, schoolId);
    }
    return saved;
  }

  // ─── Mirror sync: local Academic Year/Course rows for enabled institutions ─
  //
  // Exam-board-enabled colleges no longer create their own Academic
  // Years/Courses — the local tenant rows are upserted here from the org
  // master so every other tenant module (classes, attendance, fees, exams…)
  // keeps working against ordinary local FKs, while the *content* of those
  // rows is entirely org-driven. One local Course row is materialized per
  // enabled (course × academic year) pair, since a course's classes are
  // generated per-year locally.

  private async syncInstitutionMirror(organizationId: string, schoolId: string) {
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) return;

    const [courseLinks, yearLinks] = await Promise.all([
      this.institutionCourseRepo.find({ where: { schoolId, isEnabled: true } }),
      this.institutionYearRepo.find({ where: { schoolId, isEnabled: true } }),
    ]);
    if (!courseLinks.length || !yearLinks.length) return;

    const [courses, years] = await Promise.all([
      this.courseRepo.find({
        where: { id: In(courseLinks.map((l) => l.examBoardCourseId)) },
      }),
      this.yearRepo.find({
        where: { id: In(yearLinks.map((l) => l.examBoardAcademicYearId)) },
      }),
    ]);

    await this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const yearRepo = em.getRepository(TenantAcademicYear);
      const courseRepo = em.getRepository(TenantCourse);

      const localYearByMasterId = new Map<string, TenantAcademicYear>();
      for (const year of years) {
        let local = await yearRepo.findOne({
          where: { schoolId, examBoardAcademicYearId: year.id },
        });
        if (!local) {
          local = yearRepo.create({
            schoolId,
            examBoardAcademicYearId: year.id,
          });
        }
        local.name = year.name;
        local.startDate = year.startDate as unknown as Date;
        local.endDate = year.endDate as unknown as Date;
        local.isCurrent = year.isCurrent;
        local = await yearRepo.save(local);
        localYearByMasterId.set(year.id, local);
      }

      for (const course of courses) {
        for (const year of years) {
          const localYear = localYearByMasterId.get(year.id);
          if (!localYear) continue;
          let local = await courseRepo.findOne({
            where: {
              schoolId,
              academicYearId: localYear.id,
              examBoardCourseId: course.id,
            },
          });
          if (!local) {
            local = courseRepo.create({
              schoolId,
              academicYearId: localYear.id,
              examBoardCourseId: course.id,
            });
          }
          local.level = course.level;
          local.name = course.name;
          local.code = course.code;
          local.termSystem = course.termSystem;
          local.durationYears = course.durationYears;
          local = await courseRepo.save(local);
          const classesByTerm = await this.generateMirroredClasses(em, schoolId, local);
          await this.mirrorSubjectsForCourse(
            em,
            schoolId,
            course.id,
            classesByTerm,
          );
        }
      }
    });
  }

  /** Materialize a mirrored course's classes (Year/Semester/Trimester 1..N). */
  private async generateMirroredClasses(
    em: EntityManager,
    schoolId: string,
    course: TenantCourse,
  ): Promise<Map<number, TenantClass>> {
    const perYear =
      course.termSystem === 'semester' ? 2 : course.termSystem === 'trimester' ? 3 : 1;
    const label =
      course.termSystem === 'semester'
        ? 'Semester'
        : course.termSystem === 'trimester'
          ? 'Trimester'
          : 'Year';
    const count = Math.max(1, course.durationYears) * perYear;
    const classRepo = em.getRepository(TenantClass);
    const classesByTerm = new Map<number, TenantClass>();
    for (let n = 1; n <= count; n++) {
      const name = `${label} ${n}`;
      let cls = await classRepo.findOne({
        where: {
          schoolId,
          academicYearId: course.academicYearId,
          courseId: course.id,
          name,
        },
      });
      if (!cls) {
        cls = await classRepo.save(
          classRepo.create({
            schoolId,
            academicYearId: course.academicYearId,
            courseId: course.id,
            name,
            orderIndex: n,
          }),
        );
      }
      classesByTerm.set(n, cls);
    }
    return classesByTerm;
  }

  /**
   * Mirror the org's Subject master into the local `subjects` table, one row
   * per subject × its term's mirrored Class — the same reason Course/Academic
   * Year are mirrored: exam-board-managed colleges shouldn't hand-maintain
   * subjects that duplicate the org's curriculum.
   */
  private async mirrorSubjectsForCourse(
    em: EntityManager,
    schoolId: string,
    masterCourseId: string,
    classesByTerm: Map<number, TenantClass>,
  ) {
    const masterSubjects = await this.subjectRepo.find({
      where: { examBoardCourseId: masterCourseId, isActive: true },
    });
    if (!masterSubjects.length) return;

    const subjectRepo = em.getRepository(TenantSubject);
    for (const subject of masterSubjects) {
      const cls = classesByTerm.get(subject.termNumber);
      if (!cls) continue;
      let local = await subjectRepo.findOne({
        where: { schoolId, examBoardSubjectId: subject.id, classId: cls.id },
      });
      if (!local) {
        local = subjectRepo.create({
          schoolId,
          classId: cls.id,
          examBoardSubjectId: subject.id,
        });
      }
      local.name = subject.name;
      local.code = subject.code ?? subject.name.slice(0, 20);
      local.maxMarks = subject.maxMarks;
      local.passMarks = subject.passMarks;
      local.ceMaxMarks = subject.ceMaxMarks;
      local.cePassMarks = subject.cePassMarks;
      await subjectRepo.save(local);
    }
  }

  // ─── Batches ────────────────────────────────────────────────────────────────

  async listBatches(
    organizationId: string,
    filters: { schoolId?: string; examBoardCourseId?: string; examBoardAcademicYearId?: string },
  ) {
    return this.batchRepo.find({
      where: { organizationId, ...filters },
      order: { name: 'ASC' },
    });
  }

  async createBatch(organizationId: string, dto: CreateExamBoardBatchDto) {
    await this.assertSchoolInOrg(organizationId, dto.schoolId);
    const course = await this.getOrgCourse(organizationId, dto.examBoardCourseId);
    await this.getOrgYear(organizationId, dto.examBoardAcademicYearId);
    if (dto.examBoardSchemeId) {
      await this.getOrgScheme(organizationId, dto.examBoardSchemeId);
    }
    if (dto.currentTermNumber) {
      this.assertValidTerm(course, dto.currentTermNumber);
    }
    const batch = this.batchRepo.create({ ...dto, organizationId });
    return this.batchRepo.save(batch);
  }

  async updateBatch(
    organizationId: string,
    id: string,
    dto: UpdateExamBoardBatchDto,
  ) {
    const batch = await this.getOrgBatch(organizationId, id);
    if (dto.examBoardSchemeId) {
      await this.getOrgScheme(organizationId, dto.examBoardSchemeId);
    }
    if (dto.currentTermNumber) {
      const course = await this.getOrgCourse(organizationId, batch.examBoardCourseId);
      this.assertValidTerm(course, dto.currentTermNumber);
    }
    Object.assign(batch, dto);
    return this.batchRepo.save(batch);
  }

  async removeBatch(organizationId: string, id: string) {
    const batch = await this.getOrgBatch(organizationId, id);
    await this.batchTermSubjectRepo.delete({ examBoardBatchId: id });
    await this.batchRepo.remove(batch);
    return { deleted: true, id };
  }

  private async getOrgBatch(organizationId: string, id: string) {
    const batch = await this.batchRepo.findOne({ where: { id } });
    if (!batch) throw new NotFoundException('Batch not found');
    if (batch.organizationId !== organizationId) {
      throw new ForbiddenException('Batch is not in your organization');
    }
    return batch;
  }

  async getBatch(organizationId: string, id: string) {
    return this.getOrgBatch(organizationId, id);
  }

  /** Enrolled students for a batch, read from the batch's own school schema. */
  async listBatchEnrollments(organizationId: string, batchId: string) {
    const batch = await this.getOrgBatch(organizationId, batchId);
    const school = await this.schoolRepo.findOne({ where: { id: batch.schoolId } });
    if (!school) throw new NotFoundException('Institution not found');

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const enrollments = await em.getRepository(TenantExamBoardEnrollment).find({
        where: { schoolId: batch.schoolId, examBoardBatchId: batchId, status: 'active' },
        order: { enrollmentDate: 'DESC' },
      });
      if (!enrollments.length) return [];
      const students = await em.getRepository(TenantStudent).find({
        where: { id: In(enrollments.map((e) => e.studentId)) },
      });
      const byId = new Map(students.map((s) => [s.id, s]));
      return enrollments.map((e) => ({
        ...e,
        student: byId.get(e.studentId) ?? null,
      }));
    });
  }

  /** Every exam across every batch in the org, with optional filters. */
  async listOrgExams(
    organizationId: string,
    filters: {
      examBoardBatchId?: string;
      termNumber?: number;
      examType?: string;
      examCategory?: string;
      status?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ) {
    const batchWhere: Record<string, unknown> = { organizationId };
    if (filters.examBoardBatchId) batchWhere.id = filters.examBoardBatchId;
    const batches = await this.batchRepo.find({ where: batchWhere });
    if (batches.length === 0) return [];

    const batchById = new Map(batches.map((b) => [b.id, b]));
    const schoolIds = [...new Set(batches.map((b) => b.schoolId))];
    const schools = await this.schoolRepo.find({ where: { id: In(schoolIds) } });

    const results: (TenantExamBoardExam & {
      batchName: string;
      examBoardCourseId: string;
      schoolId: string;
    })[] = [];

    for (const school of schools) {
      const batchIds = batches.filter((b) => b.schoolId === school.id).map((b) => b.id);
      if (batchIds.length === 0) continue;

      const rows = await this.tenantSchema.runInSchema(school.schemaName, async (em) => {
        const qb = em
          .getRepository(TenantExamBoardExam)
          .createQueryBuilder('e')
          .where('e.exam_board_batch_id IN (:...batchIds)', { batchIds });
        if (filters.termNumber) qb.andWhere('e.term_number = :termNumber', { termNumber: filters.termNumber });
        if (filters.examType) qb.andWhere('e.exam_type = :examType', { examType: filters.examType });
        if (filters.examCategory) qb.andWhere('e.exam_category = :examCategory', { examCategory: filters.examCategory });
        if (filters.status) qb.andWhere('e.status = :status', { status: filters.status });
        if (filters.dateFrom) qb.andWhere('e.start_date >= :dateFrom', { dateFrom: filters.dateFrom });
        if (filters.dateTo) qb.andWhere('e.start_date <= :dateTo', { dateTo: filters.dateTo });
        qb.orderBy('e.start_date', 'DESC');
        return qb.getMany();
      });

      for (const row of rows) {
        const batch = batchById.get(row.examBoardBatchId);
        results.push({
          ...row,
          batchName: batch?.name ?? '',
          examBoardCourseId: batch?.examBoardCourseId ?? '',
          schoolId: school.id,
        });
      }
    }

    results.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    return results;
  }

  /** Exams scheduled by the college for a batch, read from that school's schema. */
  async listBatchExams(organizationId: string, batchId: string) {
    const batch = await this.getOrgBatch(organizationId, batchId);
    const school = await this.schoolRepo.findOne({ where: { id: batch.schoolId } });
    if (!school) throw new NotFoundException('Institution not found');

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      return em.getRepository(TenantExamBoardExam).find({
        where: { schoolId: batch.schoolId, examBoardBatchId: batchId },
        order: { startDate: 'DESC' },
      });
    });
  }

  /** Subject-wise (paper-wise) schedule within one of the batch's exams. */
  async listBatchExamSubjects(organizationId: string, batchId: string, examId: string) {
    const batch = await this.getOrgBatch(organizationId, batchId);
    const school = await this.schoolRepo.findOne({ where: { id: batch.schoolId } });
    if (!school) throw new NotFoundException('Institution not found');

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const exam = await em.getRepository(TenantExamBoardExam).findOne({
        where: { id: examId, schoolId: batch.schoolId, examBoardBatchId: batchId },
      });
      if (!exam) throw new NotFoundException('Exam not found');
      return em.getRepository(TenantExamBoardExamSubject).find({
        where: { examBoardExamId: examId },
        order: { date: 'ASC', subjectName: 'ASC' },
      });
    });
  }

  /** Org admin schedules an exam for a batch — writes into that batch's own school schema. */
  async createBatchExam(organizationId: string, batchId: string, dto: CreateBatchExamDto) {
    const batch = await this.getOrgBatch(organizationId, batchId);
    const course = await this.getOrgCourse(organizationId, batch.examBoardCourseId);
    this.assertValidTerm(course, dto.termNumber);
    const category = dto.examCategory ?? 'regular';
    if (category === 'regular' && dto.termNumber !== (batch.currentTermNumber ?? 1)) {
      throw new BadRequestException(
        `Regular exams can only be scheduled for the batch's current term (Term ${batch.currentTermNumber ?? 1}). Use category "supplementary" to schedule for another term.`,
      );
    }
    const school = await this.schoolRepo.findOne({ where: { id: batch.schoolId } });
    if (!school) throw new NotFoundException('Institution not found');

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const repo = em.getRepository(TenantExamBoardExam);
      return repo.save(
        repo.create({
          schoolId: batch.schoolId,
          examBoardBatchId: batchId,
          termNumber: dto.termNumber,
          name: dto.name,
          examType: dto.examType,
          examCategory: dto.examCategory ?? 'regular',
          startDate: dto.startDate as unknown as Date,
          endDate: dto.endDate as unknown as Date,
          status: dto.status ?? 'scheduled',
        }),
      );
    });
  }

  /** Org admin adds a subject/paper (with date + time) to a batch's exam. */
  async addBatchExamSubject(
    organizationId: string,
    batchId: string,
    examId: string,
    dto: CreateBatchExamSubjectDto,
  ) {
    const batch = await this.getOrgBatch(organizationId, batchId);
    const school = await this.schoolRepo.findOne({ where: { id: batch.schoolId } });
    if (!school) throw new NotFoundException('Institution not found');

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const exam = await em.getRepository(TenantExamBoardExam).findOne({
        where: { id: examId, schoolId: batch.schoolId, examBoardBatchId: batchId },
      });
      if (!exam) throw new NotFoundException('Exam not found');

      const repo = em.getRepository(TenantExamBoardExamSubject);
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

  /** Update a subject/paper already scheduled within a batch's exam (e.g. its date/time). */
  async updateBatchExamSubject(
    organizationId: string,
    batchId: string,
    examId: string,
    subjectId: string,
    dto: UpdateBatchExamSubjectDto,
  ) {
    const batch = await this.getOrgBatch(organizationId, batchId);
    const school = await this.schoolRepo.findOne({ where: { id: batch.schoolId } });
    if (!school) throw new NotFoundException('Institution not found');

    return this.tenantSchema.runInSchema(school.schemaName, async (em) => {
      const exam = await em.getRepository(TenantExamBoardExam).findOne({
        where: { id: examId, schoolId: batch.schoolId, examBoardBatchId: batchId },
      });
      if (!exam) throw new NotFoundException('Exam not found');

      const repo = em.getRepository(TenantExamBoardExamSubject);
      const subject = await repo.findOne({ where: { id: subjectId, examBoardExamId: examId } });
      if (!subject) throw new NotFoundException('Exam subject not found');
      Object.assign(subject, {
        ...dto,
        date: dto.date !== undefined ? (dto.date as unknown as Date) : subject.date,
      });
      return repo.save(subject);
    });
  }

  // ─── Schemes ────────────────────────────────────────────────────────────────

  listSchemes(organizationId: string, examBoardCourseId?: string) {
    return this.schemeRepo.find({
      where: { organizationId, ...(examBoardCourseId ? { examBoardCourseId } : {}) },
      order: { name: 'ASC' },
    });
  }

  async createScheme(organizationId: string, dto: CreateExamBoardSchemeDto) {
    await this.getOrgCourse(organizationId, dto.examBoardCourseId);
    if (dto.startingAcademicYearId) {
      await this.getOrgYear(organizationId, dto.startingAcademicYearId);
    }
    const scheme = this.schemeRepo.create({ ...dto, organizationId });
    return this.schemeRepo.save(scheme);
  }

  async updateScheme(
    organizationId: string,
    id: string,
    dto: UpdateExamBoardSchemeDto,
  ) {
    const scheme = await this.getOrgScheme(organizationId, id);
    if (dto.startingAcademicYearId) {
      await this.getOrgYear(organizationId, dto.startingAcademicYearId);
    }
    Object.assign(scheme, dto);
    return this.schemeRepo.save(scheme);
  }

  async removeScheme(organizationId: string, id: string) {
    const scheme = await this.getOrgScheme(organizationId, id);
    const batchCount = await this.batchRepo.count({ where: { examBoardSchemeId: id } });
    if (batchCount > 0) {
      throw new BadRequestException(
        `Cannot delete — ${batchCount} batch(es) use this scheme. Unassign them first.`,
      );
    }
    await this.schemeTermSubjectRepo.delete({ examBoardSchemeId: id });
    await this.schemeRepo.remove(scheme);
    return { deleted: true, id };
  }

  private async getOrgScheme(organizationId: string, id: string) {
    const scheme = await this.schemeRepo.findOne({ where: { id } });
    if (!scheme) throw new NotFoundException('Scheme not found');
    if (scheme.organizationId !== organizationId) {
      throw new ForbiddenException('Scheme is not in your organization');
    }
    return scheme;
  }

  // ─── Subjects ───────────────────────────────────────────────────────────────

  listSubjects(
    organizationId: string,
    examBoardCourseId?: string,
    termNumber?: number,
  ) {
    return this.subjectRepo.find({
      where: {
        organizationId,
        ...(examBoardCourseId ? { examBoardCourseId } : {}),
        ...(termNumber ? { termNumber } : {}),
      },
      order: { termNumber: 'ASC', name: 'ASC' },
    });
  }

  async listSubjectsPaginated(
    organizationId: string,
    filters: {
      examBoardCourseId?: string;
      termNumber?: number;
      page?: number;
      limit?: number;
      search?: string;
    },
  ) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
    const base = {
      organizationId,
      ...(filters.examBoardCourseId ? { examBoardCourseId: filters.examBoardCourseId } : {}),
      ...(filters.termNumber ? { termNumber: filters.termNumber } : {}),
    };
    const where = filters.search
      ? [
          { ...base, name: ILike(`%${filters.search}%`) },
          { ...base, nameArabic: ILike(`%${filters.search}%`) },
          { ...base, code: ILike(`%${filters.search}%`) },
        ]
      : base;
    const [items, total] = await this.subjectRepo.findAndCount({
      where,
      order: { termNumber: 'ASC', name: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return paginate(items, total, page, limit);
  }

  async createSubject(organizationId: string, dto: CreateExamBoardSubjectDto) {
    const course = await this.getOrgCourse(organizationId, dto.examBoardCourseId);
    this.assertValidTerm(course, dto.termNumber);
    const subject = this.subjectRepo.create({ ...dto, organizationId });
    const saved = await this.subjectRepo.save(subject);
    await this.syncInstitutionsForCourse(organizationId, dto.examBoardCourseId);
    return saved;
  }

  async updateSubject(
    organizationId: string,
    id: string,
    dto: UpdateExamBoardSubjectDto,
  ) {
    const subject = await this.getOrgSubject(organizationId, id);
    if (dto.termNumber) {
      const course = await this.getOrgCourse(
        organizationId,
        subject.examBoardCourseId,
      );
      this.assertValidTerm(course, dto.termNumber);
    }
    Object.assign(subject, dto);
    const saved = await this.subjectRepo.save(subject);
    await this.syncInstitutionsForCourse(organizationId, subject.examBoardCourseId);
    return saved;
  }

  /** Re-mirror every institution that currently has this course enabled. */
  async syncInstitutionsForCourse(
    organizationId: string,
    examBoardCourseId: string,
  ) {
    const courseLinks = await this.institutionCourseRepo.find({
      where: { examBoardCourseId, isEnabled: true },
    });
    for (const link of courseLinks) {
      if (await this.isInstitutionEnabled(link.schoolId)) {
        await this.syncInstitutionMirror(organizationId, link.schoolId);
      }
    }
  }

  async removeSubject(organizationId: string, id: string) {
    const subject = await this.getOrgSubject(organizationId, id);
    await this.batchTermSubjectRepo.delete({ examBoardSubjectId: id });
    await this.schemeTermSubjectRepo.delete({ examBoardSubjectId: id });
    await this.subjectRepo.remove(subject);
    await this.syncInstitutionsForCourse(organizationId, subject.examBoardCourseId);
    return { deleted: true, id };
  }

  private async getOrgSubject(organizationId: string, id: string) {
    const subject = await this.subjectRepo.findOne({ where: { id } });
    if (!subject) throw new NotFoundException('Subject not found');
    if (subject.organizationId !== organizationId) {
      throw new ForbiddenException('Subject is not in your organization');
    }
    return subject;
  }

  // ─── Course term structure (Year/Semester/Trimester 1..N) ─────────────────

  async listCourseTerms(organizationId: string, courseId: string) {
    const course = await this.getOrgCourse(organizationId, courseId);
    return this.termsForCourse(course);
  }

  termsForCourse(course: {
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

  // ─── Batch curriculum: subjects assigned per term ──────────────────────────

  async listBatchTermSubjects(
    organizationId: string,
    batchId: string,
    termNumber: number,
  ) {
    const batch = await this.getOrgBatch(organizationId, batchId);
    const course = await this.getOrgCourse(organizationId, batch.examBoardCourseId);
    this.assertValidTerm(course, termNumber);
    const [subjects, assignments] = await Promise.all([
      this.subjectRepo.find({
        where: { examBoardCourseId: batch.examBoardCourseId, termNumber },
        order: { name: 'ASC' },
      }),
      this.batchTermSubjectRepo.find({
        where: { examBoardBatchId: batchId, termNumber },
      }),
    ]);
    const assignedIds = new Set(assignments.map((a) => a.examBoardSubjectId));
    return subjects.map((subject) => ({
      subject,
      isAssigned: assignedIds.has(subject.id),
    }));
  }

  async setBatchTermSubjects(
    organizationId: string,
    batchId: string,
    termNumber: number,
    dto: SetBatchTermSubjectsDto,
  ) {
    const batch = await this.getOrgBatch(organizationId, batchId);
    const course = await this.getOrgCourse(organizationId, batch.examBoardCourseId);
    this.assertValidTerm(course, termNumber);

    if (dto.examBoardSubjectIds.length) {
      const validSubjects = await this.subjectRepo.find({
        where: {
          id: In(dto.examBoardSubjectIds),
          examBoardCourseId: batch.examBoardCourseId,
          termNumber,
        },
      });
      if (validSubjects.length !== dto.examBoardSubjectIds.length) {
        throw new BadRequestException(
          'One or more subjects do not belong to this course/term',
        );
      }
    }

    await this.batchTermSubjectRepo.delete({
      examBoardBatchId: batchId,
      termNumber,
    });
    if (!dto.examBoardSubjectIds.length) return { assigned: 0 };

    const rows = dto.examBoardSubjectIds.map((examBoardSubjectId) =>
      this.batchTermSubjectRepo.create({
        examBoardBatchId: batchId,
        termNumber,
        examBoardSubjectId,
      }),
    );
    const saved = await this.batchTermSubjectRepo.save(rows);
    return { assigned: saved.length };
  }

  // ─── Scheme curriculum: subjects assigned per term ─────────────────────────
  // The scheme-level assignment is the source of truth for a course's
  // curriculum — defined once here instead of duplicated across every batch
  // that adopts the scheme. (Batch-level assignment above still exists for
  // batches with no scheme, or ones that want a one-off deviation.)

  async listSchemeTermSubjects(
    organizationId: string,
    schemeId: string,
    termNumber: number,
  ) {
    const scheme = await this.getOrgScheme(organizationId, schemeId);
    const course = await this.getOrgCourse(organizationId, scheme.examBoardCourseId);
    this.assertValidTerm(course, termNumber);
    const [subjects, assignments] = await Promise.all([
      this.subjectRepo.find({
        where: { examBoardCourseId: scheme.examBoardCourseId, termNumber },
        order: { name: 'ASC' },
      }),
      this.schemeTermSubjectRepo.find({
        where: { examBoardSchemeId: schemeId, termNumber },
      }),
    ]);
    const assignedIds = new Set(assignments.map((a) => a.examBoardSubjectId));
    return subjects.map((subject) => ({
      subject,
      isAssigned: assignedIds.has(subject.id),
    }));
  }

  async setSchemeTermSubjects(
    organizationId: string,
    schemeId: string,
    termNumber: number,
    dto: SetBatchTermSubjectsDto,
  ) {
    const scheme = await this.getOrgScheme(organizationId, schemeId);
    const course = await this.getOrgCourse(organizationId, scheme.examBoardCourseId);
    this.assertValidTerm(course, termNumber);

    if (dto.examBoardSubjectIds.length) {
      const validSubjects = await this.subjectRepo.find({
        where: {
          id: In(dto.examBoardSubjectIds),
          examBoardCourseId: scheme.examBoardCourseId,
          termNumber,
        },
      });
      if (validSubjects.length !== dto.examBoardSubjectIds.length) {
        throw new BadRequestException(
          'One or more subjects do not belong to this course/term',
        );
      }
    }

    await this.schemeTermSubjectRepo.delete({
      examBoardSchemeId: schemeId,
      termNumber,
    });
    if (!dto.examBoardSubjectIds.length) return { assigned: 0 };

    const rows = dto.examBoardSubjectIds.map((examBoardSubjectId) =>
      this.schemeTermSubjectRepo.create({
        examBoardSchemeId: schemeId,
        termNumber,
        examBoardSubjectId,
      }),
    );
    const saved = await this.schemeTermSubjectRepo.save(rows);
    return { assigned: saved.length };
  }

  /**
   * Maintenance: for every scheme, assign every one of its course's subjects
   * into every term of that course (i.e. fully populate the scheme's
   * curriculum rather than leaving terms unassigned).
   */
  async assignAllSubjectsToAllSchemeTerms() {
    const schemes = await this.schemeRepo.find();
    const courseIds = [...new Set(schemes.map((s) => s.examBoardCourseId))];
    const courses = await this.courseRepo.find({ where: { id: In(courseIds) } });
    const courseById = new Map(courses.map((c) => [c.id, c]));

    let schemesUpdated = 0;
    let assignmentsCreated = 0;
    for (const scheme of schemes) {
      const course = courseById.get(scheme.examBoardCourseId);
      if (!course) continue;
      const terms = this.termsForCourse(course);
      let touchedThisScheme = false;
      for (const term of terms) {
        const subjects = await this.subjectRepo.find({
          where: { examBoardCourseId: scheme.examBoardCourseId, termNumber: term.number },
        });
        if (!subjects.length) continue;
        await this.schemeTermSubjectRepo.delete({
          examBoardSchemeId: scheme.id,
          termNumber: term.number,
        });
        const rows = subjects.map((subject) =>
          this.schemeTermSubjectRepo.create({
            examBoardSchemeId: scheme.id,
            termNumber: term.number,
            examBoardSubjectId: subject.id,
          }),
        );
        const saved = await this.schemeTermSubjectRepo.save(rows);
        assignmentsCreated += saved.length;
        touchedThisScheme = true;
      }
      if (touchedThisScheme) schemesUpdated++;
    }
    return { schemesUpdated, assignmentsCreated };
  }

  /**
   * Maintenance: for every batch, assign every one of its course's subjects
   * into every term of that batch. Scheme-term assignments (above) are just
   * the course-level curriculum template — a batch only actually sees
   * subjects (e.g. when scheduling exams) once they're assigned at the
   * batch-term level, which this populates in one pass.
   */
  async assignAllSubjectsToAllBatchTerms() {
    const batches = await this.batchRepo.find();
    const courseIds = [...new Set(batches.map((b) => b.examBoardCourseId))];
    const courses = await this.courseRepo.find({ where: { id: In(courseIds) } });
    const courseById = new Map(courses.map((c) => [c.id, c]));

    let batchesUpdated = 0;
    let assignmentsCreated = 0;
    for (const batch of batches) {
      const course = courseById.get(batch.examBoardCourseId);
      if (!course) continue;
      const terms = this.termsForCourse(course);
      let touchedThisBatch = false;
      for (const term of terms) {
        const subjects = await this.subjectRepo.find({
          where: { examBoardCourseId: batch.examBoardCourseId, termNumber: term.number },
        });
        if (!subjects.length) continue;
        await this.batchTermSubjectRepo.delete({
          examBoardBatchId: batch.id,
          termNumber: term.number,
        });
        const rows = subjects.map((subject) =>
          this.batchTermSubjectRepo.create({
            examBoardBatchId: batch.id,
            termNumber: term.number,
            examBoardSubjectId: subject.id,
          }),
        );
        const saved = await this.batchTermSubjectRepo.save(rows);
        assignmentsCreated += saved.length;
        touchedThisBatch = true;
      }
      if (touchedThisBatch) batchesUpdated++;
    }
    return { batchesUpdated, assignmentsCreated };
  }

  /** Copy scheme + every term's subject assignments from one batch to another. */
  async copyBatchConfig(
    organizationId: string,
    targetBatchId: string,
    dto: CopyBatchConfigDto,
  ) {
    const target = await this.getOrgBatch(organizationId, targetBatchId);
    const source = await this.getOrgBatch(organizationId, dto.sourceBatchId);
    if (source.examBoardCourseId !== target.examBoardCourseId) {
      throw new BadRequestException(
        'Source batch must be for the same course to copy its configuration',
      );
    }

    if (source.examBoardSchemeId) {
      target.examBoardSchemeId = source.examBoardSchemeId;
      await this.batchRepo.save(target);
    }

    const sourceAssignments = await this.batchTermSubjectRepo.find({
      where: { examBoardBatchId: source.id },
    });
    await this.batchTermSubjectRepo.delete({ examBoardBatchId: target.id });
    if (!sourceAssignments.length) return { copiedSubjects: 0 };

    const rows = sourceAssignments.map((a) =>
      this.batchTermSubjectRepo.create({
        examBoardBatchId: target.id,
        termNumber: a.termNumber,
        examBoardSubjectId: a.examBoardSubjectId,
      }),
    );
    await this.batchTermSubjectRepo.save(rows);
    return { copiedSubjects: rows.length };
  }

  /** Copy every term's subject assignments from one scheme to another (same course only). */
  async copySchemeConfig(
    organizationId: string,
    targetSchemeId: string,
    dto: CopySchemeConfigDto,
  ) {
    const target = await this.getOrgScheme(organizationId, targetSchemeId);
    const source = await this.getOrgScheme(organizationId, dto.sourceSchemeId);
    if (source.examBoardCourseId !== target.examBoardCourseId) {
      throw new BadRequestException(
        'Source scheme must be for the same course to copy its configuration',
      );
    }

    const sourceAssignments = await this.schemeTermSubjectRepo.find({
      where: { examBoardSchemeId: source.id },
    });
    await this.schemeTermSubjectRepo.delete({ examBoardSchemeId: target.id });
    if (!sourceAssignments.length) return { copiedSubjects: 0 };

    const rows = sourceAssignments.map((a) =>
      this.schemeTermSubjectRepo.create({
        examBoardSchemeId: target.id,
        termNumber: a.termNumber,
        examBoardSubjectId: a.examBoardSubjectId,
      }),
    );
    await this.schemeTermSubjectRepo.save(rows);
    return { copiedSubjects: rows.length };
  }

  // ─── Scheme syllabus (PDF per Year/Semester) ───────────────────────────────

  async listSchemeSyllabi(organizationId: string, schemeId: string) {
    await this.getOrgScheme(organizationId, schemeId);
    return this.schemeSyllabusRepo.find({
      where: { examBoardSchemeId: schemeId },
      order: { termNumber: 'ASC' },
    });
  }

  async uploadSchemeSyllabus(
    organizationId: string,
    schemeId: string,
    termNumber: number,
    file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
  ) {
    const scheme = await this.getOrgScheme(organizationId, schemeId);
    const course = await this.getOrgCourse(organizationId, scheme.examBoardCourseId);
    this.assertValidTerm(course, termNumber);

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Syllabus must be a PDF file');
    }

    const key = `exam-board/syllabus/${schemeId}/term-${termNumber}-${Date.now()}.pdf`;
    const url = await this.storage.save(key, file.buffer);

    let row = await this.schemeSyllabusRepo.findOne({
      where: { examBoardSchemeId: schemeId, termNumber },
    });
    const previousUrl = row?.fileUrl;
    if (!row) {
      row = this.schemeSyllabusRepo.create({ examBoardSchemeId: schemeId, termNumber });
    }
    row.fileUrl = url;
    row.fileName = file.originalname;
    row.fileSize = file.size;
    const saved = await this.schemeSyllabusRepo.save(row);
    if (previousUrl) {
      await this.storage.deleteByUrl(previousUrl);
    }
    return saved;
  }

  async removeSchemeSyllabus(organizationId: string, schemeId: string, termNumber: number) {
    await this.getOrgScheme(organizationId, schemeId);
    const row = await this.schemeSyllabusRepo.findOne({
      where: { examBoardSchemeId: schemeId, termNumber },
    });
    if (!row) throw new NotFoundException('Syllabus not found for this term');
    await this.schemeSyllabusRepo.remove(row);
    await this.storage.deleteByUrl(row.fileUrl);
    return { deleted: true };
  }
}
