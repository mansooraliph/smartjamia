import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { Visitor } from '../../../database/tenant/visitor.entity';
import { Student } from '../../../database/tenant/student.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { paginate } from '../../../common/dto/pagination.dto';
import { CreateVisitorDto, UpdateVisitorDto } from './dto/visitor.dto';

export interface VisitorListOpts {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  gender?: string;
  blacklisted?: string;
  studentId?: string;
}

const VISITOR_SORT: Record<string, string> = {
  name: 'v.name',
  mobile: 'v.mobile',
  relation: 'v.relation',
  createdAt: 'v.createdAt',
};

@Injectable()
export class VisitorsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  private buildQuery(
    em: EntityManager,
    schoolId: string,
    opts: VisitorListOpts,
  ): SelectQueryBuilder<Visitor> {
    const qb = em
      .getRepository(Visitor)
      .createQueryBuilder('v')
      .where('v.schoolId = :schoolId', { schoolId });
    if (opts.studentId)
      qb.andWhere('v.studentId = :sid', { sid: opts.studentId });
    if (opts.gender) qb.andWhere('v.gender = :g', { g: opts.gender });
    if (opts.blacklisted === 'true') qb.andWhere('v.isBlacklisted = true');
    if (opts.search) {
      const t = `%${opts.search.trim()}%`;
      qb.andWhere(
        '(v.name ILIKE :t OR v.mobile ILIKE :t OR v.place ILIKE :t OR v.relation ILIKE :t)',
        { t },
      );
    }
    const sortCol = VISITOR_SORT[opts.sortBy ?? ''] ?? 'v.createdAt';
    qb.orderBy(sortCol, opts.sortOrder === 'asc' ? 'ASC' : 'DESC').addOrderBy(
      'v.id',
      'ASC',
    );
    return qb;
  }

  private async attachStudents(
    em: EntityManager,
    schoolId: string,
    visitors: Visitor[],
  ) {
    const ids = [...new Set(visitors.map((v) => v.studentId))];
    const students = ids.length
      ? await em
          .getRepository(Student)
          .find({ where: { id: In(ids), schoolId }, withDeleted: true })
      : [];
    const map = new Map(students.map((s) => [s.id, s]));
    return visitors.map((v) => {
      const s = map.get(v.studentId);
      return {
        ...v,
        student: s
          ? {
              id: s.id,
              admissionNumber: s.admissionNumber,
              studentName: s.studentName,
            }
          : null,
      };
    });
  }

  list(schemaName: string, schoolId: string, opts: VisitorListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const page = Math.max(1, opts.page ?? 1);
      const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
      const [visitors, total] = await this.buildQuery(em, schoolId, opts)
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const items = await this.attachStudents(em, schoolId, visitors);
      return paginate(items, total, page, limit);
    });
  }

  exportRows(schemaName: string, schoolId: string, opts: VisitorListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const rows = await this.buildQuery(em, schoolId, opts)
        .take(10000)
        .getMany();
      const withStudents = await this.attachStudents(em, schoolId, rows);
      return withStudents.map((v) => ({
        name: v.name,
        relation: v.relation ?? '',
        student: v.student
          ? v.student.studentName
          : '',
        admissionNumber: v.student?.admissionNumber ?? '',
        gender: v.gender ?? '',
        mobile: v.mobile,
        email: v.email ?? '',
        place: v.place ?? '',
        address: v.address ?? '',
        idProof: v.idProofType
          ? `${v.idProofType}${v.idProofNumber ? ` (${v.idProofNumber})` : ''}`
          : '',
        blacklisted: v.isBlacklisted ? 'Yes' : 'No',
      }));
    });
  }

  lookup(
    schemaName: string,
    schoolId: string,
    opts: { search?: string; studentId?: string; limit?: number } = {},
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const qb = em
        .getRepository(Visitor)
        .createQueryBuilder('v')
        .select([
          'v.id',
          'v.name',
          'v.mobile',
          'v.relation',
          'v.isBlacklisted',
          'v.studentId',
        ])
        .where('v.schoolId = :schoolId', { schoolId });
      if (opts.studentId)
        qb.andWhere('v.studentId = :sid', { sid: opts.studentId });
      if (opts.search) {
        const t = `%${opts.search.trim()}%`;
        qb.andWhere('(v.name ILIKE :t OR v.mobile ILIKE :t)', { t });
      }
      const visitors = await qb
        .orderBy('v.name', 'ASC')
        .take(Math.min(100, opts.limit ?? 50))
        .getMany();
      return this.attachStudents(em, schoolId, visitors);
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const v = await em
        .getRepository(Visitor)
        .findOne({ where: { id, schoolId } });
      if (!v) throw new NotFoundException('Visitor not found');
      const [withStudent] = await this.attachStudents(em, schoolId, [v]);
      return withStudent;
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateVisitorDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const student = await em
        .getRepository(Student)
        .findOne({ where: { id: dto.studentId, schoolId } });
      if (!student) throw new BadRequestException('Student not found');
      const repo = em.getRepository(Visitor);
      const saved = await repo.save(
        repo.create({
          schoolId,
          studentId: dto.studentId,
          name: dto.name,
          relation: dto.relation ?? null,
          gender: dto.gender ?? null,
          mobile: dto.mobile,
          email: dto.email ?? null,
          place: dto.place ?? null,
          address: dto.address ?? null,
          idProofType: dto.idProofType ?? null,
          idProofNumber: dto.idProofNumber ?? null,
          photoUrl: dto.photoUrl ?? null,
          notes: dto.notes ?? null,
          isBlacklisted: dto.isBlacklisted ?? false,
        }),
      );
      const [withStudent] = await this.attachStudents(em, schoolId, [saved]);
      return withStudent;
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateVisitorDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Visitor);
      const v = await repo.findOne({ where: { id, schoolId } });
      if (!v) throw new NotFoundException('Visitor not found');
      const target = v as unknown as Record<string, unknown>;
      const keys: (keyof UpdateVisitorDto)[] = [
        'studentId',
        'name',
        'relation',
        'gender',
        'mobile',
        'email',
        'place',
        'address',
        'idProofType',
        'idProofNumber',
        'photoUrl',
        'notes',
        'isBlacklisted',
      ];
      for (const k of keys) if (dto[k] !== undefined) target[k] = dto[k];
      await repo.save(v);
      const [withStudent] = await this.attachStudents(em, schoolId, [v]);
      return withStudent;
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Visitor);
      const v = await repo.findOne({ where: { id, schoolId } });
      if (!v) throw new NotFoundException('Visitor not found');
      await repo.remove(v);
      return { deleted: true, id };
    });
  }
}
