import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { Job } from 'bull';
import dayjs from 'dayjs';

import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { PdfService } from '../../../common/pdf/pdf.service';
import { StorageService } from '../../../common/storage/storage.service';
import { ReportCard } from '../../../database/tenant/report-card.entity';
import { Exam } from '../../../database/tenant/exam.entity';
import { Mark } from '../../../database/tenant/mark.entity';
import { Subject } from '../../../database/tenant/subject.entity';
import { Student } from '../../../database/tenant/student.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { Section } from '../../../database/tenant/section.entity';
import { AcademicYear } from '../../../database/tenant/academic-year.entity';
import { Parent } from '../../../database/tenant/parent.entity';
import { SchoolProfile } from '../../../database/tenant/school-profile.entity';
import { School } from '../../../database/master/school.entity';
import {
  REPORT_CARD_PDF_JOB,
  REPORTS_QUEUE,
  ReportCardPdfJobData,
} from './report-card.constants';
import {
  renderReportCardHtml,
  ReportCardSubjectRow,
  ReportCardTemplateData,
} from './report-card-pdf.template';

@Processor(REPORTS_QUEUE)
export class ReportCardsProcessor {
  private readonly logger = new Logger(ReportCardsProcessor.name);

  constructor(
    private readonly tenant: TenantSchemaService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    @InjectDataSource('master') private readonly master: DataSource,
  ) {}

  @Process(REPORT_CARD_PDF_JOB)
  async generate(job: Job<ReportCardPdfJobData>) {
    try {
      return await this.run(job);
    } catch (err) {
      this.logger.error(
        `Report-card PDF job failed for ${job.data.reportCardId}: ${
          (err as Error).message
        }`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  private async run(job: Job<ReportCardPdfJobData>) {
    const { schemaName, schoolId, reportCardId } = job.data;

    const data = await this.tenant.runInSchema(schemaName, async (em) => {
      const rc = await em
        .getRepository(ReportCard)
        .findOne({ where: { id: reportCardId, schoolId } });
      if (!rc) return null;

      const exam = await em
        .getRepository(Exam)
        .findOne({ where: { id: rc.examId, schoolId } });
      const student = await em
        .getRepository(Student)
        .findOne({ where: { id: rc.studentId, schoolId }, withDeleted: true });
      const enrollment = await em.getRepository(StudentEnrollment).findOne({
        where: {
          schoolId,
          studentId: rc.studentId,
          academicYearId: rc.academicYearId,
        },
      });
      const cls = enrollment
        ? await em
            .getRepository(ClassEntity)
            .findOne({ where: { id: enrollment.classId, schoolId } })
        : null;
      const section = enrollment?.sectionId
        ? await em
            .getRepository(Section)
            .findOne({ where: { id: enrollment.sectionId, schoolId } })
        : null;
      const year = await em
        .getRepository(AcademicYear)
        .findOne({ where: { id: rc.academicYearId, schoolId } });
      const father = await em.getRepository(Parent).findOne({
        where: { schoolId, studentId: rc.studentId },
        order: { isPrimary: 'DESC' },
      });
      const profile = await em
        .getRepository(SchoolProfile)
        .findOne({ where: { schoolId } });

      // per-subject marks
      const marks = await em
        .getRepository(Mark)
        .find({ where: { schoolId, studentId: rc.studentId, examId: rc.examId } });
      const subjects = await em.getRepository(Subject).find({
        where: { schoolId, id: In(marks.map((m) => m.subjectId)) },
      });
      const subjMap = new Map(subjects.map((s) => [s.id, s]));
      const classSize = await em
        .getRepository(ReportCard)
        .count({ where: { schoolId, examId: rc.examId } });

      return {
        rc,
        exam,
        student,
        cls,
        section,
        rollNumber: enrollment?.rollNumber ?? null,
        year,
        father,
        profile,
        marks,
        subjMap,
        classSize,
      };
    });

    if (!data || !data.student || !data.exam) {
      this.logger.warn(`Report card ${reportCardId} no longer resolvable; skipping`);
      return;
    }

    // school name + affiliation (tenant profile first, else master)
    let schoolName = data.profile?.name ?? undefined;
    let affiliation: string | null = null;
    if (data.profile) {
      affiliation = data.profile.affiliationBoard
        ? `Affiliated to ${data.profile.affiliationBoard}${
            data.profile.affiliationNumber
              ? ` — ${data.profile.affiliationNumber}`
              : ''
          }`
        : null;
    }
    if (!schoolName) {
      const school = await this.master
        .getRepository(School)
        .findOne({ where: { id: schoolId } });
      schoolName = school?.name ?? 'School';
    }

    const addressParts = [
      data.profile?.address,
      data.profile?.city,
      data.profile?.state,
      data.profile?.pincode,
    ].filter(Boolean);

    const subjectRows: ReportCardSubjectRow[] = data.marks
      .map((m) => {
        const subj = data.subjMap.get(m.subjectId);
        return {
          subject: subj?.name ?? '—',
          code: subj?.code ?? '',
          maxMarks: m.maxMarks,
          marksObtained: m.isAbsent ? null : String(Number(m.marksObtained)),
          grade: m.grade,
          passed:
            !m.isAbsent &&
            Number(m.marksObtained) >= (subj?.passMarks ?? 35),
          isAbsent: m.isAbsent,
        };
      })
      .sort((a, b) => a.subject.localeCompare(b.subject));

    const tpl: ReportCardTemplateData = {
      schoolName: schoolName!,
      schoolAddress: addressParts.length ? addressParts.join(', ') : null,
      schoolPhone: data.profile?.phone ?? null,
      schoolEmail: data.profile?.email ?? null,
      affiliation,
      principalName: data.profile?.principalName ?? null,
      examName: data.exam.name,
      examType: data.exam.examType
        ? titleCase(data.exam.examType.replace(/_/g, ' '))
        : null,
      academicYear: data.year?.name ?? null,
      studentName: data.student.studentName,
      admissionNumber: data.student.admissionNumber,
      className: data.cls?.name ?? '—',
      sectionName: data.section?.name ?? null,
      rollNumber: data.rollNumber,
      dateOfBirth: data.student.dateOfBirth
        ? dayjs(data.student.dateOfBirth).format('DD MMM YYYY')
        : null,
      fatherName: data.father?.name ?? null,
      subjects: subjectRows,
      totalObtained: String(Number(data.rc.totalMarks)),
      totalMax: String(Number(data.rc.maxTotalMarks)),
      percentage: Number(data.rc.percentage).toFixed(2),
      grade: data.rc.grade ?? '—',
      rank: data.rc.rank,
      classSize: data.classSize,
      isPassed: data.rc.isPassed,
      generatedOn: dayjs(data.rc.generatedAt ?? new Date()).format('DD MMM YYYY'),
    };

    const html = renderReportCardHtml(tpl);
    const buffer = await this.pdf.htmlToPdf(html);

    const safe = `${data.student.admissionNumber}-${data.exam.name}`.replace(
      /[^A-Za-z0-9_-]/g,
      '_',
    );
    const relPath = `report-cards/${schemaName}/${safe}-${reportCardId}.pdf`;
    const url = await this.storage.save(relPath, buffer);

    await this.tenant.runInSchema(schemaName, async (em) => {
      await em
        .getRepository(ReportCard)
        .update({ id: reportCardId, schoolId }, { pdfUrl: url });
    });

    this.logger.log(`Report-card PDF ready: ${url}`);
    return { pdfUrl: url };
  }
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
