import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { AcademicYear } from '../../../database/tenant/academic-year.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Course } from '../../../database/tenant/course.entity';
import { Section } from '../../../database/tenant/section.entity';
import { Student } from '../../../database/tenant/student.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { Promotion } from '../../../database/tenant/promotion.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { BulkEnrollDto, PromoteDto } from './dto/academics.dto';

@Injectable()
export class AcademicsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  /** Assign/move a set of students into one class & section for a year. */
  bulkEnroll(schemaName: string, schoolId: string, dto: BulkEnrollDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const { ay, section } = await this.resolveTarget(
        em,
        schoolId,
        dto.academicYearId,
        dto.classId,
        dto.sectionId,
      );
      if (ay.isLocked) {
        throw new BadRequestException('Academic year is locked');
      }

      const students = await em.getRepository(Student).find({
        where: { id: In(dto.studentIds), schoolId },
      });
      const foundIds = new Set(students.map((s) => s.id));

      const enrolRepo = em.getRepository(StudentEnrollment);
      let assigned = 0;
      let roll = dto.startRoll;
      const errors: { studentId: string; error: string }[] = [];

      for (const studentId of dto.studentIds) {
        if (!foundIds.has(studentId)) {
          errors.push({ studentId, error: 'Student not found' });
          continue;
        }
        const rollNumber = roll !== undefined ? String(roll++) : undefined;
        const existing = await enrolRepo.findOne({
          where: { schoolId, studentId, academicYearId: dto.academicYearId },
        });
        if (existing) {
          existing.classId = dto.classId;
          existing.sectionId = section.id;
          if (rollNumber !== undefined) existing.rollNumber = rollNumber;
          existing.status = 'active' as any;
          await enrolRepo.save(existing);
        } else {
          await enrolRepo.save(
            enrolRepo.create({
              schoolId,
              studentId,
              academicYearId: dto.academicYearId,
              classId: dto.classId,
              sectionId: section.id,
              rollNumber: rollNumber ?? null,
              enrollmentDate: new Date(),
              status: 'active' as any,
            }),
          );
        }
        assigned++;
      }
      return { assigned, errors };
    });
  }

  /** Source classes (with active-student counts) for a year — drives the promotion UI. */
  promotionSource(schemaName: string, schoolId: string, academicYearId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const classes = await em.getRepository(ClassEntity).find({
        where: { schoolId, academicYearId },
        order: { orderIndex: 'ASC', name: 'ASC' },
      });
      const rows = await em
        .getRepository(StudentEnrollment)
        .createQueryBuilder('e')
        .select('e.classId', 'classId')
        .addSelect('COUNT(*)', 'cnt')
        .where('e.schoolId = :schoolId', { schoolId })
        .andWhere('e.academicYearId = :ay', { ay: academicYearId })
        .andWhere("e.status = 'active'")
        .groupBy('e.classId')
        .getRawMany<{ classId: string; cnt: string }>();
      const counts = new Map(rows.map((r) => [r.classId, Number(r.cnt)]));
      const courses = await em.getRepository(Course).find({ where: { schoolId } });
      const courseName = new Map(courses.map((c) => [c.id, c.name]));
      return classes.map((c) => ({
        id: c.id,
        name: c.name,
        courseName: c.courseId ? courseName.get(c.courseId) ?? null : null,
        orderIndex: c.orderIndex,
        activeStudents: counts.get(c.id) ?? 0,
      }));
    });
  }

  /** Students actively enrolled in a class for a year (for the promotion table). */
  classStudents(
    schemaName: string,
    schoolId: string,
    academicYearId: string,
    classId: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const enrollments = await em.getRepository(StudentEnrollment).find({
        where: {
          schoolId,
          academicYearId,
          classId,
          status: 'active' as any,
        },
      });
      const ids = enrollments.map((e) => e.studentId);
      const students = ids.length
        ? await em
            .getRepository(Student)
            .find({ where: { id: In(ids), schoolId } })
        : [];
      const eMap = new Map(enrollments.map((e) => [e.studentId, e]));
      return students
        .map((s) => ({
          id: s.id,
          admissionNumber: s.admissionNumber,
          firstName: s.firstName,
          lastName: s.lastName,
          rollNumber: eMap.get(s.id)?.rollNumber ?? null,
        }))
        .sort((a, b) =>
          (a.rollNumber ?? '').localeCompare(b.rollNumber ?? '', undefined, {
            numeric: true,
          }),
        );
    });
  }

  /** Execute promotion/detention/transfer decisions from one year into the next. */
  promote(
    schemaName: string,
    schoolId: string,
    userId: string,
    dto: PromoteDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      if (dto.fromAcademicYearId === dto.toAcademicYearId) {
        throw new BadRequestException(
          'Source and target academic years must differ',
        );
      }
      const ayRepo = em.getRepository(AcademicYear);
      const fromYear = await ayRepo.findOne({
        where: { id: dto.fromAcademicYearId, schoolId },
      });
      if (!fromYear) throw new NotFoundException('Source academic year not found');
      const toYear = await ayRepo.findOne({
        where: { id: dto.toAcademicYearId, schoolId },
      });
      if (!toYear) throw new NotFoundException('Target academic year not found');
      if (toYear.isLocked) {
        throw new BadRequestException('Target academic year is locked');
      }

      const enrolRepo = em.getRepository(StudentEnrollment);
      const promoRepo = em.getRepository(Promotion);
      const studentRepo = em.getRepository(Student);
      const now = new Date();

      // ── Pass 1: validate everything first (a single failed write would poison
      //    the whole transaction, so we never write until all decisions pass).
      const plan: {
        decision: (typeof dto.decisions)[number];
        current: StudentEnrollment;
        sectionId?: string;
      }[] = [];
      const issues: { studentId: string; error: string }[] = [];

      for (const d of dto.decisions) {
        const current = await enrolRepo.findOne({
          where: {
            schoolId,
            studentId: d.studentId,
            academicYearId: dto.fromAcademicYearId,
            status: 'active' as any,
          },
        });
        if (!current) {
          issues.push({
            studentId: d.studentId,
            error: 'No active enrollment in the source year',
          });
          continue;
        }
        if (d.action === 'transfer') {
          plan.push({ decision: d, current });
        } else {
          if (!d.toClassId || !d.toSectionId) {
            issues.push({
              studentId: d.studentId,
              error: 'toClassId and toSectionId are required',
            });
            continue;
          }
          try {
            const { section } = await this.resolveTarget(
              em,
              schoolId,
              dto.toAcademicYearId,
              d.toClassId,
              d.toSectionId,
            );
            plan.push({ decision: d, current, sectionId: section.id });
          } catch (e) {
            issues.push({ studentId: d.studentId, error: (e as Error).message });
          }
        }
      }

      if (issues.length) {
        throw new BadRequestException({
          message: 'Promotion rejected — fix the issues and retry',
          issues,
        });
      }

      // ── Pass 2: execute (all validated, so no write should fail).
      const statusMap = {
        promote: 'promoted',
        detain: 'detained',
        transfer: 'transferred',
      } as const;
      const result = { promoted: 0, detained: 0, transferred: 0 };

      for (const { decision: d, current, sectionId } of plan) {
        if (d.action === 'transfer') {
          current.status = 'transferred' as any;
          await enrolRepo.save(current);
          await studentRepo.update(
            { id: d.studentId, schoolId },
            { status: 'transferred' },
          );
          result.transferred++;
        } else {
          current.status = statusMap[d.action] as any;
          await enrolRepo.save(current);
          await enrolRepo.save(
            enrolRepo.create({
              schoolId,
              studentId: d.studentId,
              academicYearId: dto.toAcademicYearId,
              classId: d.toClassId!,
              sectionId: sectionId!,
              rollNumber: d.rollNumber ?? null,
              enrollmentDate: now,
              status: 'active' as any,
            }),
          );
          if (d.action === 'promote') result.promoted++;
          else result.detained++;
        }

        await promoRepo.save(
          promoRepo.create({
            schoolId,
            fromAcademicYearId: dto.fromAcademicYearId,
            toAcademicYearId: dto.toAcademicYearId,
            fromClassId: current.classId,
            toClassId: d.action === 'transfer' ? null : d.toClassId ?? null,
            studentId: d.studentId,
            enrollmentId: current.id,
            status: statusMap[d.action] as any,
            promotedBy: userId,
            promotedAt: now,
          }),
        );
      }
      return { ...result };
    });
  }

  private async resolveTarget(
    em: EntityManager,
    schoolId: string,
    academicYearId: string,
    classId: string,
    sectionId: string,
  ) {
    const ay = await em
      .getRepository(AcademicYear)
      .findOne({ where: { id: academicYearId, schoolId } });
    if (!ay) throw new NotFoundException('Academic year not found');
    const cls = await em
      .getRepository(ClassEntity)
      .findOne({ where: { id: classId, schoolId } });
    if (!cls) throw new NotFoundException('Class not found');
    if (cls.academicYearId !== academicYearId) {
      throw new BadRequestException(
        'Class does not belong to the academic year',
      );
    }
    const section = await em
      .getRepository(Section)
      .findOne({ where: { id: sectionId, schoolId } });
    if (!section) throw new NotFoundException('Section not found');
    if (section.classId !== classId) {
      throw new BadRequestException('Section does not belong to the class');
    }
    return { ay, cls, section };
  }
}
