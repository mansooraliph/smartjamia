import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { Visit, VisitStatus } from '../../../database/tenant/visit.entity';
import { Visitor } from '../../../database/tenant/visitor.entity';
import { Student } from '../../../database/tenant/student.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { paginate } from '../../../common/dto/pagination.dto';
import {
  CheckInDto,
  CheckOutDto,
  CreateVisitDto,
  RejectVisitDto,
} from './dto/visit.dto';

export interface VisitListOpts {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  status?: string;
  visitorId?: string;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const VISIT_SORT: Record<string, string> = {
  scheduledDate: 'vt.scheduledDate',
  status: 'vt.status',
  checkInAt: 'vt.checkInAt',
  createdAt: 'vt.createdAt',
};

@Injectable()
export class VisitsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  private buildQuery(
    em: EntityManager,
    schoolId: string,
    opts: VisitListOpts,
  ): SelectQueryBuilder<Visit> {
    const qb = em
      .getRepository(Visit)
      .createQueryBuilder('vt')
      .leftJoin(Visitor, 'vs', 'vs.id = vt.visitorId')
      .leftJoin(Student, 'st', 'st.id = vt.studentId')
      .where('vt.schoolId = :schoolId', { schoolId });
    if (opts.status) qb.andWhere('vt.status = :st', { st: opts.status });
    if (opts.visitorId)
      qb.andWhere('vt.visitorId = :vid', { vid: opts.visitorId });
    if (opts.studentId)
      qb.andWhere('vt.studentId = :sid', { sid: opts.studentId });
    if (opts.dateFrom)
      qb.andWhere('vt.scheduledDate >= :df', { df: opts.dateFrom });
    if (opts.dateTo) qb.andWhere('vt.scheduledDate <= :dt', { dt: opts.dateTo });
    if (opts.search) {
      const t = `%${opts.search.trim()}%`;
      qb.andWhere(
        '(vs.name ILIKE :t OR vs.mobile ILIKE :t OR st.studentName ILIKE :t OR vt.purpose ILIKE :t OR vt.passNumber ILIKE :t OR vt.meetingWith ILIKE :t)',
        { t },
      );
    }
    const sortCol = VISIT_SORT[opts.sortBy ?? ''] ?? 'vt.createdAt';
    qb.orderBy(sortCol, opts.sortOrder === 'asc' ? 'ASC' : 'DESC').addOrderBy(
      'vt.id',
      'ASC',
    );
    return qb;
  }

  private async attach(em: EntityManager, schoolId: string, visits: Visit[]) {
    const visitorIds = [...new Set(visits.map((v) => v.visitorId))];
    const studentIds = [...new Set(visits.map((v) => v.studentId))];
    const visitors = visitorIds.length
      ? await em
          .getRepository(Visitor)
          .find({ where: { id: In(visitorIds), schoolId } })
      : [];
    const students = studentIds.length
      ? await em
          .getRepository(Student)
          .find({ where: { id: In(studentIds), schoolId }, withDeleted: true })
      : [];
    const vMap = new Map(visitors.map((v) => [v.id, v]));
    const sMap = new Map(students.map((s) => [s.id, s]));
    return visits.map((v) => {
      const vs = vMap.get(v.visitorId);
      const st = sMap.get(v.studentId);
      return {
        ...v,
        visitor: vs
          ? {
              id: vs.id,
              name: vs.name,
              mobile: vs.mobile,
              relation: vs.relation,
              isBlacklisted: vs.isBlacklisted,
            }
          : null,
        student: st
          ? {
              id: st.id,
              admissionNumber: st.admissionNumber,
              studentName: st.studentName,
            }
          : null,
      };
    });
  }

