import { BadRequestException, Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Subject } from '../../../database/tenant/subject.entity';
import { ClassEntity } from '../../../database/tenant/class.entity';
import { TenantSchemaService } from '../../../common/tenant/tenant-schema.service';
import {
  buildTemplate,
  ImportRowResult,
  parseSheet,
  summarize,
} from '../../../common/import/excel-import.util';

const ALIASES: Record<string, string[]> = {
  className: ['class', 'classname', 'grade', 'level'],
  name: ['name', 'subject', 'subjectname'],
  code: ['code', 'subjectcode'],
  maxMarks: ['maxmarks', 'max'],
  passMarks: ['passmarks', 'pass'],
  isOptional: ['isoptional', 'optional', 'elective'],
};
const truthy = (s: string) => ['yes', 'true', '1', 'y'].includes(s.toLowerCase());

@Injectable()
export class SubjectImportService {
  constructor(private readonly tenant: TenantSchemaService) {}

  template() {
    return buildTemplate('Subjects', Object.keys(ALIASES), {
      className: 'Class 1',
      name: 'Mathematics',
      code: 'MATH',
      maxMarks: '100',
      passMarks: '35',
      isOptional: 'no',
    });
  }

  preview(
    schemaName: string,
    schoolId: string,
    buffer: Buffer,
    academicYearId?: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await parseSheet(buffer, ALIASES);
      return summarize(
        (await this.validate(em, schoolId, raw, academicYearId)).rows,
      );
    });
  }

  commit(
    schemaName: string,
    schoolId: string,
    buffer: Buffer,
    academicYearId?: string,
  ) {
    return this.tenant.runInSchema(schemaName, async (em) => {
      const raw = await parseSheet(buffer, ALIASES);
      const { rows, classByName } = await this.validate(
        em,
        schoolId,
        raw,
        academicYearId,
      );
      const repo = em.getRepository(Subject);
      let created = 0;
      const errors: { rowNumber: number; error: string }[] = [];
      for (const row of rows) {
        if (row.errors.length) {
          errors.push({ rowNumber: row.rowNumber, error: row.errors[0] });
          continue;
        }
        const d = row.data;
        const classId = classByName.get(d.className.toLowerCase())!;
        await repo.save(
          repo.create({
            schoolId,
            classId,
            name: d.name,
            code: d.code,
            isOptional: truthy(d.isOptional || ''),
            maxMarks: d.maxMarks ? Number(d.maxMarks) : 100,
            passMarks: d.passMarks ? Number(d.passMarks) : 35,
          }),
        );
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
    academicYearId?: string,
  ) {
    if (!academicYearId) {
      throw new BadRequestException(
        'Select an academic year before importing subjects',
      );
    }
    const classes = await em
      .getRepository(ClassEntity)
      .find({ where: { schoolId, academicYearId } });
    const classByName = new Map(
      classes.map((c) => [c.name.toLowerCase(), c.id]),
    );
    const rows: ImportRowResult[] = raw.map((d) => {
      const errors: string[] = [];
      if (!d.name) errors.push('Subject name is required');
      if (!d.code) errors.push('Code is required');
      if (!d.className) errors.push('Class is required');
      else if (!classByName.has(d.className.toLowerCase()))
        errors.push(`Class "${d.className}" not found in the selected year`);
      return { rowNumber: Number(d.__row ?? 0), data: d, errors };
    });
    return { rows, classByName };
  }
}
