import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EntityManager } from 'typeorm';
import { Student } from '../../../database/tenant/student.entity';
import { StudentEnrollment } from '../../../database/tenant/student-enrollment.entity';
import { Section } from '../../../database/tenant/section.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';

const GENDERS = new Set(['male', 'female', 'other']);

// Canonical column → accepted header aliases (lower-cased, spaces/underscores stripped).
const HEADER_ALIASES: Record<string, string[]> = {
  admissionNumber: ['admissionnumber', 'admissionno', 'admno', 'admission'],
  firstName: ['firstname', 'first'],
  lastName: ['lastname', 'last', 'surname'],
  dateOfBirth: ['dateofbirth', 'dob', 'birthdate'],
  gender: ['gender', 'sex'],
  admissionDate: ['admissiondate', 'doa', 'dateofadmission'],
  bloodGroup: ['bloodgroup', 'blood'],
  religion: ['religion'],
  caste: ['caste', 'category'],
  aadharNumber: ['aadhar', 'aadhaar', 'aadharnumber', 'aadhaarnumber', 'aadharno', 'aadhaarno'],
  mobileCountryCode: ['mobilecountrycode', 'mobilecode', 'mobileisd'],
  mobile: ['mobile', 'mobilenumber', 'phone', 'phonenumber', 'contact', 'contactnumber'],
  whatsappCountryCode: ['whatsappcountrycode', 'whatsappcode', 'whatsappisd'],
  whatsapp: ['whatsapp', 'whatsappnumber', 'whatsappno', 'wa'],
  address: ['address'],
  city: ['city'],
  state: ['state'],
  pincode: ['pincode', 'pin', 'zip'],
  previousSchool: ['previousschool', 'prevschool'],
  className: ['class', 'classname', 'grade', 'level'],
  sectionName: ['section', 'sectionname', 'group', 'batch'],
  rollNumber: ['rollnumber', 'roll', 'rollno'],
};

export interface ImportRowResult {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
  willEnroll: boolean;
  autoAdmissionNumber: boolean;
}

export interface ImportPreview {
  rows: ImportRowResult[];
  summary: { total: number; valid: number; invalid: number };
}

@Injectable()
export class StudentImportService {
  constructor(private readonly tenant: TenantSchemaService) {}

