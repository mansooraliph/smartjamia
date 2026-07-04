import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { In } from 'typeorm';
import { Attendance } from '../../../database/tenant/attendance.entity';
import { Student } from '../../../database/tenant/student.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { Section } from '../../../database/tenant/section.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { BulkMarkAttendanceDto } from './dto/attendance.dto';

export interface SectionAttendanceRow {
  studentId: string;
  admissionNumber: string;
  studentName: string;
  rollNumber: string | null;
  status: string | null;
  note: string | null;
  attendanceId: string | null;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly tenant: TenantSchemaService) {}

  /**
   * Returns each enrolled student in the section + their attendance state
   * for the given date (null if not yet marked).
   */
  getForSection(
    schemaName: string,
    schoolId: string,
    sectionId: string,
    date: string,
  ): Promise<{
    sectionId: string;
    className: string;
    sectionName: string;
    date: string;
    rows: SectionAttendanceRow[];
    summary: Record<string, number>;
  }> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const section = await em
        .getRepository(Section)
        .findOne({ where: { id: sectionId, schoolId } });
      if (!section) throw new NotFoundException('Section not found');
      const cls = await em
        .getRepository(ClassEntity)
        .findOne({ where: { id: section.classId, schoolId } });

      const enrollments = await em.getRepository(StudentEnrollment).find({
        where: {
          schoolId,
          sectionId,
          status: 'active' as any,
        },
      });
      const studentIds = enrollments.map((e) => e.studentId);
      if (studentIds.length === 0) {
        return {
          sectionId,
          className: cls?.name ?? '',
          sectionName: section.name,
          date,
          rows: [],
          summary: { present: 0, absent: 0, late: 0, holiday: 0, half_day: 0 },
        };
      }

      const students = await em
        .getRepository(Student)
        .find({ where: { id: In(studentIds), schoolId } });
      const studentById = new Map(students.map((s) => [s.id, s]));
      const rollById = new Map(
        enrollments.map((e) => [e.studentId, e.rollNumber]),
      );

      const attendance = await em.getRepository(Attendance).find({
        where: {
          schoolId,
          sectionId,
          date: new Date(date) as any,
          studentId: In(studentIds),
        },
      });
      const attById = new Map(attendance.map((a) => [a.studentId, a]));

      const rows: SectionAttendanceRow[] = students
        .map((s) => ({
          studentId: s.id,
          admissionNumber: s.admissionNumber,
          studentName: s.studentName,
          rollNumber: rollById.get(s.id) ?? null,
          status: attById.get(s.id)?.status ?? null,
          note: attById.get(s.id)?.note ?? null,
          attendanceId: attById.get(s.id)?.id ?? null,
        }))
        .sort((a, b) => {
          const ar = parseInt(a.rollNumber ?? '99999', 10);
          const br = parseInt(b.rollNumber ?? '99999', 10);
          if (ar !== br) return ar - br;
          return a.studentName.localeCompare(b.studentName);
        });

      const summary = { present: 0, absent: 0, late: 0, holiday: 0, half_day: 0 };
      for (const r of rows) {
        if (r.status && r.status in summary) {
          (summary as any)[r.status] += 1;
        }
      }

      return {
        sectionId,
        className: cls?.name ?? '',
        sectionName: section.name,
        date,
        rows,
        summary,
      };
    });
  }

  /**
   * Bulk upsert attendance for the given section + date.
   * Existing records (unique by student_id + date) get updated;
   * missing ones get inserted.
   */
  bulkMark(
    schemaName: string,
    schoolId: string,
    markedBy: string,
    dto: BulkMarkAttendanceDto,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const section = await em
        .getRepository(Section)
        .findOne({ where: { id: dto.sectionId, schoolId } });
      if (!section) throw new NotFoundException('Section not found');

      const enrollments = await em.getRepository(StudentEnrollment).find({
        where: {
          schoolId,
          sectionId: dto.sectionId,
          academicYearId: dto.academicYearId,
          status: 'active' as any,
        },
      });
      const enrolledIds = new Set(enrollments.map((e) => e.studentId));

      const invalid = dto.entries.find((e) => !enrolledIds.has(e.studentId));
      if (invalid) {
        throw new BadRequestException(
          `Student ${invalid.studentId} is not enrolled in this section`,
        );
      }

      const attRepo = em.getRepository(Attendance);
      const dateObj = new Date(dto.date);

      const existing = await attRepo.find({
        where: {
          schoolId,
          sectionId: dto.sectionId,
          date: dateObj as any,
          studentId: In(dto.entries.map((e) => e.studentId)),
        },
      });
      const existingByStudent = new Map(existing.map((a) => [a.studentId, a]));

      const records = dto.entries.map((entry) => {
        const found = existingByStudent.get(entry.studentId);
        if (found) {
          found.status = entry.status as any;
          found.note = entry.note ?? null;
          found.markedBy = markedBy;
          return found;
        }
        return attRepo.create({
          schoolId,
          studentId: entry.studentId,
          sectionId: dto.sectionId,
          academicYearId: dto.academicYearId,
          date: dateObj as any,
          status: entry.status as any,
          markedBy,
          note: entry.note ?? null,
        });
      });

      const saved = await attRepo.save(records);
      return {
        saved: saved.length,
        date: dto.date,
        sectionId: dto.sectionId,
      };
    });
  }

  /**
   * Student attendance counts (P/A/L/HD) over a date range
   * (defaults to the entire current academic year).
   */
  studentSummary(
    schemaName: string,
    schoolId: string,
    studentId: string,
    academicYearId?: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const qb = em
        .getRepository(Attendance)
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('a.schoolId = :schoolId', { schoolId })
        .andWhere('a.studentId = :studentId', { studentId })
        .groupBy('a.status');
      if (academicYearId) {
        qb.andWhere('a.academicYearId = :ayId', { ayId: academicYearId });
      }
      const rows = await qb.getRawMany<{ status: string; count: string }>();
      const result = {
        present: 0,
        absent: 0,
        late: 0,
        holiday: 0,
        half_day: 0,
        total: 0,
      } as Record<string, number>;
      for (const r of rows) {
        const n = Number(r.count);
        result[r.status] = n;
        result.total += n;
      }
      return result;
    });
  }
}
