import { useEffect, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import {
  ImportCommitResult,
  ImportPreview,
  VisitorsApi,
} from '@/services/school.api';
import { Modal } from '@/components/ui/Modal';

export function VisitorImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setPreview(null);
      setResult(null);
      setError(null);
    }
  }, [open]);

  const run = async (mode: 'preview' | 'commit') => {
    if (!file) return;
    setBusy(mode);
    setError(null);
    try {
      if (mode === 'preview') {
        setPreview(await VisitorsApi.importPreview(file));
        setResult(null);
      } else {
        setResult(await VisitorsApi.importCommit(file));
        onImported();
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ?? e?.message ?? 'Import failed',
      );
    } finally {
      setBusy(null);
    }
  };

  const invalidRows = preview?.rows.filter((r) => r.errors.length) ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import visitors"
      description="Upload the .xlsx template. Each row links a visitor to a student by Admission #."
      size="xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => run('preview')}
            disabled={!file || !!busy}
          >
            {busy === 'preview' ? 'Validating…' : 'Validate'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => run('commit')}
            disabled={
              !file || !!busy || (preview ? preview.summary.valid === 0 : false)
            }
          >
            {busy === 'commit' ? 'Importing…' : 'Import valid rows'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          onClick={() => VisitorsApi.importTemplate()}
        >
          <Download className="h-4 w-4" /> Download template
        </button>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500 hover:border-brand-400 hover:bg-brand-50/40">
          <Upload className="h-5 w-5" />
          {file ? (
            <span className="font-medium text-slate-700">{file.name}</span>
          ) : (
            'Choose an .xlsx file to upload'
          )}
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
            }}
          />
        </label>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {preview && !result && (
          <div className="rounded-md border border-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm">
              <span className="font-medium">{preview.summary.total} rows</span>
              <span className="text-green-600">
                {preview.summary.valid} valid
              </span>
              <span className="text-red-600">
                {preview.summary.invalid} invalid
              </span>
            </div>
            {invalidRows.length > 0 && (
              <div className="max-h-52 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-1.5">Row</th>
                      <th className="px-3 py-1.5">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invalidRows.map((r) => (
                      <tr key={r.rowNumber} className="border-t border-slate-50">
                        <td className="px-3 py-1.5 text-slate-500">
                          {r.rowNumber}
                        </td>
                        <td className="px-3 py-1.5 text-red-600">
                          {r.errors.join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {result && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Imported {result.created} visitor{result.created === 1 ? '' : 's'}.
            {result.skipped > 0 && ` Skipped ${result.skipped} invalid row(s).`}
          </div>
        )}
      </div>
    </Modal>
  );
}
