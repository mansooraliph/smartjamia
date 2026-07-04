import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { EntityManager, In } from 'typeorm';
import { Student } from '../../../database/tenant/student.entity';
import { Parent } from '../../../database/tenant/parent.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Section } from '../../../database/tenant/section.entity';
import { Attendance } from '../../../database/tenant/attendance.entity';
import { Mark } from '../../../database/tenant/mark.entity';
import { Exam } from '../../../database/tenant/exam.entity';
import { Subject } from '../../../database/tenant/subject.entity';
import { User } from '../../../database/tenant/user.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { gradeFor } from '../exams/exams.service';
import { TimetableService } from '../timetable/timetable.service';
import { ReportCardsService } from '../report-cards/report-cards.service';

const PIN_RE = /^\d{4,6}$/;

@Injectable()
export class PortalService {
  constructor(
    private readonly tenant: TenantSchemaService,
    private readonly config: ConfigService,
    private readonly timetableSvc: TimetableService,
    private readonly reportCardsSvc: ReportCardsService,
  ) {}

  private rounds() {
    return Number(this.config.get('BCRYPT_ROUNDS', 12));
  }

  // ── Provisioning (admin) ────────────────────────────────────────────────────
  setStudentPin(schemaName: string, schoolId: string, id: string, pin: string) {
    return this.tenant.runInSchema(schemaName, (em) =>
      this.setPin(em, schoolId, 'student', id, pin),
    );
  }
  setParentPin(schemaName: string, schoolId: string, id: string, pin: string) {
    return this.tenant.runInSchema(schemaName, (em) =>
      this.setPin(em, schoolId, 'parent', id, pin),
    );
  }
  removeStudentPortal(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, (em) =>
      this.removePortal(em, schoolId, 'student', id),
    );
  }
  removeParentPortal(schemaName: string, schoolId: string, id: string) {
    return this.tenant.runInSchema(schemaName, (em) =>
      this.removePortal(em, schoolId, 'parent', id),
    );
  }

  private async setPin(
    em: EntityManager,
    schoolId: string,
    kind: 'student' | 'parent',
    id: string,
    pin: string,
  ) {
    if (!PIN_RE.test(pin)) {
      throw new BadRequestException('PIN must be 4–6 digits');
    }
    const entity = await this.loadEntity(em, schoolId, kind, id);
    const name =
      kind === 'student'
        ? (entity as Student).studentName
        : (entity as Parent).name;
    // Portal users log in by admission#/mobile + PIN; email is a synthetic,
    // unique placeholder to satisfy the NOT-NULL users.email column.
    const syntheticEmail =
      kind === 'student'
        ? `${(entity as Student).admissionNumber.toLowerCase()}@student.portal`
        : `parent-${id}@parent.portal`;
    const pinHash = await bcrypt.hash(pin, this.rounds());
    const userRepo = em.getRepository(User);

    const existing = entity.userId
      ? await userRepo.findOne({ where: { id: entity.userId, schoolId } })
      : null;

    let userId: string;
    if (existing) {
      existing.pinHash = pinHash;
      existing.isActive = true;
      existing.role = kind;
      existing.name = name;
      await userRepo.save(existing);
      userId = existing.id;
    } else {
      const created = await userRepo.save(
        userRepo.create({
          schoolId,
          name,
          email: syntheticEmail,
          passwordHash: null,
          pinHash,
          role: kind,
          isActive: true,
        }),
      );
      userId = created.id;
      const repo =
        kind === 'student'
          ? em.getRepository(Student)
          : em.getRepository(Parent);
      await repo.update({ id, schoolId }, { userId });
    }

    const loginId =
      kind === 'student'
        ? (entity as Student).admissionNumber
        : (entity as Parent).phone;
    return { portalEnabled: true, kind, loginId };
  }

  private async removePortal(
    em: EntityManager,
    schoolId: string,
    kind: 'student' | 'parent',
    id: string,
  ) {
    const entity = await this.loadEntity(em, schoolId, kind, id);
    if (entity.userId) {
      const repo =
        kind === 'student'
          ? em.getRepository(Student)
          : em.getRepository(Parent);
      await repo.update({ id, schoolId }, { userId: null });
      await em.getRepository(User).delete({ id: entity.userId, schoolId });
    }
    return { portalEnabled: false };
  }

  private async loadEntity(
    em: EntityManager,
    schoolId: string,
    kind: 'student' | 'parent',
    id: string,
  ): Promise<Student | Parent> {
    const repo =
      kind === 'student' ? em.getRepository(Student) : em.getRepository(Parent);
    const entity = await repo.findOne({ where: { id, schoolId } as any });
    if (!entity) {
      throw new NotFoundException(
        `${kind === 'student' ? 'Student' : 'Parent'} not found`,
      );
    }
    return entity as Student | Parent;
  }

  // ── Portal profile (logged-in student / parent) ─────────────────────────────
  me(
    schemaName: string,
    schoolId: string,
    role: 'student' | 'parent',
    refId: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      if (role === 'student') {
        const student = await em
          .getRepository(Student)
          .findOne({ where: { id: refId, schoolId } });
        if (!student) throw new NotFoundException('Student not found');
        return {
          role,
          student: await this.studentProfile(em, schoolId, student),
        };
      }
      const parent = await em
        .getRepository(Parent)
        .findOne({ where: { id: refId, schoolId } });
      if (!parent) throw new NotFoundException('Parent not found');
      const student = await em
        .getRepository(Student)
        .findOne({ where: { id: parent.studentId, schoolId } });
      return {
        role,
        parent: {
          id: parent.id,
          name: parent.name,
          relation: parent.relation,
          phone: parent.phone,
          email: parent.email,
        },
        student: student
          ? await this.studentProfile(em, schoolId, student)
          : null,
      };
    });
  }

  // ── Attendance (portal) ─────────────────────────────────────────────────────
  attendance(
    schemaName: string,
    schoolId: string,
    role: 'student' | 'parent',
    refId: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const studentId = await this.resolveStudentId(em, schoolId, role, refId);
      const enrollment = await em.getRepository(StudentEnrollment).findOne({
        where: { schoolId, studentId, status: 'active' as any },
      });
      const academicYearId = enrollment?.academicYearId;

      const repo = em.getRepository(Attendance);
      const counts = { present: 0, absent: 0, late: 0, half_day: 0, holiday: 0 };
      const rows = await repo
        .createQueryBuilder('a')
        .select('a.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('a.schoolId = :schoolId', { schoolId })
        .andWhere('a.studentId = :studentId', { studentId })
        .andWhere(
          academicYearId ? 'a.academicYearId = :ay' : '1=1',
          academicYearId ? { ay: academicYearId } : {},
        )
        .groupBy('a.status')
        .getRawMany<{ status: string; count: string }>();
      for (const r of rows) {
        if (r.status in counts)
          (counts as Record<string, number>)[r.status] = Number(r.count);
      }
      const working =
        counts.present + counts.absent + counts.late + counts.half_day;
      const presentEquiv = counts.present + counts.late + counts.half_day * 0.5;
      const percentage =
        working > 0 ? Math.round((presentEquiv / working) * 1000) / 10 : null;

      const recent = await repo.find({
        where: {
          schoolId,
          studentId,
          ...(academicYearId ? { academicYearId } : {}),
        },
        order: { date: 'DESC' },
        take: 40,
      });

      return {
        summary: { ...counts, workingDays: working, percentage },
        recent: recent.map((a) => ({
          date: a.date,
          status: a.status,
          note: a.note,
        })),
      };
    });
  }

  // ── Results (portal) ────────────────────────────────────────────────────────
  results(
    schemaName: string,
    schoolId: string,
    role: 'student' | 'parent',
    refId: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const studentId = await this.resolveStudentId(em, schoolId, role, refId);
      const marks = await em
        .getRepository(Mark)
        .find({ where: { schoolId, studentId } });
      if (marks.length === 0) return { exams: [] };

      const examIds = [...new Set(marks.map((m) => m.examId))];
      const subjectIds = [...new Set(marks.map((m) => m.subjectId))];
      const exams = await em
        .getRepository(Exam)
        .find({ where: { id: In(examIds), schoolId } });
      const subjects = await em
        .getRepository(Subject)
        .find({ where: { id: In(subjectIds), schoolId } });
      const examMap = new Map(exams.map((e) => [e.id, e]));
      const subjMap = new Map(subjects.map((s) => [s.id, s]));

      const byExam = new Map<string, Mark[]>();
      for (const m of marks) {
        const arr = byExam.get(m.examId) ?? [];
        arr.push(m);
        byExam.set(m.examId, arr);
      }

      // Published report cards (with downloadable PDFs), keyed by exam.
      const reportCards = await this.reportCardsSvc.reportCardsByExam(
        em,
        schoolId,
        studentId,
      );

      const out = [...byExam.entries()]
        .map(([examId, list]) => {
          const exam = examMap.get(examId);
          let totalObtained = 0;
          let totalMax = 0;
          let allPassed = true;
          const subjectsOut = list.map((m) => {
            const subj = subjMap.get(m.subjectId);
            const obtained = m.isAbsent ? 0 : Number(m.marksObtained);
            const passMarks = subj?.passMarks ?? 35;
            const passed = !m.isAbsent && obtained >= passMarks;
            if (!passed) allPassed = false;
            totalObtained += obtained;
            totalMax += m.maxMarks;
            return {
              subject: subj?.name ?? '—',
              code: subj?.code ?? '',
              marksObtained: m.isAbsent ? null : obtained,
              maxMarks: m.maxMarks,
              passMarks,
              grade: m.grade,
              isAbsent: m.isAbsent,
              passed,
            };
          });
          const percentage =
            totalMax > 0
              ? Math.round((totalObtained / totalMax) * 1000) / 10
              : 0;
          const rc = reportCards.get(examId);
          return {
            examId,
            name: exam?.name ?? 'Exam',
            examType: exam?.examType ?? null,
            startDate: exam?.startDate ?? null,
            subjects: subjectsOut.sort((a, b) =>
              a.subject.localeCompare(b.subject),
            ),
            totalObtained,
            totalMax,
            percentage,
            grade: gradeFor(percentage),
            passed: allPassed,
            rank: rc?.rank ?? null,
            reportCardUrl: rc?.pdfUrl ?? null,
          };
        })
        .sort((a, b) =>
          String(b.startDate ?? '').localeCompare(String(a.startDate ?? '')),
        );

      return { exams: out };
    });
  }

  // ── Timetable (portal) ──────────────────────────────────────────────────────
  timetable(
    schemaName: string,
    schoolId: string,
    role: 'student' | 'parent',
    refId: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const studentId = await this.resolveStudentId(em, schoolId, role, refId);
      return this.timetableSvc.studentTimetable(em, schoolId, studentId);
    });
  }

  private async resolveStudentId(
    em: EntityManager,
    schoolId: string,
    role: 'student' | 'parent',
    refId: string,
  ): Promise<string> {
    if (role === 'student') return refId;
    const parent = await em
      .getRepository(Parent)
      .findOne({ where: { id: refId, schoolId } });
    if (!parent) throw new NotFoundException('Parent not found');
    return parent.studentId;
  }

  private async studentProfile(
    em: EntityManager,
    schoolId: string,
    student: Student,
  ) {
    const enrollment = await em.getRepository(StudentEnrollment).findOne({
      where: { schoolId, studentId: student.id, status: 'active' as any },
    });
    let className: string | null = null;
    let sectionName: string | null = null;
    if (enrollment) {
      const cls = await em
        .getRepository(ClassEntity)
        .findOne({ where: { id: enrollment.classId, schoolId } });
      className = cls?.name ?? null;
      if (enrollment.sectionId) {
        const sec = await em
          .getRepository(Section)
          .findOne({ where: { id: enrollment.sectionId, schoolId } });
        sectionName = sec?.name ?? null;
      }
    }
    return {
      id: student.id,
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      gender: student.gender,
      dateOfBirth: student.dateOfBirth,
      bloodGroup: student.bloodGroup,
      photoUrl: student.photoUrl,
      status: student.status,
      className,
      sectionName,
      rollNumber: enrollment?.rollNumber ?? null,
    };
  }
}
