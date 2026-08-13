import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In, SelectQueryBuilder } from 'typeorm';
import { Student } from '../../../database/tenant/student.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { Section } from '../../../database/tenant/section.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { AcademicYear } from '../../../database/tenant/academic-year.entity';
import { Parent } from '../../../database/tenant/parent.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { paginate } from '../../../common/dto/pagination.dto';
import { getBiometricStatusMap } from '../../../common/biometric/biometric-status.util';
import { CreateStudentDto, UpdateStudentDto } from './dto/student.dto';

export interface StudentListOpts {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  academicYearId?: string;
  classId?: string;
  sectionId?: string;
  status?: string;
}

const STUDENT_SORT: Record<string, string> = {
  name: 's.studentName',
  studentName: 's.studentName',
  admissionNumber: 's.admissionNumber',
  admissionDate: 's.admissionDate',
  dateOfBirth: 's.dateOfBirth',
  status: 's.status',
  createdAt: 's.createdAt',
};

@Injectable()
export class StudentsService {
  constructor(private readonly tenant: TenantSchemaService) {}

  private buildListQuery(
    em: EntityManager,
    schoolId: string,
    opts: StudentListOpts,
  ): SelectQueryBuilder<Student> {
    const qb = em
      .getRepository(Student)
      .createQueryBuilder('s')
      .where('s.schoolId = :schoolId', { schoolId })
      .andWhere('s.deletedAt IS NULL');

    const sortBy = opts.sortBy ?? '';
    const filterByEnrollment = !!(
      opts.academicYearId ||
      opts.classId ||
      opts.sectionId
    );

    if (filterByEnrollment) {
      qb.innerJoin(
        StudentEnrollment,
        'e',
        "e.studentId = s.id AND e.schoolId = s.schoolId AND e.status = 'active'",
      );
      if (opts.academicYearId)
        qb.andWhere('e.academicYearId = :ay', { ay: opts.academicYearId });
      if (opts.classId) qb.andWhere('e.classId = :cid', { cid: opts.classId });
      if (opts.sectionId)
        qb.andWhere('e.sectionId = :sid', { sid: opts.sectionId });
    } else if (sortBy === 'rollNumber') {
      // Sorting by roll without a class/year filter — attach the active
      // enrollment (left join keeps unenrolled students in the list).
      qb.leftJoin(
        StudentEnrollment,
        'e',
        "e.studentId = s.id AND e.schoolId = s.schoolId AND e.status = 'active'",
      );
    }
    if (opts.status) qb.andWhere('s.status = :status', { status: opts.status });
    if (opts.search) {
      const term = `%${opts.search.trim()}%`;
      qb.andWhere(
        '(s.studentName ILIKE :term OR s.admissionNumber ILIKE :term OR s.studentId ILIKE :term)',
        { term },
      );
    }

    const dir = opts.sortOrder === 'asc' ? 'ASC' : 'DESC';
    if (sortBy === 'rollNumber') {
      // Natural numeric ordering: "2" before "10"; non-numeric/blank rolls last.
      // Ordered via a named select alias — TypeORM mis-parses a raw expression
      // containing a "." in orderBy() (it treats the prefix as a table alias).
      qb.addSelect(
        "NULLIF(regexp_replace(COALESCE(e.roll_number, ''), '[^0-9]', '', 'g'), '')::int",
        'roll_sort',
      )
        .orderBy('roll_sort', dir, 'NULLS LAST')
        .addOrderBy('e.rollNumber', dir)
        .addOrderBy('s.id', 'ASC');
    } else {
      const sortCol = STUDENT_SORT[sortBy] ?? 's.createdAt';
      qb.orderBy(sortCol, dir).addOrderBy('s.id', 'ASC');
    }
    return qb;
  }

  private async attachEnrollments(
    em: EntityManager,
    schoolId: string,
    students: Student[],
  ) {
    const ids = students.map((s) => s.id);
    const enrollments = ids.length
      ? await em.getRepository(StudentEnrollment).find({
          where: { schoolId, studentId: In(ids), status: 'active' as any },
        })
      : [];
    const map = new Map<string, StudentEnrollment>();
    for (const e of enrollments) if (!map.has(e.studentId)) map.set(e.studentId, e);
    const bioStatus = await getBiometricStatusMap(em, schoolId, 'studentId', ids);
    return students.map((s) => ({
      ...s,
      enrollment: map.get(s.id) ?? null,
      biometricStatus: bioStatus.get(s.id) ?? 'none',
    }));
  }

