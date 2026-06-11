import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Subject } from '../../../database/tenant/subject.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@Injectable()
export class SubjectsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  list(schemaName: string, schoolId: string, classId?: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      return em.getRepository(Subject).find({
        where: { schoolId, ...(classId ? { classId } : {}) },
        order: { name: 'ASC' },
      });
    });
  }

  exportRows(schemaName: string, schoolId: string, classId?: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const subjects = await em.getRepository(Subject).find({
        where: { schoolId, ...(classId ? { classId } : {}) },
        order: { name: 'ASC' },
      });
      const classes = await em
        .getRepository(ClassEntity)
        .find({ where: { schoolId } });
      const cMap = new Map(classes.map((c) => [c.id, c.name]));
      return subjects.map((s) => ({
        name: s.name,
        code: s.code,
        class: cMap.get(s.classId) ?? '',
        maxMarks: s.maxMarks,
        passMarks: s.passMarks,
        optional: s.isOptional ? 'Yes' : 'No',
      }));
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const s = await em
        .getRepository(Subject)
        .findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Subject not found');
      return s;
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateSubjectDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const cls = await em
        .getRepository(ClassEntity)
        .findOne({ where: { id: dto.classId, schoolId } });
      if (!cls) throw new NotFoundException('Class not found');

      const dup = await em
        .getRepository(Subject)
        .findOne({ where: { schoolId, classId: dto.classId, code: dto.code } });
      if (dup) {
        throw new ConflictException(
          'Subject code already exists in this class',
        );
      }

      return em.getRepository(Subject).save(
        em.getRepository(Subject).create({
          schoolId,
          classId: dto.classId,
          name: dto.name,
          code: dto.code,
          isOptional: dto.isOptional ?? false,
          maxMarks: dto.maxMarks ?? 100,
          passMarks: dto.passMarks ?? 35,
        }),
      );
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateSubjectDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Subject);
      const s = await repo.findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Subject not found');
      Object.assign(s, dto);
      return repo.save(s);
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Subject);
      const s = await repo.findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Subject not found');
      await repo.remove(s);
      return { deleted: true, id };
    });
  }
}
