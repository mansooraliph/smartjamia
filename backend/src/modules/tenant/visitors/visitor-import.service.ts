import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { EntityManager } from 'typeorm';
import { Visitor } from '../../../database/tenant/visitor.entity';
import { Student } from '../../../database/tenant/student.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';

const GENDERS = new Set(['male', 'female', 'other']);

const HEADER_ALIASES: Record<string, string[]> = {
  admissionNumber: ['admissionnumber', 'admno', 'admission', 'admissionno'],
  name: ['name', 'visitorname', 'fullname'],
  relation: ['relation', 'relationship'],
  gender: ['gender', 'sex'],
  mobile: ['mobile', 'phone', 'contact', 'mobileno'],
  email: ['email'],
  place: ['place', 'city', 'from'],
  address: ['address'],
  idProofType: ['idprooftype', 'idproof', 'prooftype'],
  idProofNumber: ['idproofnumber', 'proofnumber', 'idnumber'],
};

export interface VisitorImportRow {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
}
export interface VisitorImportPreview {
  rows: VisitorImportRow[];
  summary: { total: number; valid: number; invalid: number };
}

@Injectable()
export class VisitorImportService {
  constructor(private readonly tenant: TenantSchemaService) {}

  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.created = new Date(0);
    const ws = wb.addWorksheet('Visitors');
    const headers = [
      'admissionNumber',
      'name',
      'relation',
      'gender',
      'mobile',
      'email',
      'place',
      'address',
      'idProofType',
      'idProofNumber',
    ];
    ws.columns = headers.map((h) => ({ header: h, key: h, width: 18 }));
    ws.getRow(1).font = { bold: true };
    ws.addRow({
      admissionNumber: 'ADM2026001',
      name: 'Rashid Khan',
      relation: 'Father',
      gender: 'male',
      mobile: '9876543210',
      email: 'rashid@example.com',
      place: 'Hyderabad',
      address: '12 MG Road',
      idProofType: 'Aadhar',
      idProofNumber: '1234 5678 9012',
    });
    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  preview(
    schemaName: string,
    schoolId: string,
    buffer: Buffer,
  ): Promise<VisitorImportPreview> {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await this.parse(buffer);
      const { rows } = await this.validate(em, schoolId, raw);
      const invalid = rows.filter((r) => r.errors.length).length;
      return {
        rows,
        summary: { total: rows.length, valid: rows.length - invalid, invalid },
      };
    });
  }

  commit(schemaName: string, schoolId: string, buffer: Buffer) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await this.parse(buffer);
      const { rows, studentByAdm } = await this.validate(em, schoolId, raw);
      const repo = em.getRepository(Visitor);
      let created = 0;
      const errors: { rowNumber: number; error: string }[] = [];
      for (const row of rows) {
        if (row.errors.length) {
          errors.push({ rowNumber: row.rowNumber, error: row.errors[0] });
          continue;
        }
        const d = row.data;
        const studentId = studentByAdm.get(d.admissionNumber.toLowerCase());
        await repo.save(
          repo.create({
            schoolId,
            studentId,
            name: d.name,
            relation: d.relation || null,
            gender: (d.gender || null) as any,
            mobile: d.mobile,
            email: d.email || null,
            place: d.place || null,
            address: d.address || null,
            idProofType: d.idProofType || null,
            idProofNumber: d.idProofNumber || null,
            photoUrl: null,
            notes: null,
            isBlacklisted: false,
          }),
        );
        created++;
      }
      const invalid = rows.filter((r) => r.errors.length).length;
      return { created, skipped: invalid, errors };
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

    const colMap = new Map<number, string>();
    ws.getRow(1).eachCell((cell, col) => {
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
        const v = this.cell(row.getCell(col).value);
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

  private cell(value: ExcelJS.CellValue): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object' && 'text' in (value as any)) {
      return String((value as any).text).trim();
    }
    return String(value).trim();
  }

  private async validate(
    em: EntityManager,
    schoolId: string,
    raw: Record<string, string>[],
  ) {
    const students = await em.getRepository(Student).find({
      where: { schoolId },
      select: { id: true, admissionNumber: true },
    });
    const studentByAdm = new Map(
      students.map((s) => [s.admissionNumber.toLowerCase(), s.id]),
    );

    const rows: VisitorImportRow[] = raw.map((d) => {
      const errors: string[] = [];
      if (!d.name) errors.push('Name is required');
      if (!d.mobile) errors.push('Mobile is required');
      if (!d.admissionNumber) {
        errors.push('Admission number is required (which student)');
      } else if (!studentByAdm.has(d.admissionNumber.toLowerCase())) {
        errors.push(`Student "${d.admissionNumber}" not found`);
      }
      const gender = (d.gender || '').toLowerCase();
      if (gender && !GENDERS.has(gender))
        errors.push('Gender must be male, female or other');
      else if (gender) d.gender = gender;
      return { rowNumber: Number(d.__row ?? 0), data: d, errors };
    });

    return { rows, studentByAdm };
  }
}