  list(schemaName: string, schoolId: string, opts: VisitListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const page = Math.max(1, opts.page ?? 1);
      const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
      const [visits, total] = await this.buildQuery(em, schoolId, opts)
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const items = await this.attach(em, schoolId, visits);
      return paginate(items, total, page, limit);
    });
  }

  exportRows(schemaName: string, schoolId: string, opts: VisitListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const visits = await this.buildQuery(em, schoolId, opts)
        .take(10000)
        .getMany();
      const withV = await this.attach(em, schoolId, visits);
      const fmt = (d: Date | null) =>
        d ? new Date(d).toISOString().slice(0, 16).replace('T', ' ') : '';
      return withV.map((v) => ({
        visitor: v.visitor?.name ?? '',
        mobile: v.visitor?.mobile ?? '',
        relation: v.visitor?.relation ?? '',
        student: v.student
          ? v.student.studentName
          : '',
        admissionNumber: v.student?.admissionNumber ?? '',
        meetingWith: v.meetingWith ?? '',
        purpose: v.purpose,
        partySize: v.partySize,
        scheduled: `${String(v.scheduledDate).slice(0, 10)}${
          v.scheduledTime ? ' ' + v.scheduledTime : ''
        }`,
        status: v.status,
        checkIn: fmt(v.checkInAt),
        checkOut: fmt(v.checkOutAt),
        durationMin: v.durationMinutes ?? '',
        passNumber: v.passNumber ?? '',
      }));
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const vt = await em.getRepository(Visit).findOne({ where: { id, schoolId } });
      if (!vt) throw new NotFoundException('Visit not found');
      const [withV] = await this.attach(em, schoolId, [vt]);
      return withV;
    });
  }

  createRequest(
    schemaName: string,
    schoolId: string,
    userId: string,
    dto: CreateVisitDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const visitor = await em
        .getRepository(Visitor)
        .findOne({ where: { id: dto.visitorId, schoolId } });
      if (!visitor) throw new NotFoundException('Visitor not found');
      if (visitor.isBlacklisted) {
        throw new BadRequestException(
          'This visitor is blacklisted — visit cannot be requested',
        );
      }
      const repo = em.getRepository(Visit);
      const visit = await repo.save(
        repo.create({
          schoolId,
          visitorId: dto.visitorId,
          studentId: visitor.studentId, // the student is whom the visitor visits
          meetingWith: dto.meetingWith ?? null,
          purpose: dto.purpose,
          reason: dto.reason ?? null,
          partySize: dto.partySize ?? 1,
          vehicleNumber: dto.vehicleNumber ?? null,
          scheduledDate: new Date(dto.scheduledDate),
          scheduledTime: dto.scheduledTime ?? null,
          status: 'requested',
          belongings: dto.belongings ?? null,
          remarks: dto.remarks ?? null,
          createdBy: userId,
        }),
      );
      const [withV] = await this.attach(em, schoolId, [visit]);
      return withV;
    });
  }

  approve(schemaName: string, schoolId: string, userId: string, id: string) {
    return this.transition(schemaName, schoolId, id, ['requested'], (v) => {
      v.status = 'approved';
      v.approvedBy = userId;
      v.approvedAt = new Date();
    });
  }

  reject(
    schemaName: string,
    schoolId: string,
    userId: string,
    id: string,
    dto: RejectVisitDto,
  ) {
    return this.transition(schemaName, schoolId, id, ['requested'], (v) => {
      v.status = 'rejected';
      v.approvedBy = userId;
      v.approvedAt = new Date();
      v.rejectionReason = dto.rejectionReason ?? null;
    });
  }

  checkIn(
    schemaName: string,
    schoolId: string,
    userId: string,
    id: string,
    dto: CheckInDto,
  ) {
    return this.transition(
      schemaName,
      schoolId,
      id,
      ['requested', 'approved'],
      (v) => {
        v.status = 'checked_in';
        v.checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : new Date();
        if (dto.passNumber !== undefined) v.passNumber = dto.passNumber;
        if (dto.belongings !== undefined) v.belongings = dto.belongings;
        // record who admitted them if not already approved
        if (!v.approvedBy) {
          v.approvedBy = userId;
          v.approvedAt = new Date();
        }
      },
    );
  }

  checkOut(schemaName: string, schoolId: string, id: string, dto: CheckOutDto) {
    return this.transition(schemaName, schoolId, id, ['checked_in'], (v) => {
      const out = dto.checkOutAt ? new Date(dto.checkOutAt) : new Date();
      v.status = 'checked_out';
      v.checkOutAt = out;
      if (v.checkInAt) {
        const mins = Math.max(
          0,
          Math.round((out.getTime() - new Date(v.checkInAt).getTime()) / 60000),
        );
        v.durationMinutes = mins;
      }
      if (dto.remarks !== undefined) v.remarks = dto.remarks;
    });
  }

  cancel(schemaName: string, schoolId: string, id: string) {
    return this.transition(
      schemaName,
      schoolId,
      id,
      ['requested', 'approved'],
      (v) => {
        v.status = 'cancelled';
      },
    );
  }

  markNoShow(schemaName: string, schoolId: string, id: string) {
    return this.transition(
      schemaName,
      schoolId,
      id,
      ['requested', 'approved'],
      (v) => {
        v.status = 'no_show';
      },
    );
  }

  /** Live snapshot: who is currently inside + today's counts. */
  summary(schemaName: string, schoolId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Visit);
      const today = new Date().toISOString().slice(0, 10);
      const [insideCount, requestedCount, todayCount] = await Promise.all([
        repo.count({ where: { schoolId, status: 'checked_in' as VisitStatus } }),
        repo.count({ where: { schoolId, status: 'requested' as VisitStatus } }),
        repo
          .createQueryBuilder('vt')
          .where('vt.schoolId = :schoolId', { schoolId })
          .andWhere('vt.scheduledDate = :today', { today })
          .getCount(),
      ]);
      return {
        currentlyInside: insideCount,
        pendingRequests: requestedCount,
        scheduledToday: todayCount,
      };
    });
  }

  private transition(
    schemaName: string,
    schoolId: string,
    id: string,
    allowed: VisitStatus[],
    mutate: (v: Visit) => void,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Visit);
      const v = await repo.findOne({ where: { id, schoolId } });
      if (!v) throw new NotFoundException('Visit not found');
      if (!allowed.includes(v.status)) {
        throw new BadRequestException(
          `Cannot perform this action on a "${v.status}" visit`,
        );
      }
      mutate(v);
      await repo.save(v);
      const [withV] = await this.attach(em, schoolId, [v]);
      return withV;
    });
  }
}