  list(schemaName: string, schoolId: string, opts: StudentListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const page = Math.max(1, opts.page ?? 1);
      const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
      const qb = this.buildListQuery(em, schoolId, opts);
      // limit/offset (not take/skip) so TypeORM skips its distinct-id subquery,
      // which mis-handles computed ORDER BY. Safe here: the enrollment join is
      // 1:1 (a single active enrollment), so rows are never multiplied.
      const [students, total] = await qb
        .offset((page - 1) * limit)
        .limit(limit)
        .getManyAndCount();
      const items = await this.attachEnrollments(em, schoolId, students);
      return paginate(items, total, page, limit);
    });
  }

  /** All matching rows (no pagination) for exports. Capped for safety. */
  listAll(schemaName: string, schoolId: string, opts: StudentListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const qb = this.buildListQuery(em, schoolId, opts);
      const students = await qb.limit(10000).getMany();
      return this.attachEnrollments(em, schoolId, students);
    });
  }

  /** Flattened rows (class/section names resolved) for spreadsheet/PDF export. */
  exportRows(schemaName: string, schoolId: string, opts: StudentListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const qb = this.buildListQuery(em, schoolId, opts);
      const students = await qb.limit(10000).getMany();
      const withEnrol = await this.attachEnrollments(em, schoolId, students);
      const classes = await em
        .getRepository(ClassEntity)
        .find({ where: { schoolId } });
      const sections = await em
        .getRepository(Section)
        .find({ where: { schoolId } });
      const cMap = new Map(classes.map((c) => [c.id, c.name]));
      const sMap = new Map(sections.map((s) => [s.id, s.name]));
      return withEnrol.map((s) => ({
        admissionNumber: s.admissionNumber,
        studentId: s.studentId ?? '',
        studentName: s.studentName,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        bloodGroup: s.bloodGroup ?? '',
        religion: s.religion ?? '',
        caste: s.caste ?? '',
        aadharNumber: s.aadharNumber ?? '',
        mobileCountryCode: s.mobileCountryCode ?? '',
        mobile: s.mobile ?? '',
        whatsappCountryCode: s.whatsappCountryCode ?? '',
        whatsapp: s.whatsapp ?? '',
        className: s.enrollment ? cMap.get(s.enrollment.classId) ?? '' : '',
        sectionName:
          s.enrollment?.sectionId != null
            ? sMap.get(s.enrollment.sectionId) ?? ''
            : '',
        rollNumber: s.enrollment?.rollNumber ?? '',
        status: s.status,
        admissionDate: s.admissionDate,
        address: s.address ?? '',
        city: s.city ?? '',
        state: s.state ?? '',
        pincode: s.pincode ?? '',
        previousSchool: s.previousSchool ?? '',
      }));
    });
  }

  /** Lightweight options for pickers/dropdowns. */
  lookup(
    schemaName: string,
    schoolId: string,
    opts: { search?: string; status?: string; limit?: number } = {},
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const qb = em
        .getRepository(Student)
        .createQueryBuilder('s')
        .select([
          's.id',
          's.admissionNumber',
          's.studentId',
          's.studentName',
          's.status',
        ])
        .where('s.schoolId = :schoolId', { schoolId })
        .andWhere('s.deletedAt IS NULL');
      if (opts.status) qb.andWhere('s.status = :st', { st: opts.status });
      if (opts.search) {
        const term = `%${opts.search.trim()}%`;
        qb.andWhere(
          '(s.studentName ILIKE :term OR s.admissionNumber ILIKE :term OR s.studentId ILIKE :term)',
          { term },
        );
      }
      return qb
        .orderBy('s.studentName', 'ASC')
        .take(Math.min(100, opts.limit ?? 50))
        .getMany();
    });
  }

  findOne(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const s = await em
        .getRepository(Student)
        .findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Student not found');
      const enrollment = await em.getRepository(StudentEnrollment).findOne({
        where: { schoolId, studentId: id, status: 'active' as any },
      });
      return { ...s, enrollment };
    });
  }

  create(schemaName: string, schoolId: string, dto: CreateStudentDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const studentRepo = em.getRepository(Student);

      const dup = await studentRepo.findOne({
        where: { schoolId, admissionNumber: dto.admissionNumber },
      });
      if (dup) {
        throw new ConflictException('Admission number already exists');
      }
      if (dto.studentId) {
        const dupSid = await studentRepo.findOne({
          where: { schoolId, studentId: dto.studentId },
        });
        if (dupSid) throw new ConflictException('Student ID already exists');
      }

      const student = await studentRepo.save(
        studentRepo.create({
          schoolId,
          admissionNumber: dto.admissionNumber,
          studentId: dto.studentId ?? null,
          studentName: dto.studentName,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          bloodGroup: dto.bloodGroup ?? null,
          religion: dto.religion ?? null,
          caste: dto.caste ?? null,
          aadharNumber: dto.aadharNumber ?? null,
          photoUrl: dto.photoUrl ?? null,
          mobileCountryCode: dto.mobileCountryCode ?? null,
          mobile: dto.mobile ?? null,
          whatsappCountryCode: dto.whatsappCountryCode ?? null,
          whatsapp: dto.whatsapp ?? null,
          address: dto.address ?? null,
          city: dto.city ?? null,
          state: dto.state ?? null,
          pincode: dto.pincode ?? null,
          previousSchool: dto.previousSchool ?? null,
          admissionDate: new Date(dto.admissionDate),
          status: dto.status ?? 'active',
          userId: null,
        }),
      );

      // Enrollment is optional; the helper enforces "all-or-nothing" on the trio.
      await this.upsertEnrollment(
        em,
        schoolId,
        student.id,
        dto,
        new Date(dto.admissionDate),
      );

      // Inline parents/guardians — created in the SAME transaction so a bad
      // parent rolls back the whole admission (no orphaned student).
      if (dto.parents?.length) {
        const parentRepo = em.getRepository(Parent);
        let primaryTaken = false;
        for (const p of dto.parents) {
          const isPrimary = !!p.isPrimary && !primaryTaken;
          if (isPrimary) primaryTaken = true;
          await parentRepo.save(
            parentRepo.create({
              schoolId,
              studentId: student.id,
              relation: p.relation,
              name: p.name,
              phoneCountryCode: p.phoneCountryCode ?? null,
              phone: p.phone,
              whatsappCountryCode: p.whatsappCountryCode ?? null,
              whatsapp: p.whatsapp ?? null,
              email: p.email ?? null,
              occupation: p.occupation ?? null,
              annualIncome: p.annualIncome ?? null,
              aadharNumber: p.aadharNumber ?? null,
              isPrimary,
              userId: null,
            }),
          );
        }
      }

      // Resolve within the SAME transaction — calling this.findOne() here would
      // open a separate transaction that can't see this not-yet-committed insert.
      const enrollment = await em.getRepository(StudentEnrollment).findOne({
        where: { schoolId, studentId: student.id, status: 'active' as any },
      });
      return { ...student, enrollment };
    });
  }

  update(
    schemaName: string,
    schoolId: string,
    id: string,
    dto: UpdateStudentDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Student);
      const s = await repo.findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Student not found');

      if (dto.admissionNumber && dto.admissionNumber !== s.admissionNumber) {
        const dup = await repo.findOne({
          where: { schoolId, admissionNumber: dto.admissionNumber },
        });
        if (dup) throw new ConflictException('Admission number already exists');
      }
      if (dto.studentId && dto.studentId !== s.studentId) {
        const dupSid = await repo.findOne({
          where: { schoolId, studentId: dto.studentId },
        });
        if (dupSid) throw new ConflictException('Student ID already exists');
      }

      // Whitelist profile columns — never blindly spread enrollment-only keys
      // (academicYearId/classId/sectionId/rollNumber) onto the Student entity.
      const profileKeys = [
        'admissionNumber',
        'studentId',
        'studentName',
        'gender',
        'bloodGroup',
        'religion',
        'caste',
        'aadharNumber',
        'photoUrl',
        'mobileCountryCode',
        'mobile',
        'whatsappCountryCode',
        'whatsapp',
        'address',
        'city',
        'state',
        'pincode',
        'previousSchool',
        'status',
      ] as const;
      const target = s as unknown as Record<string, unknown>;
      for (const k of profileKeys) {
        if (dto[k] !== undefined) target[k] = dto[k];
      }
      if (dto.dateOfBirth) s.dateOfBirth = new Date(dto.dateOfBirth);
      if (dto.admissionDate) s.admissionDate = new Date(dto.admissionDate);
      await repo.save(s);

      // Move/assign enrollment when the class/section trio is supplied.
      await this.upsertEnrollment(em, schoolId, s.id, dto, new Date());

      const enrollment = await em.getRepository(StudentEnrollment).findOne({
        where: { schoolId, studentId: s.id, status: 'active' as any },
      });
      return { ...s, enrollment };
    });
  }

  remove(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const repo = em.getRepository(Student);
      const s = await repo.findOne({ where: { id, schoolId } });
      if (!s) throw new NotFoundException('Student not found');
      await repo.softRemove(s);
      return { deleted: true, id };
    });
  }

  /**
   * Permanently delete EVERY student for the school AND all rows linked to them
   * (enrollments, attendance, marks, fees, parents, documents, …). This is a
   * hard delete — unlike single-student soft-delete — so admission numbers are
   * freed for a clean re-import. Runs inside runInSchema's transaction, so it is
   * all-or-nothing. Restricted to admins; the UI requires a type-to-confirm.
   */
  removeAll(schemaName: string, schoolId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      // Every student-linked table carries a `student_id` column (discovered
      // dynamically so new tables are covered automatically). No FK constraints
      // exist, so order is irrelevant; we scope by school_id (shared_pool is
      // multi-tenant) and only touch rows actually tied to a student.
      const childTables: { table_name: string }[] = await em.query(
        `SELECT table_name FROM information_schema.columns
         WHERE table_schema = current_schema()
           AND column_name = 'student_id'
           AND table_name <> 'students'`,
      );
      let related = 0;
      for (const { table_name } of childTables) {
        // Count first (em.query's return shape varies for DELETE), then delete
        // in the same transaction so the tally is exact.
        const cnt = await em.query(
          `SELECT count(*)::int AS n FROM "${table_name}"
           WHERE school_id = $1 AND student_id IS NOT NULL`,
          [schoolId],
        );
        const n: number = cnt?.[0]?.n ?? 0;
        if (n > 0) {
          await em.query(
            `DELETE FROM "${table_name}"
             WHERE school_id = $1 AND student_id IS NOT NULL`,
            [schoolId],
          );
          related += n;
        }
      }
      // Hard-delete the students themselves (bypasses soft-delete → frees the
      // admission numbers held by the unique (school_id, admission_number) index).
      const del = await em
        .getRepository(Student)
        .createQueryBuilder()
        .delete()
        .where('schoolId = :schoolId', { schoolId })
        .execute();
      return { deleted: del.affected ?? 0, related };
    });
  }

  /** Suggest the next admission number, e.g. ADM2026051, scoped to the school. */
  nextAdmissionNumber(schemaName: string, schoolId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const year = new Date().getFullYear();
      const prefix = `ADM${year}`;
      const rows = await em.getRepository(Student).find({
        where: { schoolId },
        withDeleted: true, // never reuse a soft-deleted student's number
        select: { admissionNumber: true },
      });
      const re = new RegExp(`^${prefix}(\\d+)$`);
      let max = 0;
      for (const r of rows) {
        const m = r.admissionNumber?.match(re);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > max) max = n;
        }
      }
      const seq = String(max + 1).padStart(3, '0');
      return { admissionNumber: `${prefix}${seq}` };
    });
  }

  /**
   * Create or update the student's enrollment for an academic year.
   * Enforces the all-or-nothing rule on (academicYearId, classId, sectionId);
   * a no-op when none are provided. Must run inside an existing transaction.
   */
  private async upsertEnrollment(
    em: import('typeorm').EntityManager,
    schoolId: string,
    studentId: string,
    dto: Partial<CreateStudentDto>,
    fallbackDate: Date,
  ) {
    const hasAny = dto.academicYearId || dto.classId || dto.sectionId;
    if (!hasAny) return;
    // Year + class are required to enroll; section is optional (classes that
    // aren't split into groups enroll students directly into the class).
    if (!dto.academicYearId || !dto.classId) {
      throw new BadRequestException(
        'academicYearId and classId are required to enroll',
      );
    }
    const ay = await em
      .getRepository(AcademicYear)
      .findOne({ where: { id: dto.academicYearId, schoolId } });
    if (!ay) throw new NotFoundException('Academic year not found');
    if (dto.sectionId) {
      const sec = await em
        .getRepository(Section)
        .findOne({ where: { id: dto.sectionId, schoolId } });
      if (!sec) throw new NotFoundException('Section not found');
      if (sec.classId !== dto.classId) {
        throw new BadRequestException(
          'Section does not belong to the given class',
        );
      }
    }

    const enrolRepo = em.getRepository(StudentEnrollment);
    const existing = await enrolRepo.findOne({
      where: { schoolId, studentId, academicYearId: dto.academicYearId },
    });
    if (existing) {
      existing.classId = dto.classId;
      existing.sectionId = dto.sectionId ?? null;
      if (dto.rollNumber !== undefined) {
        existing.rollNumber = dto.rollNumber ?? null;
      }
      existing.status = 'active' as any;
      return enrolRepo.save(existing);
    }
    return enrolRepo.save(
      enrolRepo.create({
        schoolId,
        studentId,
        academicYearId: dto.academicYearId,
        classId: dto.classId,
        sectionId: dto.sectionId ?? null,
        rollNumber: dto.rollNumber ?? null,
        enrollmentDate: fallbackDate,
        status: 'active' as any,
      }),
    );
  }
}
