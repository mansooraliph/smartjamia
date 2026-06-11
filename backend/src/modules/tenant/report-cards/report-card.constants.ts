// Report-card PDFs ride the same 'reports' BullMQ queue as TC PDFs.
export { REPORTS_QUEUE } from '../transfer-certificates/tc.constants';

export const REPORT_CARD_PDF_JOB = 'generate-report-card-pdf';

export interface ReportCardPdfJobData {
  schemaName: string;
  schoolId: string;
  reportCardId: string;
}
