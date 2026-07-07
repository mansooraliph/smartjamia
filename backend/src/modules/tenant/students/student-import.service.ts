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
  studentName: ['studentname', 'name', 'fullname', 'firstname', 'first'],
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

// Canonical DB fields the importer can fill, with a human label and whether a
// value is mandatory. Order drives the mapping UI. `admissionNumber` is optional
// — when its cell is blank the importer auto-generates ADMYYYYNNN.
export const IMPORT_FIELDS: ImportField[] = [
  { key: 'admissionNumber', label: 'Admission Number', required: false },
  { key: 'studentName', label: 'Student Name', required: true },
  { key: 'dateOfBirth', label: 'Date of Birth', required: true },
  { key: 'gender', label: 'Gender', required: true },
  { key: 'admissionDate', label: 'Admission Date', required: false },
  { key: 'bloodGroup', label: 'Blood Group', required: false },
  { key: 'religion', label: 'Religion', required: false },
  { key: 'caste', label: 'Caste', required: false },
  { key: 'aadharNumber', label: 'Aadhaar Number', required: false },
  { key: 'mobileCountryCode', label: 'Mobile Country Code', required: false },
  { key: 'mobile', label: 'Mobile', required: false },
  { key: 'whatsappCountryCode', label: 'WhatsApp Country Code', required: false },
  { key: 'whatsapp', label: 'WhatsApp', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'city', label: 'City', required: false },
  { key: 'state', label: 'State', required: false },
  { key: 'pincode', label: 'Pincode', required: false },
  { key: 'previousSchool', label: 'Previous School', required: false },
  { key: 'className', label: 'Class (for enrollment)', required: false },
  { key: 'sectionName', label: 'Section (for enrollment)', required: false },
  { key: 'rollNumber', label: 'Roll Number', required: false },
];

// Max length (chars) of the DB columns the importer writes into. Used to turn a
// would-be "value too long for type character varying(N)" DB crash into a clear,
// skippable per-row error. Keep in sync with the entity @Column lengths.
const FIELD_MAX_LENGTH: Record<string, number> = {
  admissionNumber: 50,
  studentName: 100,
  bloodGroup: 5,
  religion: 50,
  caste: 50,
  aadharNumber: 12,
  mobileCountryCode: 8,
  mobile: 20,
  whatsappCountryCode: 8,
  whatsapp: 20,
  city: 100,
  state: 100,
  pincode: 10,
  previousSchool: 255,
  rollNumber: 20,
};

/**
 * Normalize a phone-like value to a leading `+` (if present) followed by digits,
 * dropping spaces, dashes, brackets and dots so formatting can't overflow the
 * column. `+91 98765-43210` → `+919876543210`.
 */
function normalizePhone(s: string): string {
  const trimmed = String(s ?? '').trim();
  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return hasPlus ? `+${digits}` : digits;
}

/** Lower-case a header and strip spaces/underscores for tolerant matching. */
function normalizeHeader(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[\s_]/g, '');
}

/**
 * Identity key for duplicate detection: normalized name + date of birth.
 * `dob` may be a Date (from the DB) or an ISO string (from a parsed row);
 * both collapse to YYYY-MM-DD.
 */
function nameDobKey(name: string, dob: string | Date | null): string {
  const normName = String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  let dobStr = '';
  if (dob instanceof Date) dobStr = dob.toISOString().slice(0, 10);
  else if (typeof dob === 'string') dobStr = dob.slice(0, 10);
  return `${normName}|${dobStr}`;
}

export interface ImportField {
  key: string;
  label: string;
  required: boolean;
}

// User-chosen (or auto-suggested) mapping: canonical field key → the exact
// Excel header text that supplies it. Missing/empty value = field not mapped.
export type ImportMapping = Record<string, string>;

export interface ImportInspectResult {
  /** The actual (non-empty) header cells found in row 1, in column order. */
  headers: string[];
  /** DB fields the importer can fill, with labels + required flags. */
  fields: ImportField[];
  /** Best-guess header for each field via alias matching (null if none). */
  suggested: Record<string, string | null>;
}

export type DuplicateMode = 'skip' | 'import';

export interface ImportRowResult {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[]; // blocking — the row cannot be imported
  warnings: string[]; // informational (e.g. duplicate notices)
  willEnroll: boolean;
  willImport: boolean; // false when errors, or a duplicate under 'skip' mode
  duplicate: boolean; // same name + DOB as an existing/earlier student
  autoAdmissionNumber: boolean;
}

export interface ImportPreview {
  rows: ImportRowResult[];
  summary: {
    total: number;
    valid: number; // rows that will import
    invalid: number; // rows with blocking errors
    duplicates: number; // rows flagged as duplicates
  };
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
      'studentName',
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
      studentName: 'Aisha Khan',
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

