import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Upload, Loader2 } from 'lucide-react';
import {
  AcademicsApi,
  ClassesApi,
  classLabel,
  ImportCommitResult,
  ImportPreview,
  SectionsApi,
  StudentsApi,
} from '@/services/school.api';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Input';
import { useTerminology } from '@/hooks/useTerminology';

interface YearOpt {
  id: string;
  name: string;
  isCurrent: boolean;
}

function defaultYear(years: YearOpt[]): string {
  return years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? '';
}

// ── Import students from Excel ───────────────────────────────────────────────
export function ImportStudentsModal({
  open,
  years,
  onClose,
  onImported,
}: {
  open: boolean;
  years: YearOpt[];
  onClose: () => void;
  onImported: () => void;
}) {
  const term = useTerminology();
  const [academicYearId, setAcademicYearId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [busy, setBusy] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAcademicYearId(defaultYear(years));
      setFile(null);
      setPreview(null);
      setResult(null);
      setError(null);
    }
  }, [open, years]);

  const run = async (mode: 'preview' | 'commit') => {
    if (!file) return;
    setBusy(mode);
    setError(null);
    try {
      if (mode === 'preview') {
        setPreview(await StudentsApi.importPreview(file, academicYearId));
        setResult(null);
      } else {
        const r = await StudentsApi.importCommit(file, academicYearId);
        setResult(r);
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
      title="Import students"
      description={`Upload the .xlsx template. Rows with a ${term.level} & ${term.group} (matching the selected year) are enrolled automatically.`}
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
            disabled={!file || !!busy || (preview ? preview.summary.valid === 0 : false)}
          >
            {busy === 'commit' ? 'Importing…' : 'Import valid rows'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            onClick={() => StudentsApi.importTemplate()}
          >
            <Download className="h-4 w-4" /> Download template
          </button>
          <div>
            <label className="mr-2 text-sm text-slate-600">Enroll into year</label>
            <Select
              className="!inline-block !w-44"
              value={academicYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

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
            Imported {result.created} student
            {result.created === 1 ? '' : 's'}.
            {result.skipped > 0 && ` Skipped ${result.skipped} invalid row(s).`}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Bulk-assign students to a class & section ────────────────────────────────
export function BulkAssignModal({
  open,
  years,
  onClose,
  onAssigned,
}: {
  open: boolean;
  years: YearOpt[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const term = useTerminology();
  const [academicYearId, setAcademicYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [startRoll, setStartRoll] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAcademicYearId(defaultYear(years));
      setClassId('');
      setSectionId('');
      setSearch('');
      setSelected(new Set());
      setStartRoll('');
      setResult(null);
      setError(null);
    }
  }, [open, years]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', academicYearId],
    queryFn: () => ClassesApi.list(academicYearId),
    enabled: open && !!academicYearId,
  });
  const { data: sections = [] } = useQuery({
    queryKey: ['sections', classId],
    queryFn: () => SectionsApi.list(classId),
    enabled: open && !!classId,
  });
  const { data: students = [] } = useQuery({
    queryKey: ['students', 'lookup-bulk', search],
    queryFn: () => StudentsApi.lookup({ search: search || undefined }),
    enabled: open,
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allShownSelected =
    students.length > 0 && students.every((s) => selected.has(s.id));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allShownSelected) students.forEach((s) => next.delete(s.id));
      else students.forEach((s) => next.add(s.id));
      return next;
    });

  const assign = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await AcademicsApi.bulkEnroll({
        academicYearId,
        classId,
        sectionId,
        studentIds: [...selected],
        startRoll: startRoll ? Number(startRoll) : undefined,
      });
      setResult(`Assigned ${r.assigned} student(s).`);
      onAssigned();
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message ?? e?.message ?? 'Assignment failed',
      );
    } finally {
      setBusy(false);
    }
  };

  const ready = academicYearId && classId && sectionId && selected.size > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Bulk assign to ${term.level.toLowerCase()} & ${term.group.toLowerCase()}`}
      description="Select students, then choose where to enrol them. Existing enrolments for that year are updated."
      size="xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={assign}
            disabled={!ready || busy}
          >
            {busy ? (
              <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" />
            ) : null}
            Assign {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <LabeledSelect
            label="Year"
            value={academicYearId}
            onChange={(v) => {
              setAcademicYearId(v);
              setClassId('');
              setSectionId('');
            }}
            options={years.map((y) => ({ value: y.id, label: y.name }))}
          />
          <LabeledSelect
            label={term.level}
            value={classId}
            onChange={(v) => {
              setClassId(v);
              setSectionId('');
            }}
            options={[
              { value: '', label: '— Select —' },
              ...classes.map((c) => ({ value: c.id, label: classLabel(c) })),
            ]}
          />
          <LabeledSelect
            label={term.group}
            value={sectionId}
            onChange={setSectionId}
            disabled={!classId}
            options={[
              { value: '', label: '— Select —' },
              ...sections.map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Start roll (optional)
            </label>
            <input
              type="number"
              className="w-28 rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={startRoll}
              onChange={(e) => setStartRoll(e.target.value)}
              placeholder="e.g. 1"
            />
          </div>
        </div>

        <input
          type="search"
          placeholder="Search students by name or admission #…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        />

        <div className="max-h-60 overflow-auto rounded-md border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allShownSelected}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2">Admission #</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer border-t border-slate-50 hover:bg-slate-50"
                  onClick={() => toggle(s.id)}
                >
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      readOnly
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <code className="text-xs">{s.admissionNumber}</code>
                  </td>
                  <td className="px-3 py-1.5 font-medium text-slate-900">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-3 py-1.5 capitalize text-slate-500">
                    {s.status}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-400">
                    No students match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
        {result && (
          <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {result}
          </div>
        )}
      </div>
    </Modal>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </label>
      <Select
        className="!w-40"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
