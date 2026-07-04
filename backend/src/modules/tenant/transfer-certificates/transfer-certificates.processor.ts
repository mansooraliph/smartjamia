import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Job } from 'bull';
import dayjs from 'dayjs';

import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import { PdfService } from '../../../common/pdf/pdf.service';
import { StorageService } from '../../../common/storage/storage.service';
import { TransferCertificate } from '../../../database/tenant/transfer-certificate.entity';
import { Student } from '../../../database/tenant/student.entity';
import { Parent } from '../../../database/tenant/parent.entity';
import { User } from '../../../database/tenant/user.entity';
import { SchoolProfile } from '../../../database/tenant/school-profile.entity';
import { School } from '../../../database/master/school.entity';
import { REPORTS_QUEUE, TC_PDF_JOB, TcPdfJobData } from './tc.constants';
import { renderTcHtml, TcTemplateData } from './tc-pdf.template';

@Processor(REPORTS_QUEUE)
export class TransferCertificatesProcessor {
  private readonly logger = new Logger(TransferCertificatesProcessor.name);

  constructor(
    private readonly tenant: TenantSchemaService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    @InjectDataSource('master') private readonly master: DataSource,
  ) {}

  @Process(TC_PDF_JOB)
  async generateTcPdf(job: Job<TcPdfJobData>) {
    try {
      return await this.run(job);
    } catch (err) {
      this.logger.error(
        `TC PDF job failed for ${job.data.tcId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  private async run(job: Job<TcPdfJobData>) {
    const { schemaName, schoolId, tcId } = job.data;
    this.logger.log(`Generating TC PDF for ${tcId} (${schemaName})`);

    const data = await this.tenant.runInSchema(schemaName, async (em) => {
      const tc = await em
        .getRepository(TransferCertificate)
        .findOne({ where: { id: tcId, schoolId } });
      if (!tc) return null;

      const student = await em
        .getRepository(Student)
        .findOne({ where: { id: tc.studentId, schoolId }, withDeleted: true });
      const issuer = await em
        .getRepository(User)
        .findOne({ where: { id: tc.issuedBy, schoolId } });
      const profile = await em
        .getRepository(SchoolProfile)
        .findOne({ where: { schoolId } });
      const father = await em.getRepository(Parent).findOne({
        where: { schoolId, studentId: tc.studentId },
        order: { isPrimary: 'DESC' },
      });
      return { tc, student, issuer, profile, father };
    });

    if (!data || !data.student) {
      this.logger.warn(`TC ${tcId} or its student no longer exists; skipping`);
      return;
    }

    // School display name: tenant profile first, else master record.
    let schoolName = data.profile?.name;
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

    const tpl: TcTemplateData = {
      schoolName,
      schoolAddress: addressParts.length ? addressParts.join(', ') : null,
      schoolPhone: data.profile?.phone ?? null,
      schoolEmail: data.profile?.email ?? null,
      affiliation,
      principalName: data.profile?.principalName ?? null,
      tcNumber: data.tc.tcNumber,
      issueDate: dayjs(data.tc.issueDate).format('DD MMM YYYY'),
      studentName: data.student.studentName,
      admissionNumber: data.student.admissionNumber,
      dateOfBirth: data.student.dateOfBirth
        ? dayjs(data.student.dateOfBirth).format('DD MMM YYYY')
        : null,
      gender: data.student.gender
        ? data.student.gender.charAt(0).toUpperCase() +
          data.student.gender.slice(1)
        : null,
      fatherName: data.father?.name ?? null,
      lastClass: data.tc.lastClass,
      reason: titleCase(data.tc.reason),
      conduct: titleCase(data.tc.conduct),
      feesCleared: data.tc.feesCleared,
      issuedByName: data.issuer?.name ?? null,
    };

    const html = renderTcHtml(tpl);
    const buffer = await this.pdf.htmlToPdf(html);

    const safeNum = data.tc.tcNumber.replace(/[^A-Za-z0-9_-]/g, '_');
    const relPath = `tc/${schemaName}/${safeNum}-${tcId}.pdf`;
    const url = await this.storage.save(relPath, buffer);

    await this.tenant.runInSchema(schemaName, async (em) => {
      await em
        .getRepository(TransferCertificate)
        .update({ id: tcId, schoolId }, { pdfUrl: url });
    });

    this.logger.log(`TC PDF ready: ${url}`);
    return { pdfUrl: url };
  }
}

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
