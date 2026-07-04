import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { TransferCertificate } from '../../../database/tenant/transfer-certificate.entity';
import { Student } from '../../../database/tenant/student.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { StorageService } from '../../../common/storage/storage.service';
import { paginate } from '../../../common/dto/pagination.dto';
import { IssueTcDto } from './dto/transfer-certificate.dto';
import { REPORTS_QUEUE, TC_PDF_JOB, TcPdfJobData } from './tc.constants';

export interface TcListOpts {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  reason?: string;
}

const TC_SORT: Record<string, string> = {
  tcNumber: 'tc.tcNumber',
  issueDate: 'tc.issueDate',
  reason: 'tc.reason',
  createdAt: 'tc.createdAt',
};

/** Reasons that mark a student as graduated rather than transferred out. */
const COMPLETION_REASONS = new Set(['completion']);

@Injectable()
export class TransferCertificatesService {
  constructor(
    private readonly tenant: TenantSchemaService,
    private readonly storage: StorageService,
    @InjectQueue(REPORTS_QUEUE) private readonly reports: Queue,
  ) {}

  /** Enqueue background PDF generation for a TC. */
  private async enqueuePdf(data: TcPdfJobData) {
    await this.reports.add(TC_PDF_JOB, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 4000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }

  private buildListQuery(
    em: EntityManager,
    schoolId: string,
    opts: TcListOpts,
  ): SelectQueryBuilder<TransferCertificate> {
    const qb = em
      .getRepository(TransferCertificate)
      .createQueryBuilder('tc')
      .leftJoin(Student, 'st', 'st.id = tc.studentId')
      .where('tc.schoolId = :schoolId', { schoolId });
    if (opts.reason) qb.andWhere('tc.reason = :reason', { reason: opts.reason });
    if (opts.search) {
      const t = `%${opts.search.trim()}%`;
      qb.andWhere(
        '(tc.tcNumber ILIKE :t OR st.studentName ILIKE :t OR st.admissionNumber ILIKE :t)',
        { t },
      );
    }
    const sortCol = TC_SORT[opts.sortBy ?? ''] ?? 'tc.createdAt';
    qb.orderBy(sortCol, opts.sortOrder === 'asc' ? 'ASC' : 'DESC').addOrderBy(
      'tc.id',
      'ASC',
    );
    return qb;
  }

  list(schemaName: string, schoolId: string, opts: TcListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const page = Math.max(1, opts.page ?? 1);
      const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
      const [tcs, total] = await this.buildListQuery(em, schoolId, opts)
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const items = await this.attachStudents(em, schoolId, tcs);
      return paginate(items, total, page, limit);
    });
  }

  exportRows(schemaName: string, schoolId: string, opts: TcListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const tcs = await this.buildListQuery(em, schoolId, opts)
        .take(10000)
        .getMany();
      const withStudents = await this.attachStudents(em, schoolId, tcs);
      return withStudents.map((t) => ({
        tcNumber: t.tcNumber,
        studentName: t.student ? t.student.studentName : '',
        admissionNumber: t.student?.admissionNumber ?? '',
        lastClass: t.lastClass,
        reason: t.reason,
        conduct: t.conduct,
        feesCleared: t.feesCleared ? 'Yes' : 'No',
        issueDate: t.issueDate,
      }));
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const tc = await em
        .getRepository(TransferCertificate)
        .findOne({ where: { id, schoolId } });
      if (!tc) throw new NotFoundException('Transfer certificate not found');
      const [withStudent] = await this.attachStudents(em, schoolId, [tc]);
      return withStudent;
    });
  }

  /**
   * Issue a TC for an admitted student. Generates the TC number, records the
   * last class attended, and transitions the student out of the school
   * (status + active enrollment), so admission and exit stay consistent.
   */
  issue(
    schemaName: string,
    schoolId: string,
    issuedBy: string,
    dto: IssueTcDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const studentRepo = em.getRepository(Student);
      const student = await studentRepo.findOne({
        where: { id: dto.studentId, schoolId },
      });
      if (!student) throw new NotFoundException('Student not found');

      const tcRepo = em.getRepository(TransferCertificate);
      const existing = await tcRepo.findOne({
        where: { schoolId, studentId: dto.studentId },
      });
      if (existing) {
        throw new ConflictException(
          'A transfer certificate has already been issued for this student',
        );
      }

      const lastClass =
        dto.lastClass ?? (await this.resolveLastClass(em, schoolId, student.id));

      const tcNumber = await this.nextTcNumber(em);
      const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();

      const tc = await tcRepo.save(
        tcRepo.create({
          schoolId,
          studentId: student.id,
          tcNumber,
          issueDate,
          reason: dto.reason,
          lastClass,
          conduct: dto.conduct ?? 'good',
          feesCleared: dto.feesCleared ?? false,
          pdfUrl: null,
          issuedBy,
        }),
      );

      // Transition the student out of the active roll.
      student.status = COMPLETION_REASONS.has(dto.reason)
        ? 'alumni'
        : 'transferred';
      await studentRepo.save(student);

      await em
        .getRepository(StudentEnrollment)
        .update(
          { schoolId, studentId: student.id, status: 'active' as any },
          { status: 'transferred' as any },
        );

      // Generate the certificate PDF in the background (Puppeteer is slow).
      await this.enqueuePdf({ schemaName, schoolId, tcId: tc.id });

      const [withStudent] = await this.attachStudents(em, schoolId, [tc]);
      return withStudent;
    });
  }

  /** Re-queue PDF generation for an existing TC (e.g. after a template change). */
  regeneratePdf(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const tc = await em
        .getRepository(TransferCertificate)
        .findOne({ where: { id, schoolId } });
      if (!tc) throw new NotFoundException('Transfer certificate not found');
      await em
        .getRepository(TransferCertificate)
        .update({ id, schoolId }, { pdfUrl: null });
      await this.enqueuePdf({ schemaName, schoolId, tcId: id });
      return { queued: true, id };
    });
  }

  /** Revoke a TC: delete it and restore the student to active status. */
  revoke(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const tcRepo = em.getRepository(TransferCertificate);
      const tc = await tcRepo.findOne({ where: { id, schoolId } });
      if (!tc) throw new NotFoundException('Transfer certificate not found');

      await em
        .getRepository(Student)
        .update({ id: tc.studentId, schoolId }, { status: 'active' });
      await em
        .getRepository(StudentEnrollment)
        .update(
          { schoolId, studentId: tc.studentId, status: 'transferred' as any },
          { status: 'active' as any },
        );

      await this.storage.deleteByUrl(tc.pdfUrl);
      await tcRepo.remove(tc);
      return { revoked: true, id };
    });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private async resolveLastClass(
    em: EntityManager,
    schoolId: string,
    studentId: string,
  ): Promise<string> {
    const enrollment = await em.getRepository(StudentEnrollment).findOne({
      where: { schoolId, studentId },
      order: { createdAt: 'DESC' },
    });
    if (!enrollment) return 'N/A';
    const cls = await em
      .getRepository(ClassEntity)
      .findOne({ where: { id: enrollment.classId, schoolId } });
    return cls?.name ?? 'N/A';
  }

  /** Schema-wide sequential TC number, e.g. TC-2026-000001. */
  private async nextTcNumber(em: EntityManager): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `TC-${year}-`;
    const rows = await em.getRepository(TransferCertificate).find({
      select: { tcNumber: true },
    });
    const re = new RegExp(`^TC-${year}-(\\d+)$`);
    let max = 0;
    for (const r of rows) {
      const m = r.tcNumber?.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    }
    return `${prefix}${String(max + 1).padStart(6, '0')}`;
  }

  private async attachStudents(
    em: EntityManager,
    schoolId: string,
    tcs: TransferCertificate[],
  ) {
    if (tcs.length === 0) return [];
    const ids = [...new Set(tcs.map((t) => t.studentId))];
    const students = await em.getRepository(Student).find({
      where: ids.map((id) => ({ id, schoolId })),
      withDeleted: true,
    });
    const map = new Map(students.map((s) => [s.id, s]));
    return tcs.map((t) => {
      const s = map.get(t.studentId);
      return {
        ...t,
        student: s
          ? {
              id: s.id,
              admissionNumber: s.admissionNumber,
              studentName: s.studentName,
              status: s.status,
            }
          : null,
      };
    });
  }
}
