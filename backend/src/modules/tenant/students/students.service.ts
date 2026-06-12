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
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { paginate } from '../../../common/dto/pagination.dto';
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
  name: 's.firstName',
  firstName: 's.firstName',
  lastName: 's.lastName',
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

    if (opts.academicYearId || opts.classId || opts.sectionId) {
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
    }
    if (opts.status) qb.andWhere('s.status = :status', { status: opts.status });
    if (opts.search) {
      const term = `%${opts.search.trim()}%`;
      qb.andWhere(
        '(s.firstName ILIKE :term OR s.lastName ILIKE :term OR s.admissionNumber ILIKE :term)',
        { term },
      );
    }

    const sortCol = STUDENT_SORT[opts.sortBy ?? ''] ?? 's.createdAt';
    const dir = opts.sortOrder === 'asc' ? 'ASC' : 'DESC';
    qb.orderBy(sortCol, dir).addOrderBy('s.id', 'ASC');
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
    return students.map((s) => ({ ...s, enrollment: map.get(s.id) ?? null }));
  }

  list(schemaName: string, schoolId: string, opts: StudentListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const page = Math.max(1, opts.page ?? 1);
      const limit = Math.min(200, Math.max(1, opts.limit ?? 20));
      const qb = this.buildListQuery(em, schoolId, opts);
      const [students, total] = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();
      const items = await this.attachEnrollments(em, schoolId, students);
      return paginate(items, total, page, limit);
    });
  }

  /** All matching rows (no pagination) for exports. Capped for safety. */
  listAll(schemaName: string, schoolId: string, opts: StudentListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const qb = this.buildListQuery(em, schoolId, opts);
      const students = await qb.take(10000).getMany();
      return this.attachEnrollments(em, schoolId, students);
    });
  }

  /** Flattened rows (class/section names resolved) for spreadsheet/PDF export. */
  exportRows(schemaName: string, schoolId: string, opts: StudentListOpts = {}) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const qb = this.buildListQuery(em, schoolId, opts);
      const students = await qb.take(10000).getMany();
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
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender,
        dateOfBirth: s.dateOfBirth,
        className: s.enrollment ? cMap.get(s.enrollment.classId) ?? '' : '',
        sectionName:
          s.enrollment?.sectionId != null
            ? sMap.get(s.enrollment.sectionId) ?? ''
            : '',
        rollNumber: s.enrollment?.rollNumber ?? '',
        status: s.status,
        admissionDate: s.admissionDate,
        city: s.city ?? '',
        phone: '',
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
          's.firstName',
          's.lastName',
          's.status',
        ])
        .where('s.schoolId = :schoolId', { schoolId })
        .andWhere('s.deletedAt IS NULL');
      if (opts.status) qb.andWhere('s.status = :st', { st: opts.status });
      if (opts.search) {
        const term = `%${opts.search.trim()}%`;
        qb.andWhere(
          '(s.firstName ILIKE :term OR s.lastName ILIKE :term OR s.admissionNumber ILIKE :term)',
          { term },
        );
      }
      return qb
        .orderBy('s.firstName', 'ASC')
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

      const student = await studentRepo.save(
        studentRepo.create({
          schoolId,
          admissionNumber: dto.admissionNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dateOfBirth: new Date(dto.dateOfBirth),
          gender: dto.gender,
          bloodGroup: dto.bloodGroup ?? null,
          religion: dto.religion ?? null,
          caste: dto.caste ?? null,
          aadharNumber: dto.aadharNumber ?? null,
          photoUrl: dto.photoUrl ?? null,
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

      // Whitelist profile columns — never blindly spread enrollment-only keys
      // (academicYearId/classId/sectionId/rollNumber) onto the Student entity.
      const profileKeys = [
        'admissionNumber',
        'firstName',
        'lastName',
        'gender',
        'bloodGroup',
        'religion',
        'caste',
        'aadharNumber',
        'photoUrl',
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
