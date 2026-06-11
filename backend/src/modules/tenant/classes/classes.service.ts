import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IsNull } from 'typeorm';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Section } from '../../../database/tenant/section.entity';
import { AcademicYear } from '../../../database/tenant/academic-year.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { CreateClassDto, UpdateClassDto } from './dto/class.dto';
import { CreateSectionDto, UpdateSectionDto } from './dto/section.dto';

@Injectable()
export class ClassesService {
  constructor(private readonly tenant: TenantSchemaService) {}

  // ─── Classes ──────────────────────────────────────────────────────────────
  list(
    schemaName: string,
    schoolId: string,
    academicYearId?: string,
    courseId?: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(ClassEntity).find({
        where: {
          schoolId,
          ...(academicYearId ? { academicYearId } : {}),
          ...(courseId ? { courseId } : {}),
        },
        order: { orderIndex: 'ASC', name: 'ASC' },
      });
    });
  }

  exportRows(schemaName: string, schoolId: string, academicYearId?: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const classes = await em.getRepository(ClassEntity).find({
        where: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
        order: { orderIndex: 'ASC', name: 'ASC' },
      });
      const years = await em
        .getRepository(AcademicYear)
        .find({ where: { schoolId } });
      const yMap = new Map(years.map((y) => [y.id, y.name]));
      const sections = await em
        .getRepository(Section)
        .find({ where: { schoolId } });
      const secCount = new Map<string, number>();
      for (const s of sections)
        secCount.set(s.classId, (secCount.get(s.classId) ?? 0) + 1);
      return classes.map((c) => ({
        name: c.name,
        orderIndex: c.orderIndex,
        academicYear: yMap.get(c.academicYearId) ?? '',
        sections: secCount.get(c.id) ?? 0,
      }));
    });
  }

  listWithSections(
    schemaName: string,
    schoolId: string,
    academicYearId?: string,
    courseId?: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const classes = await em.getRepository(ClassEntity).find({
        where: {
          schoolId,
          ...(academicYearId ? { academicYearId } : {}),
          ...(courseId ? { courseId } : {}),
        },
        order: { orderIndex: 'ASC', name: 'ASC' },
      });
      if (classes.length === 0) return [];

      const sections = await em.getRepository(Section).find({
        where: { schoolId },
        order: { name: 'ASC' },
      });
      const byClass = new Map<string, Section[]>();
      for (const s of sections) {
        const arr = byClass.get(s.classId) ?? [];
        arr.push(s);
        byClass.set(s.classId, arr);
      }
      return classes.map((c) => ({
        ...c,
        sections: byClass.get(c.id) ?? [],
      }));
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const c = await em
        .getRepository(ClassEntity)
        .findOne({ where: { id, schoolId } });
      if (!c) throw new NotFoundException('Class not found');
      return c;
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateClassDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const ay = await em
        .getRepository(AcademicYear)
        .findOne({ where: { id: dto.academicYearId, schoolId } });
      if (!ay) throw new NotFoundException('Academic year not found');

      // Class names are unique within a (year, course) — colleges reuse names
      // like "Semester 1" across courses, so the course scopes the check.
      const dup = await em.getRepository(ClassEntity).findOne({
        where: {
          schoolId,
          academicYearId: dto.academicYearId,
          name: dto.name,
          courseId: dto.courseId ?? IsNull(),
        },
      });
      if (dup) {
        throw new ConflictException(
          'A class with this name already exists in this academic year' +
            (dto.courseId ? ' / course' : ''),
        );
      }
      return em.getRepository(ClassEntity).save(
        em.getRepository(ClassEntity).create({
          schoolId,
          academicYearId: dto.academicYearId,
          courseId: dto.courseId ?? null,
          name: dto.name,
          orderIndex: dto.orderIndex ?? 0,
        }),
      );
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateClassDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(ClassEntity);
      const c = await repo.findOne({ where: { id, schoolId } });
      if (!c) throw new NotFoundException('Class not found');
      Object.assign(c, dto);
      return repo.save(c);
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(ClassEntity);
      const c = await repo.findOne({ where: { id, schoolId } });
      if (!c) throw new NotFoundException('Class not found');

      const sectionsCount = await em
        .getRepository(Section)
        .count({ where: { schoolId, classId: id } });
      if (sectionsCount > 0) {
        throw new ConflictException(
          'Cannot delete class with sections — delete sections first',
        );
      }
      await repo.remove(c);
      return { deleted: true, id };
    });
  }

  // ─── Sections ─────────────────────────────────────────────────────────────
  listSections(schemaName: string, schoolId: string, classId?: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(Section).find({
        where: { schoolId, ...(classId ? { classId } : {}) },
        order: { name: 'ASC' },
      });
    });
  }

  createSection(schemaName: string, schoolId: string, dto: CreateSectionDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const cls = await em
        .getRepository(ClassEntity)
        .findOne({ where: { id: dto.classId, schoolId } });
      if (!cls) throw new NotFoundException('Class not found');

      const dup = await em.getRepository(Section).findOne({
        where: { schoolId, classId: dto.classId, name: dto.name },
      });
      if (dup) {
        throw new ConflictException(
          'A section with this name already exists in this class',
        );
      }

      return em.getRepository(Section).save(
        em.getRepository(Section).create({
          schoolId,
          classId: dto.classId,
          name: dto.name,
          capacity: dto.capacity ?? 40,
          classTeacherId: dto.classTeacherId ?? null,
        }),
      );
    });
  }

  updateSection(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateSectionDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Section);
      const sec = await repo.findOne({ where: { id, schoolId } });
      if (!sec) throw new NotFoundException('Section not found');
      Object.assign(sec, dto);
      return repo.save(sec);
    });
  }

  removeSection(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Section);
      const sec = await repo.findOne({ where: { id, schoolId } });
      if (!sec) throw new NotFoundException('Section not found');
      await repo.remove(sec);
      return { deleted: true, id };
    });
  }
}
