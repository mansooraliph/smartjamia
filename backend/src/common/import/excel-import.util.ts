import { BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

export interface ImportRowResult {
  rowNumber: number;
  data: Record<string, string>;
  errors: string[];
}
export interface ImportPreviewResult {
  rows: ImportRowResult[];
  summary: { total: number; valid: number; invalid: number };
}
export interface ImportCommitResult {
  created: number;
  skipped: number;
  errors: { rowNumber: number; error: string }[];
}

export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && 'text' in (value as any)) {
    return String((value as any).text).trim();
  }
  return String(value).trim();
}

/**
 * Parse the first worksheet into row objects keyed by canonical field name.
 * `aliases` maps canonicalKey -> accepted header spellings (lower-cased, no
 * spaces/underscores). Each returned row carries `__row` (the sheet row number).
 */
export async function parseSheet(
  buffer: Buffer,
  aliases: Record<string, string[]>,
): Promise<Record<string, string>[]> {
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
    for (const [canon, al] of Object.entries(aliases)) {
      if (al.includes(norm)) {
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
      const v = cellToString(row.getCell(col).value);
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

/** Build a one-row .xlsx template buffer. */
export async function buildTemplate(
  sheetName: string,
  headers: string[],
  example: Record<string, string>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date(0);
  const ws = wb.addWorksheet(sheetName);
  ws.columns = headers.map((h) => ({ header: h, key: h, width: 18 }));
  ws.getRow(1).font = { bold: true };
  ws.addRow(example);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

export function summarize(rows: ImportRowResult[]): ImportPreviewResult {
  const invalid = rows.filter((r) => r.errors.length).length;
  return {
    rows,
    summary: { total: rows.length, valid: rows.length - invalid, invalid },
  };
}

export function toDate(s: string): string | null {
  if (!s) return null;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (ymd) return s;
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(s);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}
