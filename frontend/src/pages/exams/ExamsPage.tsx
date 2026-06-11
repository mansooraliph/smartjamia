import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Award,
  ChevronRight,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Save,
} from 'lucide-react';
import {
  AcademicYearsApi,
  ClassesApi,
  ExamsApi,
  ExamStatus,
  ExamType,
  MarkEntry,
  MarksGrid,
  ReportCardRow,
  ReportCardsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { useTerminology } from '@/hooks/useTerminology';
import { cn } from '@/lib/cn';

const EXAM_TYPES: { value: ExamType; label: string }[] = [
  { value: 'unit_test', label: 'Unit Test' },
  { value: 'mid_term', label: 'Mid-Term' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half-Yearly' },
  { value: 'final', label: 'Final' },
];

const STATUS_TONE: Record<ExamStatus, 'slate' | 'blue' | 'amber' | 'green'> = {
  draft: 'slate',
  scheduled: 'blue',
  ongoing: 'amber',
  completed: 'green',
};

type ExamView = { examId: string; mode: 'marks' | 'reports' };

export function ExamsPage() {
  const [view, setView] = useState<ExamView | null>(null);
  if (view?.mode === 'marks') {
    return (
      <MarksEntry
        examId={view.examId}
        onBack={() => setView(null)}
        onReports={() => setView({ examId: view.examId, mode: 'reports' })}
      />
    );
  }
  if (view?.mode === 'reports') {
    return (
      <ReportCardsView
        examId={view.examId}
        onBack={() => setView(null)}
        onMarks={() => setView({ examId: view.examId, mode: 'marks' })}
      />
    );
  }
  return <ExamsList onOpen={(examId) => setView({ examId, mode: 'marks' })} />;
}

// ───── List + create ──────────────────────────────────────────────────────────
function ExamsList({ onOpen }: { onOpen: (id: string) => void }) {
  const term = useTerminology();
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });
  const effectiveYearId = useMemo(
    () => yearId || years.find((y) => y.isCurrent)?.id || years[0]?.id || '',
    [yearId, years],
  );

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', effectiveYearId],
    queryFn: () => ClassesApi.list(effectiveYearId || undefined),
    enabled: !!effectiveYearId,
  });

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['exams', effectiveYearId, classId],
    queryFn: () =>
      ExamsApi.list({
        academicYearId: effectiveYearId || undefined,
        classId: classId || undefined,
      }),
    enabled: !!effectiveYearId,
  });

  const classNameById = useMemo(
    () => new Map(classes.map((c) => [c.id, c.name])),
    [classes],
  );

  return (
    <>
      <PageHeader
        title="Exams"
        description="Create exams and enter subject-wise marks. Results flow to the student & parent portal."
        actions={
          <button
            className="btn-primary"
            onClick={() => setCreating(true)}
            disabled={classes.length === 0}
            title={
              classes.length === 0
                ? `Create a ${term.level.toLowerCase()} first`
                : 'New exam'
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> New exam
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select
          className="!w-44"
          value={effectiveYearId}
          onChange={(e) => setYearId(e.target.value)}
        >
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </Select>
        <Select
          className="!w-44"
          value={classId}
          onChange={(e) => setClassId(e.target.value)}
        >
          <option value="">All {term.levelPlural.toLowerCase()}</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      ) : exams.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          No exams yet. Click <span className="font-medium">New exam</span> to
          create one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>Exam</Th>
                <Th>{term.level}</Th>
                <Th>Type</Th>
                <Th>Dates</Th>
                <Th>Status</Th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exams.map((ex) => (
                <tr
                  key={ex.id}
                  onClick={() => onOpen(ex.id)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {ex.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {classNameById.get(ex.classId) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm capitalize text-slate-600">
                    {ex.examType.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {ex.startDate?.slice(0, 10)} → {ex.endDate?.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[ex.status]}>{ex.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="inline h-4 w-4 text-slate-400" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateExamModal
          academicYearId={effectiveYearId}
          classes={classes}
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            onOpen(id);
          }}
        />
      )}
    </>
  );
}

const createSchema = z.object({
  name: z.string().min(1, 'Required'),
  examType: z.string().min(1),
  classId: z.string().uuid('Pick a class'),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
});
type CreateForm = z.infer<typeof createSchema>;

function CreateExamModal({
  academicYearId,
  classes,
  onClose,
  onCreated,
}: {
  academicYearId: string;
  classes: { id: string; name: string }[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { examType: 'mid_term' },
  });

  const create = useMutation({
    mutationFn: (f: CreateForm) =>
      ExamsApi.create({
        name: f.name,
        examType: f.examType as ExamType,
        academicYearId,
        classId: f.classId,
        startDate: f.startDate,
        endDate: f.endDate,
      }),
    onSuccess: (exam) => {
      qc.invalidateQueries({ queryKey: ['exams'] });
      onCreated(exam.id);
    },
  });

  return (
    <Modal open onClose={onClose} title="New exam" size="md">
      <form
        onSubmit={handleSubmit((f) => create.mutate(f))}
        className="space-y-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Exam name</label>
          <Input placeholder="e.g. Mid-Term 1" {...register('name')} />
          {errors.name && <FieldErr msg={errors.name.message} />}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Type</label>
            <Select {...register('examType')}>
              {EXAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Class</label>
            <Select {...register('classId')}>
              <option value="">Select…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {errors.classId && <FieldErr msg={errors.classId.message} />}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
            <Input type="date" {...register('startDate')} />
            {errors.startDate && <FieldErr msg={errors.startDate.message} />}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">End date</label>
            <Input type="date" {...register('endDate')} />
            {errors.endDate && <FieldErr msg={errors.endDate.message} />}
          </div>
        </div>
        {create.error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errMsg(create.error)}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={create.isPending}
          >
            {create.isPending ? 'Creating…' : 'Create & enter marks'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ───── Marks entry grid ───────────────────────────────────────────────────────
function MarksEntry({
  examId,
  onBack,
  onReports,
}: {
  examId: string;
  onBack: () => void;
  onReports: () => void;
}) {
  const qc = useQueryClient();
  const { data: grid, isLoading } = useQuery({
    queryKey: ['marks-grid', examId],
    queryFn: () => ExamsApi.marksGrid(examId),
  });

  // local edits keyed `${studentId}:${subjectId}` → string ('' | number | 'AB')
  const [cells, setCells] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!grid) return;
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(grid.marks)) {
      init[k] = v.isAbsent ? 'AB' : v.marksObtained == null ? '' : String(v.marksObtained);
    }
    setCells(init);
  }, [grid]);

  const save = useMutation({
    mutationFn: () => {
      if (!grid) throw new Error('not loaded');
      const entries: MarkEntry[] = [];
      for (const st of grid.students) {
        for (const sub of grid.subjects) {
          const raw = cells[`${st.id}:${sub.id}`];
          if (raw === undefined || raw === '') continue;
          if (raw.toUpperCase() === 'AB') {
            entries.push({ studentId: st.id, subjectId: sub.id, isAbsent: true });
          } else {
            entries.push({
              studentId: st.id,
              subjectId: sub.id,
              marksObtained: Number(raw),
            });
          }
        }
      }
      return ExamsApi.saveMarks(examId, entries);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marks-grid', examId] });
    },
  });

  const setCell = (key: string, val: string) =>
    setCells((p) => ({ ...p, [key]: val }));

  const dirty = useMemo(() => {
    if (!grid) return false;
    for (const [k, v] of Object.entries(cells)) {
      const orig = grid.marks[k];
      const origStr = !orig
        ? ''
        : orig.isAbsent
          ? 'AB'
          : orig.marksObtained == null
            ? ''
            : String(orig.marksObtained);
      if ((v ?? '') !== origStr) return true;
    }
    return false;
  }, [cells, grid]);

  return (
    <>
      <PageHeader
        title={grid?.exam.name ?? 'Marks entry'}
        description={
          grid
            ? `${grid.students.length} students · ${grid.subjects.length} subjects · enter marks or "AB" for absent`
            : ' '
        }
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={onBack}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
            </button>
            <button className="btn-secondary" onClick={onReports}>
              <Award className="mr-1.5 h-4 w-4" /> Report cards
            </button>
            <button
              className="btn-primary"
              onClick={() => save.mutate()}
              disabled={!dirty || save.isPending}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {save.isPending ? 'Saving…' : 'Save marks'}
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      ) : !grid || grid.students.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          No students enrolled in this class for the exam's academic year.
        </div>
      ) : grid.subjects.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">
          No subjects defined for this class.{' '}
          <a href="/subjects" className="text-brand-600 hover:underline">
            Add subjects →
          </a>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Student
                </th>
                {grid.subjects.map((s) => (
                  <th
                    key={s.id}
                    className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500"
                    title={s.name}
                  >
                    {s.code || s.name}
                    <div className="font-normal normal-case text-slate-400">
                      /{s.maxMarks}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {grid.students.map((st) => (
                <tr key={st.id} className="hover:bg-slate-50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2">
                    <div className="text-sm font-medium text-slate-900">
                      {st.firstName} {st.lastName}
                    </div>
                    <div className="text-xs text-slate-400">
                      {st.rollNumber ? `Roll ${st.rollNumber} · ` : ''}
                      {st.admissionNumber}
                    </div>
                  </td>
                  {grid.subjects.map((sub) => {
                    const key = `${st.id}:${sub.id}`;
                    const val = cells[key] ?? '';
                    const num = Number(val);
                    const over = val !== '' && val.toUpperCase() !== 'AB' && (isNaN(num) || num > sub.maxMarks || num < 0);
                    const ab = val.toUpperCase() === 'AB';
                    return (
                      <td key={sub.id} className="px-2 py-1.5 text-center">
                        <input
                          value={val}
                          onChange={(e) => setCell(key, e.target.value)}
                          placeholder="—"
                          className={cn(
                            'w-16 rounded-md border px-2 py-1 text-center text-sm focus:outline-none focus:ring-1',
                            over
                              ? 'border-red-400 bg-red-50 text-red-700 focus:ring-red-400'
                              : ab
                                ? 'border-amber-300 bg-amber-50 text-amber-700 focus:ring-amber-400'
                                : 'border-slate-200 focus:border-brand-400 focus:ring-brand-400',
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {save.isSuccess && !dirty && (
        <div className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          ✓ Saved {save.data?.saved} marks.
        </div>
      )}
      {save.error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errMsg(save.error)}
        </div>
      )}
    </>
  );
}

// ───── Report cards (admin) ───────────────────────────────────────────────────
function ReportCardsView({
  examId,
  onBack,
  onMarks,
}: {
  examId: string;
  onBack: () => void;
  onMarks: () => void;
}) {
  const qc = useQueryClient();
  const { data: exam } = useQuery({
    queryKey: ['exam', examId],
    queryFn: () => ExamsApi.get(examId),
  });
  const { data, isLoading } = useQuery({
    queryKey: ['report-cards', examId],
    queryFn: () => ReportCardsApi.listForExam(examId),
    // While any PDF is still rendering in the background, keep polling.
    refetchInterval: (q) => {
      const list = q.state.data;
      if (list && list.items.some((i) => !i.pdfUrl)) return 2500;
      return false;
    },
  });

  const generate = useMutation({
    mutationFn: () => ReportCardsApi.generate(examId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-cards', examId] }),
  });
  const regen = useMutation({
    mutationFn: (id: string) => ReportCardsApi.regenerate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['report-cards', examId] }),
  });

  const items = data?.items ?? [];
  const hasCards = items.length > 0;
  const pending = items.filter((i) => !i.pdfUrl).length;

  return (
    <>
      <PageHeader
        title={exam ? `${exam.name} — Report Cards` : 'Report Cards'}
        description="Ranked results for the class. Generate to (re)compute ranks and build downloadable PDFs."
        actions={
          <div className="flex items-center gap-2">
            <button className="btn-secondary" onClick={onBack}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Exams
            </button>
            <button className="btn-secondary" onClick={onMarks}>
              Marks
            </button>
            <button
              className="btn-primary"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Award className="mr-1.5 h-4 w-4" />
              )}
              {hasCards ? 'Regenerate' : 'Generate report cards'}
            </button>
          </div>
        }
      />

      {generate.error && (
        <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errMsg(generate.error)}
        </div>
      )}

      {isLoading ? (
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      ) : !hasCards ? (
        <div className="card p-8 text-center text-slate-500">
          No report cards yet. Make sure marks are entered, then click{' '}
          <span className="font-medium">Generate report cards</span>.
        </div>
      ) : (
        <>
          {pending > 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating {pending} PDF{pending > 1 ? 's' : ''} in the background…
            </div>
          )}
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Rank</Th>
                  <Th>Student</Th>
                  <Th>Total</Th>
                  <Th>%</Th>
                  <Th>Grade</Th>
                  <Th>Result</Th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Report card
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((r) => (
                  <ReportCardRowView
                    key={r.id}
                    row={r}
                    onRegen={() => regen.mutate(r.id)}
                    regenBusy={regen.isPending && regen.variables === r.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function ReportCardRowView({
  row,
  onRegen,
  regenBusy,
}: {
  row: ReportCardRow;
  onRegen: () => void;
  regenBusy: boolean;
}) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3">
        <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-bold text-slate-700">
          {row.rank ?? '—'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{row.studentName}</div>
        <div className="text-xs text-slate-400">{row.admissionNumber}</div>
      </td>
      <td className="px-4 py-3 text-sm tabular-nums text-slate-700">
        {row.totalMarks}
        <span className="text-slate-400">/{row.maxTotalMarks}</span>
      </td>
      <td className="px-4 py-3 text-sm font-medium text-slate-900">
        {row.percentage}%
      </td>
      <td className="px-4 py-3">
        <Badge tone={row.isPassed ? 'green' : 'slate'}>{row.grade ?? '—'}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge tone={row.isPassed ? 'green' : 'red'}>
          {row.isPassed ? 'Pass' : 'Fail'}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right">
        {row.pdfUrl ? (
          <div className="inline-flex items-center gap-2">
            <a
              href={row.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
            >
              <Download className="h-3.5 w-3.5" /> PDF
            </a>
            <button
              onClick={onRegen}
              title="Regenerate PDF"
              className="text-slate-300 hover:text-brand-500"
              disabled={regenBusy}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', regenBusy && 'animate-spin')} />
            </button>
          </div>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> generating…
          </span>
        )}
      </td>
    </tr>
  );
}

// ───── helpers ────────────────────────────────────────────────────────────────
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}

function FieldErr({ msg }: { msg?: string }) {
  return <p className="mt-1 text-xs text-red-600">{msg}</p>;
}

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return (
    anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong'
  );
}
