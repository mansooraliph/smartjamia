import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ExamBoardSubject } from '../../../database/master/exam-board/exam-board-subject.entity';
import {
  buildTemplate,
  ImportRowResult,
  parseSheet,
  summarize,
} from '../../../common/import/excel-import.util';
import { ExamBoardService } from './exam-board.service';

const ALIASES: Record<string, string[]> = {
  termNumber: ['term', 'termnumber', 'yearsemester', 'semester', 'year'],
  name: ['name', 'subject', 'subjectname', 'nameenglish', 'english'],
  nameArabic: ['namearabic', 'arabic', 'arabicname', 'subjectnamearabic'],
  code: ['code', 'subjectcode'],
  maxMarks: ['maxmarks', 'max'],
  passMarks: ['passmarks', 'pass'],
  ceMaxMarks: ['cemaxmarks', 'cemax'],
  cePassMarks: ['cepassmarks', 'cepass'],
};

@Injectable()
export class ExamBoardSubjectImportService {
  private readonly subjectRepo: Repository<ExamBoardSubject>;

  constructor(
    @InjectDataSource('master') ds: DataSource,
    private readonly examBoard: ExamBoardService,
  ) {
    this.subjectRepo = ds.getRepository(ExamBoardSubject);
  }

  template() {
    return buildTemplate('Subjects', Object.keys(ALIASES), {
      termNumber: '1',
      name: 'Data Structures',
      nameArabic: 'هياكل البيانات',
      code: 'CS101',
      maxMarks: '100',
      passMarks: '35',
      ceMaxMarks: '',
      cePassMarks: '',
    });
  }

  async preview(organizationId: string, examBoardCourseId: string, buffer: Buffer) {
    const raw = await parseSheet(buffer, ALIASES);
    const { rows } = await this.validate(organizationId, examBoardCourseId, raw);
    return summarize(rows);
  }

  async commit(organizationId: string, examBoardCourseId: string, buffer: Buffer) {
    const raw = await parseSheet(buffer, ALIASES);
    const { rows } = await this.validate(organizationId, examBoardCourseId, raw);
    let created = 0;
    const errors: { rowNumber: number; error: string }[] = [];
    for (const row of rows) {
      if (row.errors.length) {
        errors.push({ rowNumber: row.rowNumber, error: row.errors[0] });
        continue;
      }
      const d = row.data;
      await this.subjectRepo.save(
        this.subjectRepo.create({
          organizationId,
          examBoardCourseId,
          termNumber: Number(d.termNumber),
          name: d.name,
          nameArabic: d.nameArabic || null,
          code: d.code || null,
          maxMarks: d.maxMarks ? Number(d.maxMarks) : 100,
          passMarks: d.passMarks ? Number(d.passMarks) : 35,
          ceMaxMarks: d.ceMaxMarks ? Number(d.ceMaxMarks) : null,
          cePassMarks: d.cePassMarks ? Number(d.cePassMarks) : null,
        }),
      );
      created++;
    }
    const invalid = rows.filter((r) => r.errors.length).length;
    if (created > 0) {
      await this.examBoard.syncInstitutionsForCourse(organizationId, examBoardCourseId);
    }
    return { created, skipped: invalid, errors };
  }

  private async validate(
    organizationId: string,
    examBoardCourseId: string,
    raw: Record<string, string>[],
  ): Promise<{ rows: ImportRowResult[] }> {
    if (!examBoardCourseId) {
      throw new BadRequestException(
        'Select a course before importing subjects',
      );
    }
    const course = await this.examBoard.getOrgCourse(organizationId, examBoardCourseId);
    const terms = this.examBoard.termsForCourse(course);
    const validTermNumbers = new Set(terms.map((t) => t.number));

    const existing = await this.subjectRepo.find({
      where: { examBoardCourseId },
      select: { code: true, name: true, termNumber: true },
    });
    const existingKeys = new Set(
      existing.map((s) => `${s.termNumber}::${s.name.toLowerCase()}`),
    );
    const seen = new Set<string>();

    const rows: ImportRowResult[] = raw.map((d) => {
      const errors: string[] = [];
      const termNumber = Number(d.termNumber);
      if (!d.termNumber) errors.push('Year/Semester is required');
      else if (!Number.isInteger(termNumber) || !validTermNumbers.has(termNumber)) {
        errors.push(`Year/Semester must be 1-${terms.length} for this course`);
      }
      if (!d.name) errors.push('Subject name is required');
      else {
        const key = `${termNumber}::${d.name.toLowerCase()}`;
        if (existingKeys.has(key) || seen.has(key)) {
          errors.push('Subject already exists for this course/term');
        } else {
          seen.add(key);
        }
      }
      if (d.maxMarks && Number.isNaN(Number(d.maxMarks))) errors.push('Max marks must be a number');
      if (d.passMarks && Number.isNaN(Number(d.passMarks))) errors.push('Pass marks must be a number');
      return { rowNumber: Number(d.__row ?? 0), data: d, errors };
    });
    return { rows };
  }
}
