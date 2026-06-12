import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In, Not, SelectQueryBuilder } from 'typeorm';
import { Parent } from '../../../database/tenant/parent.entity';
import { Student } from '../../../database/tenant/student.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { paginate } from '../../../common/dto/pagination.dto';
import { CreateParentDto, UpdateParentDto } from './dto/parent.dto';

export interface ParentListOpts {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  studentId?: string;
  relation?: string;
}

const PARENT_SORT: Record<string, string> = {
  name: 'p.name',
  relation: 'p.relation',
  phone: 'p.phone',
  createdAt: 'p.createdAt',
};

@Injectable()
export class ParentsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  private buildListQuery(
    em: EntityManager,
    schoolId: string,
    opts: ParentListOpts,
  ): SelectQueryBuilder<Parent> {
    const qb = em
      .getRepository(Parent)
      .createQueryBuilder('p')
      .where('p.schoolId = :schoolId', { schoolId });
    if (opts.studentId)
      qb.andWhere('p.studentId = :sid', { sid: opts.studentId });
    if (opts.relation)
      qb.andWhere('p.relation = :rel', { rel: opts.relation });
    if (opts.search) {
      const t = `%${opts.search.trim()}%`;
      qb.andWhere(
        '(p.name ILIKE :t OR p.phone ILIKE :t OR p.email ILIKE :t)',
        { t },
      );
    }
    const sortCol = PARENT_SORT[opts.sortBy ?? ''] ?? 'p.createdAt';
    qb.orderBy(sortCol, opts.sortOrder === 'asc' ? 'ASC' : 'DESC').addOrderBy(
      'p.id',
      'ASC',
    );
    return qb;
  }

  private async attachStudents(
    em: EntityManager,
    schoolId: string,
    parents: Parent[],
  ) {
    const ids = [...new Set(parents.map((p) => p.studentId))];
    const students = ids.length
      ? await em.getRepository(Student).find({
          where: { id: In(ids), schoolId },
          withDeleted: true,
        })
      : [];
    const map = new Map(students.map((s) => [s.id, s]));
    return parents.map((p) => {
      const s = map.get(p.studentId);
      return {
        ...p,
        student: s
          ? {
              id: s.id,
              admissionNumber: s.admissionNumber,
              firstName: s.firstName,
              lastName: s.lastName,
            }
          : null,
      };
    });
  }

  list(schemaName: string, schoolId: string, opts: ParentListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const page = Math.max(1, opts.page ?? 1);
      const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
      const [parents, total] = await this.buildListQuery(em, schoolId, opts)
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const items = await this.attachStudents(em, schoolId, parents);
      return paginate(items, total, page, limit);
    });
  }

  exportRows(schemaName: string, schoolId: string, opts: ParentListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const parents = await this.buildListQuery(em, schoolId, opts)
        .take(10000)
        .getMany();
      const withStudents = await this.attachStudents(em, schoolId, parents);
      return withStudents.map((p) => ({
        admissionNumber: p.student?.admissionNumber ?? '',
        student: p.student
          ? `${p.student.firstName} ${p.student.lastName}`
          : '',
        name: p.name,
        relation: p.relation,
        phoneCountryCode: p.phoneCountryCode ?? '',
        phone: p.phone,
        whatsappCountryCode: p.whatsappCountryCode ?? '',
        whatsapp: p.whatsapp ?? '',
        email: p.email ?? '',
        occupation: p.occupation ?? '',
        annualIncome: p.annualIncome ?? '',
        aadharNumber: p.aadharNumber ?? '',
        isPrimary: p.isPrimary ? 'Yes' : 'No',
      }));
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const p = await em.getRepository(Parent).findOne({
        where: { id, schoolId },
      });
      if (!p) throw new NotFoundException('Parent not found');
      const [withStudent] = await this.attachStudents(em, schoolId, [p]);
      return withStudent;
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateParentDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const student = await em
        .getRepository(Student)
        .findOne({ where: { id: dto.studentId, schoolId } });
      if (!student) throw new NotFoundException('Student not found');

      const repo = em.getRepository(Parent);
      const parent = await repo.save(
        repo.create({
          schoolId,
          userId: null,
          studentId: dto.studentId,
          relation: dto.relation,
          name: dto.name,
          phoneCountryCode: dto.phoneCountryCode ?? null,
          phone: dto.phone,
          whatsappCountryCode: dto.whatsappCountryCode ?? null,
          whatsapp: dto.whatsapp ?? null,
          email: dto.email ?? null,
          occupation: dto.occupation ?? null,
          annualIncome: dto.annualIncome ?? null,
          aadharNumber: dto.aadharNumber ?? null,
          photoUrl: dto.photoUrl ?? null,
          isPrimary: dto.isPrimary ?? false,
        }),
      );
      if (parent.isPrimary) {
        await this.demoteOtherPrimaries(em, schoolId, dto.studentId, parent.id);
      }
      const [withStudent] = await this.attachStudents(em, schoolId, [parent]);
      return withStudent;
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateParentDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Parent);
      const p = await repo.findOne({ where: { id, schoolId } });
      if (!p) throw new NotFoundException('Parent not found');

      const fields: (keyof UpdateParentDto)[] = [
        'relation',
        'name',
        'phoneCountryCode',
        'phone',
        'whatsappCountryCode',
        'whatsapp',
        'email',
        'occupation',
        'annualIncome',
        'aadharNumber',
        'photoUrl',
        'isPrimary',
      ];
      const target = p as unknown as Record<string, unknown>;
      for (const k of fields) {
        if (dto[k] !== undefined) target[k] = dto[k];
      }
      await repo.save(p);
      if (p.isPrimary) {
        await this.demoteOtherPrimaries(em, schoolId, p.studentId, p.id);
      }
      const [withStudent] = await this.attachStudents(em, schoolId, [p]);
      return withStudent;
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Parent);
      const p = await repo.findOne({ where: { id, schoolId } });
      if (!p) throw new NotFoundException('Parent not found');
      await repo.remove(p);
      return { deleted: true, id };
    });
  }

  /** Only one primary guardian per student. */
  private async demoteOtherPrimaries(
    em: EntityManager,
    schoolId: string,
    studentId: string,
    keepId: string,
  ) {
    await em
      .getRepository(Parent)
      .update(
        { schoolId, studentId, id: Not(keepId) },
        { isPrimary: false },
      );
  }
}