  /** Build a downloadable .xlsx import template with one example row. */
  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.created = new Date(0);
    const ws = wb.addWorksheet('Students');
    const headers = [
      'admissionNumber',
      'firstName',
      'lastName',
      'dateOfBirth',
      'gender',
      'admissionDate',
      'bloodGroup',
      'religion',
      'caste',
      'aadhaar',
      'mobileCountryCode',
      'mobile',
      'whatsappCountryCode',
      'whatsapp',
      'address',
      'city',
      'state',
      'pincode',
      'previousSchool',
      'class',
      'section',
      'rollNumber',
    ];
    ws.columns = headers.map((h) => ({ header: h, key: h, width: 16 }));
    ws.getRow(1).font = { bold: true };
    ws.addRow({
      admissionNumber: '(leave blank to auto-generate)',
      firstName: 'Aisha',
      lastName: 'Khan',
      dateOfBirth: '2016-05-12',
      gender: 'female',
      admissionDate: '2026-04-15',
      bloodGroup: 'O+',
      religion: 'Islam',
      caste: 'OBC',
      aadhaar: '123412341234',
      mobileCountryCode: '+91',
      mobile: '9876543210',
      whatsappCountryCode: '+91',
      whatsapp: '9876543210',
      address: '12 MG Road',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500001',
      previousSchool: 'Little Stars',
      class: 'Class 1',
      section: 'A',
      rollNumber: '1',
    });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  preview(
    schemaName: string,
    schoolId: string,
    buffer: Buffer,
    academicYearId?: string,
  ): Promise<ImportPreview> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await this.parse(buffer);
      return this.validate(em, schoolId, raw, academicYearId);
    });
  }

  commit(
    schemaName: string,
    schoolId: string,
    buffer: Buffer,
    academicYearId?: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await this.parse(buffer);
      const preview = await this.validate(em, schoolId, raw, academicYearId);

      const studentRepo = em.getRepository(Student);
      const enrolRepo = em.getRepository(StudentEnrollment);
      let nextSeq = await this.admissionSeqStart(em, schoolId);
      const prefix = `ADM${new Date().getFullYear()}`;

      const classMap = await this.classMap(em, schoolId, academicYearId);
      const sectionMap = await this.sectionMap(em, schoolId);

      let created = 0;
      const errors: { rowNumber: number; error: string }[] = [];

      for (const row of preview.rows) {
        if (row.errors.length) {
          errors.push({ rowNumber: row.rowNumber, error: row.errors[0] });
          continue;
        }
        const d = row.data;
        const admissionNumber = d.admissionNumber
          ? d.admissionNumber
          : `${prefix}${String(nextSeq++).padStart(3, '0')}`;

        const student = await studentRepo.save(
          studentRepo.create({
            schoolId,
            admissionNumber,
            firstName: d.firstName,
            lastName: d.lastName,
            dateOfBirth: new Date(d.dateOfBirth),
            gender: d.gender as any,
            bloodGroup: d.bloodGroup || null,
            religion: d.religion || null,
            caste: d.caste || null,
            aadharNumber: d.aadharNumber || null,
            mobile: d.mobile || null,
            mobileCountryCode: d.mobile
              ? d.mobileCountryCode || '+91'
              : null,
            whatsapp: d.whatsapp || null,
            whatsappCountryCode: d.whatsapp
              ? d.whatsappCountryCode || '+91'
              : null,
            address: d.address || null,
            city: d.city || null,
            state: d.state || null,
            pincode: d.pincode || null,
            previousSchool: d.previousSchool || null,
            admissionDate: d.admissionDate
              ? new Date(d.admissionDate)
              : new Date(),
            status: 'active',
            userId: null,
          }),
        );

        if (row.willEnroll && academicYearId) {
          const classId = classMap.get(d.className.toLowerCase());
          const section = d.sectionName
            ? sectionMap.get(`${classId}|${d.sectionName.toLowerCase()}`)
            : undefined;
          if (classId) {
            await enrolRepo.save(
              enrolRepo.create({
                schoolId,
                studentId: student.id,
                academicYearId,
                classId,
                sectionId: section ?? null,
                rollNumber: d.rollNumber || null,
                enrollmentDate: student.admissionDate,
                status: 'active' as any,
              }),
            );
          }
        }
        created++;
      }
      return {
        created,
        skipped: preview.summary.invalid,
        errors,
      };
    });
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private async parse(buffer: Buffer): Promise<Record<string, string>[]> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Could not read file — upload a .xlsx');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Workbook has no sheets');

    const headerRow = ws.getRow(1);
    const colMap = new Map<number, string>(); // column index → canonical key
    headerRow.eachCell((cell, col) => {
      const norm = String(cell.value ?? '')
        .toLowerCase()
        .replace(/[\s_]/g, '');
      for (const [canon, aliases] of Object.entries(HEADER_ALIASES)) {
        if (aliases.includes(norm)) {
          colMap.set(col, canon);
          break;
        }
      }
    });
    if (colMap.size === 0) {
      throw new BadRequestException(
        'No recognizable columns — use the provided template',
      );
    }

    const rows: Record<string, string>[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const obj: Record<string, string> = {};
      let hasData = false;
      colMap.forEach((key, col) => {
        const v = this.cellToString(row.getCell(col).value, key);
        obj[key] = v;
        if (v) hasData = true;
      });
      if (hasData) {
        obj.__row = String(r);
        rows.push(obj);
      }
    }
    return rows;
  }

  private cellToString(value: ExcelJS.CellValue, key: string): string {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) {
      // date columns → ISO date
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'object' && 'text' in (value as any)) {
      return String((value as any).text).trim();
    }
    const s = String(value).trim();
    if ((key === 'dateOfBirth' || key === 'admissionDate') && s) {
      const iso = this.toIsoDate(s);
      return iso ?? s;
    }
    return s;
  }

  private toIsoDate(s: string): string | null {
    // accepts YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY
    const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (ymd) return s;
    const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
    return null;
  }

  private async validate(
    em: EntityManager,
    schoolId: string,
    raw: Record<string, string>[],
    academicYearId?: string,
  ): Promise<ImportPreview> {
    const existing = await em.getRepository(Student).find({
      where: { schoolId },
      withDeleted: true,
      select: { admissionNumber: true },
    });
    const existingAdm = new Set(existing.map((s) => s.admissionNumber));
    const seenInFile = new Set<string>();

    const classMap = await this.classMap(em, schoolId, academicYearId);
    const sectionMap = await this.sectionMap(em, schoolId);

    const rows: ImportRowResult[] = raw.map((d) => {
      const errors: string[] = [];
      const rowNumber = Number(d.__row ?? 0);

      if (!d.firstName) errors.push('First name is required');
      if (!d.lastName) errors.push('Last name is required');

      if (!d.dateOfBirth) errors.push('Date of birth is required');
      else if (!this.toIsoDate(d.dateOfBirth))
        errors.push('Date of birth is not a valid date');

      if (d.admissionDate && !this.toIsoDate(d.admissionDate))
        errors.push('Admission date is not a valid date');

      const gender = (d.gender || '').toLowerCase();
      if (!gender) errors.push('Gender is required');
      else if (!GENDERS.has(gender))
        errors.push('Gender must be male, female or other');
      else d.gender = gender;

      const autoAdmissionNumber = !d.admissionNumber;
      if (d.admissionNumber) {
        if (existingAdm.has(d.admissionNumber))
          errors.push('Admission number already exists');
        if (seenInFile.has(d.admissionNumber))
          errors.push('Duplicate admission number in file');
        seenInFile.add(d.admissionNumber);
      }

      // Enrollment columns: class is required to enroll; section is optional.
      let willEnroll = false;
      if (d.className || d.sectionName) {
        if (!academicYearId) {
          errors.push(
            'Select an academic year to enroll students by class/section',
          );
        } else if (!d.className) {
          errors.push('A class is required to enroll (section is optional)');
        } else {
          const classId = classMap.get(d.className.toLowerCase());
          if (!classId) {
            errors.push(`Class "${d.className}" not found in the selected year`);
          } else if (
            d.sectionName &&
            !sectionMap.has(`${classId}|${d.sectionName.toLowerCase()}`)
          ) {
            errors.push(
              `Section "${d.sectionName}" not found in class "${d.className}"`,
            );
          } else {
            willEnroll = true;
          }
        }
      }

      return { rowNumber, data: d, errors, willEnroll, autoAdmissionNumber };
    });

    const invalid = rows.filter((r) => r.errors.length).length;
    return {
      rows,
      summary: { total: rows.length, valid: rows.length - invalid, invalid },
    };
  }

  private async classMap(
    em: EntityManager,
    schoolId: string,
    academicYearId?: string,
  ) {
    const classes = await em.getRepository(ClassEntity).find({
      where: { schoolId, ...(academicYearId ? { academicYearId } : {}) },
    });
    return new Map(classes.map((c) => [c.name.toLowerCase(), c.id]));
  }

  private async sectionMap(em: EntityManager, schoolId: string) {
    const sections = await em
      .getRepository(Section)
      .find({ where: { schoolId } });
    // key: `${classId}|${sectionNameLower}` → sectionId
    return new Map(
      sections.map((s) => [`${s.classId}|${s.name.toLowerCase()}`, s.id]),
    );
  }

  private async admissionSeqStart(em: EntityManager, schoolId: string) {
    const year = new Date().getFullYear();
    const prefix = `ADM${year}`;
    const rows = await em.getRepository(Student).find({
      where: { schoolId },
      withDeleted: true,
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
    return max + 1;
  }
}
