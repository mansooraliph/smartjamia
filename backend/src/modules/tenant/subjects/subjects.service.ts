import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Subject } from '../../../database/tenant/subject.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { ExamBoardInstitution } from '../../../database/master/exam-board/exam-board-institution.entity';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/subject.dto';

@Injectable()
export class SubjectsService {
  private readonly examBoardInstitutionRepo: Repository<ExamBoardInstitution>;

  constructor(
    private readonly tenant: TenantSchemaService,
    @InjectDataSource('master') masterDs: DataSource,
  ) {
    this.examBoardInstitutionRepo = masterDs.getRepository(ExamBoardInstitution);
  }

  /**
   * For a school copied into the org's Examination Board wing, Subjects are
   * mirrored from the org master — block manual create/edit/delete so the
   * two sources can't drift apart.
   */
  private async assertNotExamBoardManaged(schoolId: string) {
    const link = await this.examBoardInstitutionRepo.findOne({
      where: { schoolId, isEnabled: true },
    });
    if (link) {
      throw new ForbiddenException(
        'Subjects for this institution are managed by the Examination Board. Enable/disable them from the organization portal.',
      );
    }
  }

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

  async create(schemaName: string, schoolId: string, dto: CreateSubjectDto) {
    await this.assertNotExamBoardManaged(schoolId);
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

  async update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateSubjectDto,
  ) {
    await this.assertNotExamBoardManaged(schoolId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Subject);
      const s = await repo.findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Subject not found');
      Object.assign(s, dto);
      return repo.save(s);
    });
  }

  async remove(schemaName: string, schoolId: string, id: string) {
    await this.assertNotExamBoardManaged(schoolId);
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Subject);
      const s = await repo.findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Subject not found');
      await repo.remove(s);
      return { deleted: true, id };
    });
  }
}
