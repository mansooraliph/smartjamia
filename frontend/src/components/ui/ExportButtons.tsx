import { useState } from 'react';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import type { ExportFormat } from '@/services/school.api';

interface ExportButtonsProps {
  onExport: (format: ExportFormat) => Promise<void>;
  disabled?: boolean;
}

/** Excel + PDF export buttons with per-format loading state. */
export function ExportButtons({ onExport, disabled }: ExportButtonsProps) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  const run = async (format: ExportFormat) => {
    if (busy) return;
    setBusy(format);
    try {
      await onExport(format);
    } catch {
      // swallow — caller surfaces errors if needed
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-slate-200">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        onClick={() => run('xlsx')}
        disabled={disabled || !!busy}
        title="Export to Excel"
      >
        {busy === 'xlsx' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
        )}
        Excel
      </button>
      <div className="w-px bg-slate-200" />
      <button
        type="button"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        onClick={() => run('pdf')}
        disabled={disabled || !!busy}
        title="Export to PDF"
      >
        {busy === 'pdf' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 text-red-600" />
        )}
        PDF
      </button>
    </div>
  );
}