  /** Detect the uploaded file's headers and suggest a field mapping. */
  async inspect(buffer: Buffer): Promise<ImportInspectResult> {
    const ws = await this.loadSheet(buffer);
    const headers: string[] = [];
    const normed: { raw: string; norm: string }[] = [];
    ws.getRow(1).eachCell((cell) => {
      const raw = String(cell.value ?? '').trim();
      if (raw) {
        headers.push(raw);
        normed.push({ raw, norm: normalizeHeader(raw) });
      }
    });
    const suggested: Record<string, string | null> = {};
    for (const field of IMPORT_FIELDS) {
      const aliases = HEADER_ALIASES[field.key] ?? [];
      const hit = normed.find((h) => aliases.includes(h.norm));
      suggested[field.key] = hit ? hit.raw : null;
    }
    return { headers, fields: IMPORT_FIELDS, suggested };
  }

  preview(
    schemaName: string,
    schoolId: string,
    buffer: Buffer,
    academicYearId?: string,
    mapping?: ImportMapping,
    duplicateMode: DuplicateMode = 'skip',
    overrideClassId?: string,
    overrideSectionId?: string,
  ): Promise<ImportPreview> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await this.parse(buffer, mapping);
      return this.validate(
        em,
        schoolId,
        raw,
        academicYearId,
        duplicateMode,
        overrideClassId,
        overrideSectionId,
      );
    });
  }

  commit(
    schemaName: string,
    schoolId: string,
    buffer: Buffer,
    academicYearId?: string,
    mapping?: ImportMapping,
    duplicateMode: DuplicateMode = 'skip',
    overrideClassId?: string,
    overrideSectionId?: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await this.parse(buffer, mapping);
      const preview = await this.validate(
        em,
        schoolId,
        raw,
        academicYearId,
        duplicateMode,
        overrideClassId,
        overrideSectionId,
      );

      const studentRepo = em.getRepository(Student);
      const enrolRepo = em.getRepository(StudentEnrollment);
      let nextSeq = await this.admissionSeqStart(em, schoolId);
      const prefix = `ADM${new Date().getFullYear()}`;

      const classMap = await this.classMap(em, schoolId, academicYearId);
      const sectionMap = await this.sectionMap(em, schoolId);

      let created = 0;
      const errors: { rowNumber: number; error: string }[] = [];

      for (const row of preview.rows) {
        if (!row.willImport) {
          // Report blocking errors; duplicate-skips are silently left out.
          if (row.errors.length)
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
            studentName: d.studentName,
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
          // A class chosen in the import modal wins over the file's columns.
          const classId = overrideClassId
            ? overrideClassId
            : classMap.get(d.className.toLowerCase());
          const section = overrideClassId
            ? (overrideSectionId ?? undefined)
            : d.sectionName
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
        skipped: preview.rows.length - created,
        errors,
      };
    });
  }

  // ── internals ───────────────────────────────────────────────────────────────

  private async loadSheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Could not read file — upload a .xlsx');
    }
    const ws = wb.worksheets[0];
    if (!ws) throw new BadRequestException('Workbook has no sheets');
    return ws;
  }

  private async parse(
    buffer: Buffer,
    mapping?: ImportMapping,
  ): Promise<Record<string, string>[]> {
    const ws = await this.loadSheet(buffer);

    const headerRow = ws.getRow(1);
    const colMap = new Map<number, string>(); // column index → canonical key
    const hasMapping = mapping && Object.keys(mapping).length > 0;

    if (hasMapping) {
      // Explicit user mapping: canonical field → the exact Excel header text.
      const headerByCol = new Map<number, { raw: string; norm: string }>();
      headerRow.eachCell((cell, col) => {
        const raw = String(cell.value ?? '').trim();
        headerByCol.set(col, { raw, norm: normalizeHeader(raw) });
      });
      for (const [canon, header] of Object.entries(mapping)) {
        if (!header) continue; // field left unmapped / ignored
        const wantNorm = normalizeHeader(header);
        for (const [col, h] of headerByCol) {
          if (h.raw === header || h.norm === wantNorm) {
            colMap.set(col, canon);
            break;
          }
        }
      }
    } else {
      // Auto-detect columns via the known header aliases.
      headerRow.eachCell((cell, col) => {
        const norm = normalizeHeader(String(cell.value ?? ''));
        for (const [canon, aliases] of Object.entries(HEADER_ALIASES)) {
          if (aliases.includes(norm)) {
            colMap.set(col, canon);
            break;
          }
        }
      });
    }
    if (colMap.size === 0) {
      throw new BadRequestException(
        'No columns matched — map your spreadsheet columns to fields, or use the provided template',
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
    duplicateMode: DuplicateMode = 'skip',
    overrideClassId?: string,
    overrideSectionId?: string,
  ): Promise<ImportPreview> {
    const existing = await em.getRepository(Student).find({
      where: { schoolId },
      withDeleted: true,
      select: { admissionNumber: true, studentName: true, dateOfBirth: true },
    });
    const existingAdm = new Set(existing.map((s) => s.admissionNumber));
    // Identity key for duplicate detection: normalized name + date of birth.
    const existingNameDob = new Set(
      existing
        .filter((s) => s.studentName)
        .map((s) => nameDobKey(s.studentName, s.dateOfBirth)),
    );
    const seenInFile = new Set<string>();
    const seenNameDob = new Set<string>();
    const labelByKey = new Map(IMPORT_FIELDS.map((f) => [f.key, f.label]));

    const classMap = await this.classMap(em, schoolId, academicYearId);
    const sectionMap = await this.sectionMap(em, schoolId);

    // A class picked in the import modal enrolls every row into it, overriding
    // any class/section columns in the file. Validate the selection up front —
    // it's a configuration error, not a per-row problem.
    if (overrideClassId) {
      if (!academicYearId) {
        throw new BadRequestException(
          'Select an academic year to enroll into the chosen class',
        );
      }
      if (![...classMap.values()].includes(overrideClassId)) {
        throw new BadRequestException(
          'Selected class not found in the chosen academic year',
        );
      }
      if (
        overrideSectionId &&
        ![...sectionMap.entries()].some(
          ([k, v]) => v === overrideSectionId && k.startsWith(`${overrideClassId}|`),
        )
      ) {
        throw new BadRequestException(
          'Selected section does not belong to the chosen class',
        );
      }
    }

    const rows: ImportRowResult[] = raw.map((d) => {
      const errors: string[] = [];
      const warnings: string[] = [];
      const rowNumber = Number(d.__row ?? 0);

      if (!d.studentName) errors.push('Student name is required');

      const dobIso = d.dateOfBirth ? this.toIsoDate(d.dateOfBirth) : null;
      if (!d.dateOfBirth) errors.push('Date of birth is required');
      else if (!dobIso) errors.push('Date of birth is not a valid date');

      if (d.admissionDate && !this.toIsoDate(d.admissionDate))
        errors.push('Admission date is not a valid date');

      const gender = (d.gender || '').toLowerCase();
      if (!gender) errors.push('Gender is required');
      else if (!GENDERS.has(gender))
        errors.push('Gender must be male, female or other');
      else d.gender = gender;

      // Normalize phone-like fields so formatting can't overflow the column.
      if (d.mobile) d.mobile = normalizePhone(d.mobile);
      if (d.whatsapp) d.whatsapp = normalizePhone(d.whatsapp);

      // Guard column limits — a clear per-row error beats a raw DB crash
      // ("value too long for type character varying(N)").
      for (const [key, max] of Object.entries(FIELD_MAX_LENGTH)) {
        const val = d[key];
        if (val && val.length > max) {
          const label = labelByKey.get(key) ?? key;
          errors.push(`${label} is too long (max ${max} characters)`);
        }
      }

      const autoAdmissionNumber = !d.admissionNumber;
      if (d.admissionNumber) {
        if (existingAdm.has(d.admissionNumber))
          errors.push('Admission number already exists');
        if (seenInFile.has(d.admissionNumber))
          errors.push('Duplicate admission number in file');
        seenInFile.add(d.admissionNumber);
      }

      // Duplicate-by-identity check (only meaningful once name + DOB are valid).
      let duplicate = false;
      if (d.studentName && dobIso) {
        const key = nameDobKey(d.studentName, dobIso);
        if (existingNameDob.has(key) || seenNameDob.has(key)) {
          duplicate = true;
          warnings.push(
            duplicateMode === 'skip'
              ? 'Duplicate of an existing student (same name & date of birth) — skipped'
              : 'Possible duplicate (same name & date of birth) — imported anyway',
          );
        } else if (errors.length === 0) {
          // Only a clean row claims the identity, so it can't suppress a later
          // valid row that happens to duplicate an errored one.
          seenNameDob.add(key);
        }
      }

      // Enrollment: a class chosen in the modal enrolls every valid row into
      // it (file class/section columns are ignored). Otherwise fall back to the
      // file's own class/section columns.
      let willEnroll = false;
      if (overrideClassId) {
        willEnroll = true;
      } else if (d.className || d.sectionName) {
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

      const willImport =
        errors.length === 0 && !(duplicate && duplicateMode === 'skip');

      return {
        rowNumber,
        data: d,
        errors,
        warnings,
        willEnroll,
        willImport,
        duplicate,
        autoAdmissionNumber,
      };
    });

    const invalid = rows.filter((r) => r.errors.length).length;
    const valid = rows.filter((r) => r.willImport).length;
    const duplicates = rows.filter((r) => r.duplicate).length;
    return {
      rows,
      summary: { total: rows.length, valid, invalid, duplicates },
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
