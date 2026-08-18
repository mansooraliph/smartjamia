import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { StudentsApi } from '@/services/school.api';
import {
  EbAcademicYear,
  EbBatch,
  EbCourse,
  TenantExamBoardApi,
} from '@/services/examBoardTenant.api';

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
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <select
        className="w-56 rounded-md border border-slate-200 px-2 py-1.5 text-sm disabled:bg-slate-50"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function ExamBoardEnrollModal({
  open,
  onClose,
  onEnrolled,
}: {
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
}) {
  const [academicYearId, setAcademicYearId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAcademicYearId('');
      setCourseId('');
      setBatchId('');
      setSearch('');
      setSelected(new Set());
      setResult(null);
      setError(null);
    }
  }, [open]);

  const { data: years = [] } = useQuery<EbAcademicYear[]>({
    queryKey: ['eb-tenant-years'],
    queryFn: TenantExamBoardApi.listAcademicYears,
    enabled: open,
  });
  const { data: courses = [] } = useQuery<EbCourse[]>({
    queryKey: ['eb-tenant-courses'],
    queryFn: TenantExamBoardApi.listCourses,
    enabled: open,
  });
  const { data: batches = [] } = useQuery<EbBatch[]>({
    queryKey: ['eb-tenant-batches', courseId, academicYearId],
    queryFn: () =>
      TenantExamBoardApi.listBatches({
        examBoardCourseId: courseId || undefined,
        examBoardAcademicYearId: academicYearId || undefined,
      }),
    enabled: open,
  });
  const { data: students = [] } = useQuery({
    queryKey: ['students', 'lookup-eb', search],
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

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await TenantExamBoardApi.enroll(batchId, [...selected]);
      setResult(
        `Enrolled ${r.enrolled} student(s)` +
          (r.alreadyEnrolled ? ` (${r.alreadyEnrolled} already enrolled).` : '.'),
      );
      onEnrolled();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.message ?? 'Enrollment failed');
    } finally {
      setBusy(false);
    }
  };

  const ready = !!batchId && selected.size > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enroll to Exam Board Batch"
      description="Select students, then choose the batch to enroll them into."
      size="xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
          <button
            type="button"
            className="btn-primary"
            onClick={submit}
            disabled={!ready || busy}
          >
            {busy ? <Loader2 className="mr-1.5 inline h-4 w-4 animate-spin" /> : null}
            Enroll {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {years.length === 0 || courses.length === 0 ? (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            No courses/academic years have been enabled for this institution yet.
            Ask your organization admin to enable them in the Examination Board.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <LabeledSelect
                label="Academic Year"
                value={academicYearId}
                onChange={(v) => { setAcademicYearId(v); setBatchId(''); }}
                options={[{ value: '', label: 'All' }, ...years.map((y) => ({ value: y.id, label: y.name }))]}
              />
              <LabeledSelect
                label="Course"
                value={courseId}
                onChange={(v) => { setCourseId(v); setBatchId(''); }}
                options={[{ value: '', label: 'All' }, ...courses.map((c) => ({ value: c.id, label: c.name }))]}
              />
              <LabeledSelect
                label="Batch"
                value={batchId}
                onChange={setBatchId}
                options={[
                  { value: '', label: '— Select —' },
                  ...batches.map((b) => ({ value: b.id, label: b.name })),
                ]}
              />
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
                      <input type="checkbox" checked={allShownSelected} onChange={toggleAll} />
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
                        <input type="checkbox" checked={selected.has(s.id)} readOnly />
                      </td>
                      <td className="px-3 py-1.5">
                        <code className="text-xs">{s.admissionNumber}</code>
                      </td>
                      <td className="px-3 py-1.5 font-medium text-slate-900">{s.studentName}</td>
                      <td className="px-3 py-1.5 capitalize text-slate-500">{s.status}</td>
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
          </>
        )}

        {result && (
          <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{result}</div>
        )}
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
      </div>
    </Modal>
  );
}
