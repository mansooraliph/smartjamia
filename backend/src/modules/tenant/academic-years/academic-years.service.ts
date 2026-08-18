import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { AcademicYear } from '../../../database/tenant/academic-year.entity';
import { Course } from '../../../database/tenant/course.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Section } from '../../../database/tenant/section.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { ExamBoardInstitution } from '../../../database/master/exam-board/exam-board-institution.entity';
import {
  CreateAcademicYearDto,
  UpdateAcademicYearDto,
} from './dto/academic-year.dto';

@Injectable()
export class AcademicYearsService {
  private readonly examBoardInstitutionRepo: Repository<ExamBoardInstitution>;

  constructor(
    private readonly tenant: TenantSchemaService,
    @InjectDataSource('master') masterDs: DataSource,
  ) {
    this.examBoardInstitutionRepo = masterDs.getRepository(ExamBoardInstitution);
  }

  /**
   * For a school copied into the org's Examination Board wing, Academic
   * Years are mirrored from the org master — block manual create/edit/delete
   * so the two sources can't drift apart.
   */
  private async assertNotExamBoardManaged(schoolId: string) {
    const link = await this.examBoardInstitutionRepo.findOne({
      where: { schoolId, isEnabled: true },
    });
    if (link) {
      throw new ForbiddenException(
        'Academic years for this institution are managed by the Examination Board. Enable/disable them from the organization portal.',
      );
    }
  }

  list(schemaName: string, schoolId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(AcademicYear).find({
        where: { schoolId },
        order: { startDate: 'DESC' },
      });
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const ay = await em
        .getRepository(AcademicYear)
        .findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      return ay;
    });
  }

  async create(schemaName: string, schoolId: string, dto: CreateAcademicYearDto) {
    await this.assertNotExamBoardManaged(schoolId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const dup = await repo.findOne({ where: { schoolId, name: dto.name } });
      if (dup) throw new ConflictException('Academic year name already exists');

      if (dto.isCurrent) {
        await repo.update({ schoolId, isCurrent: true }, { isCurrent: false });
      }
      return repo.save(
        repo.create({
          schoolId,
          name: dto.name,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          isCurrent: dto.isCurrent ?? false,
          isLocked: false,
        }),
      );
    });
  }

  async update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateAcademicYearDto,
  ) {
    await this.assertNotExamBoardManaged(schoolId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const ay = await repo.findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      if (ay.isLocked) {
        throw new ConflictException('Academic year is locked');
      }

      if (dto.isCurrent === true) {
        await repo.update(
          { schoolId, isCurrent: true },
          { isCurrent: false },
        );
      }
      Object.assign(ay, {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : ay.startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : ay.endDate,
      });
      return repo.save(ay);
    });
  }

  async remove(schemaName: string, schoolId: string, id: string) {
    await this.assertNotExamBoardManaged(schoolId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const ay = await repo.findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      if (ay.isLocked) {
        throw new ConflictException('Academic year is locked');
      }
      await repo.remove(ay);
      return { deleted: true, id };
    });
  }

  setCurrent(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const ay = await repo.findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      await repo.update({ schoolId, isCurrent: true }, { isCurrent: false });
      ay.isCurrent = true;
      return repo.save(ay);
    });
  }

  /**
   * Clone the academic STRUCTURE (courses → classes → sections) from one year
   * into another. Students/enrollments are NOT copied. Idempotent: items that
   * already exist in the target (by name) are reused/skipped.
   */
  copyStructure(
    schemaName: string,
    schoolId: string,
    targetYearId: string,
    fromYearId: string,
  ) {
    if (targetYearId === fromYearId) {
      throw new BadRequestException('Source and target year must differ');
    }
    return this.tenant.runInSchema(schemaName, async (em) => {
      const yearRepo = em.getRepository(AcademicYear);
      const target = await yearRepo.findOne({
        where: { id: targetYearId, schoolId },
      });
      if (!target) throw new NotFoundException('Target academic year not found');
      if (target.isLocked) {
        throw new ConflictException('Target academic year is locked');
      }
      const source = await yearRepo.findOne({
        where: { id: fromYearId, schoolId },
      });
      if (!source) throw new NotFoundException('Source academic year not found');

      const courseRepo = em.getRepository(Course);
      const classRepo = em.getRepository(ClassEntity);
      const sectionRepo = em.getRepository(Section);

      const srcCourses = await courseRepo.find({
        where: { schoolId, academicYearId: fromYearId },
      });
      const srcClasses = await classRepo.find({
        where: { schoolId, academicYearId: fromYearId },
      });
      const srcSections = await sectionRepo.find({ where: { schoolId } });
      const srcClassIds = new Set(srcClasses.map((c) => c.id));

      const counts = { courses: 0, classes: 0, sections: 0 };

      // 1. Courses → map old course id → target course id.
      const courseMap = new Map<string, string>();
      for (const c of srcCourses) {
        let existing = await courseRepo.findOne({
          where: { schoolId, academicYearId: targetYearId, name: c.name },
        });
        if (!existing) {
          existing = await courseRepo.save(
            courseRepo.create({
              schoolId,
              academicYearId: targetYearId,
              level: c.level,
              name: c.name,
              code: c.code,
              termSystem: c.termSystem,
              durationYears: c.durationYears,
              orderIndex: c.orderIndex,
            }),
          );
          counts.courses++;
        }
        courseMap.set(c.id, existing.id);
      }

      // 2. Classes → map old class id → target class id.
      const classMap = new Map<string, string>();
      for (const cls of srcClasses) {
        const newCourseId = cls.courseId
          ? courseMap.get(cls.courseId) ?? null
          : null;
        let existing = await classRepo.findOne({
          where: {
            schoolId,
            academicYearId: targetYearId,
            name: cls.name,
            courseId: newCourseId ?? IsNull(),
          },
        });
        if (!existing) {
          existing = await classRepo.save(
            classRepo.create({
              schoolId,
              academicYearId: targetYearId,
              courseId: newCourseId,
              name: cls.name,
              orderIndex: cls.orderIndex,
            }),
          );
          counts.classes++;
        }
        classMap.set(cls.id, existing.id);
      }

      // 3. Sections (belong to a source class) → recreate under the new class.
      for (const sec of srcSections) {
        if (!srcClassIds.has(sec.classId)) continue;
        const newClassId = classMap.get(sec.classId);
        if (!newClassId) continue;
        const dup = await sectionRepo.findOne({
          where: { schoolId, classId: newClassId, name: sec.name },
        });
        if (dup) continue;
        await sectionRepo.save(
          sectionRepo.create({
            schoolId,
            classId: newClassId,
            name: sec.name,
            capacity: sec.capacity,
            classTeacherId: null, // teacher links don't carry across years
          }),
        );
        counts.sections++;
      }

      return { from: source.name, to: target.name, ...counts };
    });
  }

  setLocked(schemaName: string, schoolId: string, id: string, locked: boolean) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(AcademicYear);
      const ay = await repo.findOne({ where: { id, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');
      ay.isLocked = locked;
      return repo.save(ay);
    });
  }
}
