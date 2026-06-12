import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Course } from '../../../database/tenant/course.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { AcademicYear } from '../../../database/tenant/academic-year.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { CreateCourseDto, UpdateCourseDto } from './dto/course.dto';

@Injectable()
export class CoursesService {
  constructor(private readonly tenant: TenantSchemaService) {}

  /** Courses for a year, with a class count, ordered by level then orderIndex. */
  list(schemaName: string, schoolId: string, academicYearId?: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const courses = await em.getRepository(Course).find({
        where: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
        order: { level: 'ASC', orderIndex: 'ASC', name: 'ASC' },
      });
      if (!courses.length) return [];
      const classes = await em.getRepository(ClassEntity).find({
        where: { schoolId },
      });
      const count = new Map<string, number>();
      for (const c of classes) {
        if (c.courseId)
          count.set(c.courseId, (count.get(c.courseId) ?? 0) + 1);
      }
      return courses.map((c) => ({ ...c, classCount: count.get(c.id) ?? 0 }));
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateCourseDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const ay = await em
        .getRepository(AcademicYear)
        .findOne({ where: { id: dto.academicYearId, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');

      const dup = await em.getRepository(Course).findOne({
        where: {
          schoolId,
          academicYearId: dto.academicYearId,
          name: dto.name,
        },
      });
      if (dup) {
        throw new ConflictException(
          'A course with this name already exists in this academic year',
        );
      }
      const termSystem = dto.termSystem ?? 'annual';
      const durationYears = dto.durationYears ?? 1;
      const repo = em.getRepository(Course);
      const course = await repo.save(
        repo.create({
          schoolId,
          academicYearId: dto.academicYearId,
          level: dto.level,
          name: dto.name,
          code: dto.code?.trim() || null,
          termSystem,
          durationYears,
          orderIndex: dto.orderIndex ?? 0,
        }),
      );

      // Auto-generate the course's classes from its structure.
      const generated = await this.generateClasses(em, schoolId, course);
      return { ...course, classesGenerated: generated };
    });
  }

  /** Materialize a course's classes (Year/Semester/Trimester 1..N) from its structure. */
  private async generateClasses(
    em: EntityManager,
    schoolId: string,
    course: Course,
  ): Promise<number> {
    const perYear =
      course.termSystem === 'semester'
        ? 2
        : course.termSystem === 'trimester'
          ? 3
          : 1;
    const label =
      course.termSystem === 'semester'
        ? 'Semester'
        : course.termSystem === 'trimester'
          ? 'Trimester'
          : 'Year';
    const count = Math.max(1, course.durationYears) * perYear;

    const repo = em.getRepository(ClassEntity);
    let created = 0;
    for (let n = 1; n <= count; n++) {
      const name = `${label} ${n}`;
      const exists = await repo.findOne({
        where: {
          schoolId,
          academicYearId: course.academicYearId,
          courseId: course.id,
          name,
        },
      });
      if (exists) continue;
      await repo.save(
        repo.create({
          schoolId,
          academicYearId: course.academicYearId,
          courseId: course.id,
          name,
          orderIndex: n,
        }),
      );
      created++;
    }
    return created;
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateCourseDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Course);
      const course = await repo.findOne({ where: { id, schoolId } });
      if (!course) throw new NotFoundException('Course not found');
      if (dto.level !== undefined) course.level = dto.level;
      if (dto.name !== undefined) course.name = dto.name;
      if (dto.code !== undefined) course.code = dto.code?.trim() || null;
      if (dto.termSystem !== undefined) course.termSystem = dto.termSystem;
      if (dto.durationYears !== undefined)
        course.durationYears = dto.durationYears;
      if (dto.orderIndex !== undefined) course.orderIndex = dto.orderIndex;
      return repo.save(course);
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Course);
      const course = await repo.findOne({ where: { id, schoolId } });
      if (!course) throw new NotFoundException('Course not found');
      const assigned = await em
        .getRepository(ClassEntity)
        .count({ where: { schoolId, courseId: id } });
      if (assigned > 0) {
        throw new BadRequestException(
          `Cannot delete — ${assigned} class(es) belong to this course. Move or delete them first.`,
        );
      }
      await repo.remove(course);
      return { deleted: true, id };
    });
  }
}
