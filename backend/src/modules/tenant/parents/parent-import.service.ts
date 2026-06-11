import { Injectable } from '@nestjs/common';
import { EntityManager, Not } from 'typeorm';
import { Parent } from '../../../database/tenant/parent.entity';
import { Student } from '../../../database/tenant/student.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import {
  buildTemplate,
  ImportRowResult,
  parseSheet,
  summarize,
} from '../../../common/import/excel-import.util';

const RELATIONS = new Set(['father', 'mother', 'guardian']);
const ALIASES: Record<string, string[]> = {
  admissionNumber: ['admissionnumber', 'admno', 'admission', 'admissionno'],
  name: ['name', 'parentname', 'fullname'],
  relation: ['relation', 'relationship'],
  phone: ['phone', 'mobile', 'contact'],
  email: ['email'],
  occupation: ['occupation'],
  annualIncome: ['annualincome', 'income'],
  aadharNumber: ['aadharnumber', 'aadhar', 'aadhaar'],
  isPrimary: ['isprimary', 'primary'],
};
const truthy = (s: string) => ['yes', 'true', '1', 'y'].includes(s.toLowerCase());

@Injectable()
export class ParentImportService {
  constructor(private readonly tenant: TenantSchemaService) {}

  template() {
    return buildTemplate(
      'Parents',
      Object.keys(ALIASES),
      {
        admissionNumber: 'ADM2026001',
        name: 'Rashid Khan',
        relation: 'father',
        phone: '9876543210',
        email: 'rashid@example.com',
        occupation: 'Engineer',
        annualIncome: '600000',
        aadharNumber: '123456789012',
        isPrimary: 'yes',
      },
    );
  }

  preview(schemaName: string, schoolId: string, buffer: Buffer) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await parseSheet(buffer, ALIASES);
      return summarize((await this.validate(em, schoolId, raw)).rows);
    });
  }

  commit(schemaName: string, schoolId: string, buffer: Buffer) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await parseSheet(buffer, ALIASES);
      const { rows, studentByAdm } = await this.validate(em, schoolId, raw);
      const repo = em.getRepository(Parent);
      let created = 0;
      const errors: { rowNumber: number; error: string }[] = [];
      for (const row of rows) {
        if (row.errors.length) {
          errors.push({ rowNumber: row.rowNumber, error: row.errors[0] });
          continue;
        }
        const d = row.data;
        const studentId = studentByAdm.get(d.admissionNumber.toLowerCase())!;
        const isPrimary = truthy(d.isPrimary || '');
        const parent = await repo.save(
          repo.create({
            schoolId,
            userId: null,
            studentId,
            relation: d.relation.toLowerCase() as any,
            name: d.name,
            phone: d.phone,
            email: d.email || null,
            occupation: d.occupation || null,
            annualIncome: d.annualIncome ? Number(d.annualIncome) : null,
            aadharNumber: d.aadharNumber || null,
            photoUrl: null,
            isPrimary,
          }),
        );
        if (isPrimary) {
          await repo.update(
            { schoolId, studentId, id: Not(parent.id) },
            { isPrimary: false },
          );
        }
        created++;
      }
      const invalid = rows.filter((r) => r.errors.length).length;
      return { created, skipped: invalid, errors };
    });
  }

  private async validate(
    em: EntityManager,
    schoolId: string,
    raw: Record<string, string>[],
  ) {
    const students = await em
      .getRepository(Student)
      .find({ where: { schoolId }, select: { id: true, admissionNumber: true } });
    const studentByAdm = new Map(
      students.map((s) => [s.admissionNumber.toLowerCase(), s.id]),
    );
    const rows: ImportRowResult[] = raw.map((d) => {
      const errors: string[] = [];
      if (!d.name) errors.push('Name is required');
      if (!d.phone) errors.push('Phone is required');
      if (!d.admissionNumber) errors.push('Admission number is required');
      else if (!studentByAdm.has(d.admissionNumber.toLowerCase()))
        errors.push(`Student "${d.admissionNumber}" not found`);
      const rel = (d.relation || '').toLowerCase();
      if (!rel) errors.push('Relation is required');
      else if (!RELATIONS.has(rel))
        errors.push('Relation must be father, mother or guardian');
      return { rowNumber: Number(d.__row ?? 0), data: d, errors };
    });
    return { rows, studentByAdm };
  }
}
