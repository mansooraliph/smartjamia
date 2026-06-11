import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Timetable } from '../../../database/tenant/timetable.entity';
import { Section } from '../../../database/tenant/section.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Subject } from '../../../database/tenant/subject.entity';
import { Staff } from '../../../database/tenant/staff.entity';
import { User } from '../../../database/tenant/user.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { DAYS_OF_WEEK, SaveTimetableDto } from './dto/timetable.dto';

export interface ReadablePeriod {
  periodNumber: number;
  startTime: string;
  endTime: string;
}
export interface ReadableCell {
  dayOfWeek: string;
  periodNumber: number;
  subjectId: string;
  subject: string;
  code: string;
  staffId: string | null;
  teacher: string | null;
}

@Injectable()
export class TimetableService {
  constructor(private readonly tenant: TenantSchemaService) {}

  // ── Admin editor: section grid + pick-lists ─────────────────────────────────
  editorGrid(
    schemaName: string,
    schoolId: string,
    sectionId: string,
    academicYearId: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const { section, cls } = await this.sectionContext(em, schoolId, sectionId);
      const rows = await em.getRepository(Timetable).find({
        where: { schoolId, sectionId, academicYearId },
      });

      const subjects = await em.getRepository(Subject).find({
        where: { schoolId, classId: cls.id },
        order: { name: 'ASC' },
      });
      const teachers = await this.teacherList(em, schoolId);

      // Derive period rows (number → time) from existing entries, sorted.
      const periodMap = new Map<number, ReadablePeriod>();
      for (const r of rows) {
        if (!periodMap.has(r.periodNumber)) {
          periodMap.set(r.periodNumber, {
            periodNumber: r.periodNumber,
            startTime: (r.startTime ?? '').slice(0, 5),
            endTime: (r.endTime ?? '').slice(0, 5),
          });
        }
      }
      const periods = [...periodMap.values()].sort(
        (a, b) => a.periodNumber - b.periodNumber,
      );

      const cells: Record<
        string,
        { subjectId: string; staffId: string | null }
      > = {};
      for (const r of rows) {
        cells[`${r.dayOfWeek}:${r.periodNumber}`] = {
          subjectId: r.subjectId,
          staffId: r.staffId,
        };
      }

      return {
        section: { id: section.id, name: section.name, classId: cls.id },
        className: cls.name,
        days: DAYS_OF_WEEK,
        periods,
        cells,
        subjects: subjects.map((s) => ({
          id: s.id,
          name: s.name,
          code: s.code,
        })),
        teachers,
      };
    });
  }

  // ── Admin save: replace section's timetable for the year ────────────────────
  save(schemaName: string, schoolId: string, dto: SaveTimetableDto) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const { cls } = await this.sectionContext(em, schoolId, dto.sectionId);

      // Validate period uniqueness + time order.
      const periodTimes = new Map<number, { start: string; end: string }>();
      for (const p of dto.periods) {
        if (periodTimes.has(p.periodNumber)) {
          throw new BadRequestException(
            `Duplicate period number ${p.periodNumber}`,
          );
        }
        if (p.startTime >= p.endTime) {
          throw new BadRequestException(
            `Period ${p.periodNumber}: start time must be before end time`,
          );
        }
        periodTimes.set(p.periodNumber, {
          start: p.startTime,
          end: p.endTime,
        });
      }

      // Validate referenced subjects belong to the section's class.
      const subjectIds = [...new Set(dto.cells.map((c) => c.subjectId))];
      if (subjectIds.length) {
        const subjects = await em
          .getRepository(Subject)
          .find({ where: { schoolId, id: In(subjectIds) } });
        const byId = new Map(subjects.map((s) => [s.id, s]));
        for (const id of subjectIds) {
          const s = byId.get(id);
          if (!s) throw new BadRequestException('Unknown subject in timetable');
          if (s.classId !== cls.id) {
            throw new BadRequestException(
              `Subject "${s.name}" does not belong to ${cls.name}`,
            );
          }
        }
      }

      const repo = em.getRepository(Timetable);
      await repo.delete({
        schoolId,
        sectionId: dto.sectionId,
        academicYearId: dto.academicYearId,
      });

      const toInsert: Partial<Timetable>[] = [];
      for (const c of dto.cells) {
        const t = periodTimes.get(c.periodNumber);
        if (!t) {
          throw new BadRequestException(
            `Cell references undefined period ${c.periodNumber}`,
          );
        }
        toInsert.push({
          schoolId,
          sectionId: dto.sectionId,
          academicYearId: dto.academicYearId,
          subjectId: c.subjectId,
          staffId: c.staffId ?? null,
          dayOfWeek: c.dayOfWeek,
          periodNumber: c.periodNumber,
          startTime: t.start,
          endTime: t.end,
        });
      }
      if (toInsert.length) {
        await repo.save(repo.create(toInsert));
      }
      return { saved: toInsert.length, periods: dto.periods.length };
    });
  }

  // ── Teacher: my weekly schedule (JWT user → staff) ──────────────────────────
  mySchedule(schemaName: string, schoolId: string, userId: string) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const staff = await em
        .getRepository(Staff)
        .findOne({ where: { schoolId, userId } });
      if (!staff) {
        return { isTeacher: false, periods: [], days: DAYS_OF_WEEK, slots: [] };
      }
      const rows = await em.getRepository(Timetable).find({
        where: { schoolId, staffId: staff.id },
      });
      return this.shapeStaffSchedule(em, schoolId, rows);
    });
  }

  // ── Readable section grid (shared with portal) ──────────────────────────────
  async readableSectionGrid(
    em: EntityManager,
    schoolId: string,
    sectionId: string,
    academicYearId: string,
  ) {
    const { section, cls } = await this.sectionContext(em, schoolId, sectionId);
    const rows = await em.getRepository(Timetable).find({
      where: { schoolId, sectionId, academicYearId },
    });

    const subjIds = [...new Set(rows.map((r) => r.subjectId))];
    const staffIds = [...new Set(rows.map((r) => r.staffId).filter(Boolean))] as string[];
    const subjMap = subjIds.length
      ? new Map(
          (
            await em
              .getRepository(Subject)
              .find({ where: { schoolId, id: In(subjIds) } })
          ).map((s) => [s.id, s]),
        )
      : new Map();
    const teacherNameById = await this.staffNameMap(em, schoolId, staffIds);

    const periodMap = new Map<number, ReadablePeriod>();
    const cells: ReadableCell[] = [];
    for (const r of rows) {
      if (!periodMap.has(r.periodNumber)) {
        periodMap.set(r.periodNumber, {
          periodNumber: r.periodNumber,
          startTime: (r.startTime ?? '').slice(0, 5),
          endTime: (r.endTime ?? '').slice(0, 5),
        });
      }
      const subj = subjMap.get(r.subjectId);
      cells.push({
        dayOfWeek: r.dayOfWeek,
        periodNumber: r.periodNumber,
        subjectId: r.subjectId,
        subject: subj?.name ?? '—',
        code: subj?.code ?? '',
        staffId: r.staffId,
        teacher: r.staffId ? teacherNameById.get(r.staffId) ?? null : null,
      });
    }
    return {
      section: { id: section.id, name: section.name },
      className: cls.name,
      days: DAYS_OF_WEEK,
      periods: [...periodMap.values()].sort(
        (a, b) => a.periodNumber - b.periodNumber,
      ),
      cells,
    };
  }

  /** Portal: resolve the student's active section, then its timetable. */
  studentTimetable(
    em: EntityManager,
    schoolId: string,
    studentId: string,
  ) {
    return (async () => {
      const enrollment = await em.getRepository(StudentEnrollment).findOne({
        where: { schoolId, studentId, status: 'active' as any },
      });
      if (!enrollment?.sectionId) {
        return { enrolled: false as const, grid: null };
      }
      const grid = await this.readableSectionGrid(
        em,
        schoolId,
        enrollment.sectionId,
        enrollment.academicYearId,
      );
      return { enrolled: true as const, grid };
    })();
  }

  // ── helpers ─────────────────────────────────────────────────────────────────
  private async sectionContext(
    em: EntityManager,
    schoolId: string,
    sectionId: string,
  ) {
    const section = await em
      .getRepository(Section)
      .findOne({ where: { id: sectionId, schoolId } });
    if (!section) throw new NotFoundException('Section not found');
    const cls = await em
      .getRepository(ClassEntity)
      .findOne({ where: { id: section.classId, schoolId } });
    if (!cls) throw new NotFoundException('Class not found');
    return { section, cls };
  }

  private async teacherList(em: EntityManager, schoolId: string) {
    const staff = await em.getRepository(Staff).find({
      where: { schoolId, status: 'active' as any },
    });
    const nameById = await this.staffNameMap(
      em,
      schoolId,
      staff.map((s) => s.userId),
      'user',
    );
    return staff
      .map((s) => ({
        id: s.id,
        name: nameById.get(s.userId) ?? s.employeeId,
        designation: s.designation,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Map staff.id (or user.id when key='user') → display name. */
  private async staffNameMap(
    em: EntityManager,
    schoolId: string,
    ids: string[],
    key: 'staff' | 'user' = 'staff',
  ): Promise<Map<string, string>> {
    if (!ids.length) return new Map();
    if (key === 'user') {
      const users = await em
        .getRepository(User)
        .find({ where: { id: In(ids), schoolId } });
      return new Map(users.map((u) => [u.id, u.name]));
    }
    const staff = await em
      .getRepository(Staff)
      .find({ where: { id: In(ids), schoolId } });
    const users = await em
      .getRepository(User)
      .find({ where: { id: In(staff.map((s) => s.userId)), schoolId } });
    const userName = new Map(users.map((u) => [u.id, u.name]));
    return new Map(staff.map((s) => [s.id, userName.get(s.userId) ?? s.employeeId]));
  }

  private async shapeStaffSchedule(
    em: EntityManager,
    schoolId: string,
    rows: Timetable[],
  ) {
    const sectionIds = [...new Set(rows.map((r) => r.sectionId))];
    const subjIds = [...new Set(rows.map((r) => r.subjectId))];
    const sections = sectionIds.length
      ? await em
          .getRepository(Section)
          .find({ where: { id: In(sectionIds), schoolId } })
      : [];
    const classIds = [...new Set(sections.map((s) => s.classId))];
    const classes = classIds.length
      ? await em
          .getRepository(ClassEntity)
          .find({ where: { id: In(classIds), schoolId } })
      : [];
    const classById = new Map(classes.map((c) => [c.id, c]));
    const sectionLabel = new Map(
      sections.map((s) => [
        s.id,
        `${classById.get(s.classId)?.name ?? ''} ${s.name}`.trim(),
      ]),
    );
    const subjMap = subjIds.length
      ? new Map(
          (
            await em
              .getRepository(Subject)
              .find({ where: { id: In(subjIds), schoolId } })
          ).map((s) => [s.id, s]),
        )
      : new Map();

    const periodMap = new Map<number, ReadablePeriod>();
    const slots = rows.map((r) => {
      if (!periodMap.has(r.periodNumber)) {
        periodMap.set(r.periodNumber, {
          periodNumber: r.periodNumber,
          startTime: (r.startTime ?? '').slice(0, 5),
          endTime: (r.endTime ?? '').slice(0, 5),
        });
      }
      const subj = subjMap.get(r.subjectId);
      return {
        dayOfWeek: r.dayOfWeek,
        periodNumber: r.periodNumber,
        subject: subj?.name ?? '—',
        code: subj?.code ?? '',
        section: sectionLabel.get(r.sectionId) ?? '',
      };
    });
    return {
      isTeacher: true,
      days: DAYS_OF_WEEK,
      periods: [...periodMap.values()].sort(
        (a, b) => a.periodNumber - b.periodNumber,
      ),
      slots,
    };
  }
}
