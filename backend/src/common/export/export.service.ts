import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { PdfService } from '../pdf/pdf.service';

export type ExportFormat = 'xlsx' | 'pdf';

export interface ExportColumn<T> {
  header: string;
  /** Returns the cell value for a row. */
  value: (row: T) => string | number | null | undefined;
  width?: number;
}

@Injectable()
export class ExportService {
  constructor(private readonly pdf: PdfService) {}

  async toExcel<T>(
    sheetName: string,
    columns: ExportColumn<T>[],
    rows: T[],
  ): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'EduPro';
    wb.created = new Date(0); // deterministic
    const ws = wb.addWorksheet(sheetName.slice(0, 31) || 'Sheet1');

    ws.columns = columns.map((c) => ({
      header: c.header,
      key: c.header,
      width: c.width ?? Math.max(12, c.header.length + 2),
    }));
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };

    for (const row of rows) {
      ws.addRow(columns.map((c) => normalize(c.value(row))));
    }
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    const out = await wb.xlsx.writeBuffer();
    return Buffer.from(out as ArrayBuffer);
  }

  async toPdf<T>(
    title: string,
    columns: ExportColumn<T>[],
    rows: T[],
  ): Promise<Buffer> {
    const html = buildTableHtml(title, columns, rows);
    return this.pdf.htmlToPdf(html, {
      landscape: true,
      margin: { top: '10mm', bottom: '10mm', left: '8mm', right: '8mm' },
    });
  }

  /** Render and stream a file response for the given format. Bypasses the JSON envelope. */
  async send<T>(
    res: Response,
    format: ExportFormat,
    baseFilename: string,
    title: string,
    columns: ExportColumn<T>[],
    rows: T[],
  ): Promise<void> {
    if (format === 'pdf') {
      const buf = await this.toPdf(title, columns, rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${baseFilename}.pdf"`,
      );
      res.end(buf);
      return;
    }
    const buf = await this.toExcel(title, columns, rows);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${baseFilename}.xlsx"`,
    );
    res.end(buf);
  }
}

function normalize(v: string | number | null | undefined): string | number {
  if (v === null || v === undefined) return '';
  return v;
}

function escapeHtml(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildTableHtml<T>(
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
): string {
  const head = columns.map((c) => `<th>${escapeHtml(c.header)}</th>`).join('');
  const body = rows
    .map(
      (r) =>
        `<tr>${columns
          .map((c) => `<td>${escapeHtml(c.value(r))}</td>`)
          .join('')}</tr>`,
    )
    .join('');
  const generated = '';
  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; margin: 0; padding: 6px; }
    h1 { font-size: 16px; margin: 0 0 2px; color: #0f172a; }
    .meta { font-size: 10px; color: #64748b; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
    th { background: #e2e8f0; font-weight: 700; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">${rows.length} record${rows.length === 1 ? '' : 's'}${generated}</div>
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
  </body></html>`;
}
