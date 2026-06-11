export const REPORTS_QUEUE = 'reports';
export const TC_PDF_JOB = 'generate-tc-pdf';

export interface TcPdfJobData {
  schemaName: string;
  schoolId: string;
  tcId: string;
}
