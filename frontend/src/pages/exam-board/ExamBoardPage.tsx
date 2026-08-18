import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Printer, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { toast } from '@/stores/toast.store';
import { formatDate } from '@/lib/format';
import { printExamSchedule } from '@/lib/printExamSchedule';
import {
  CourseTerm,
  EbAssignedSubject,
  EbBatch,
  EbExam,
  EbExamSubject,
  TenantExamBoardApi,
} from '@/services/examBoardTenant.api';

const TABS = ['batches', 'exams'] as const;
type Tab = (typeof TABS)[number];

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}

/** Empty-string-safe optional number — z.coerce.number() turns "" into 0, which then fails .min(). */
const optionalNumber = (min: number) =>
  z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number().min(min).optional(),
  );

export function ExamBoardPage() {
  const [tab, setTab] = useState<Tab>('batches');

  return (
    <>
      <PageHeader
        title="Examination Board"
        description="Batches, exams and marks driven by your organization's Examination Board."
      />
      <div className="mb-5 flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition ${
              tab === t ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'batches' && <BatchesTab />}
      {tab === 'exams' && <ExamsTab />}
    </>
  );
}

// ── Batches ────────────────────────────────────────────────────────────────────
function BatchesTab() {
  const [viewBatch, setViewBatch] = useState<EbBatch | null>(null);
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['eb-tenant-batches-all'],
    queryFn: () => TenantExamBoardApi.listBatches(),
  });
  const { data: courses = [] } = useQuery({
    queryKey: ['eb-tenant-courses'],
    queryFn: TenantExamBoardApi.listCourses,
  });
  const { data: years = [] } = useQuery({
    queryKey: ['eb-tenant-years'],
    queryFn: TenantExamBoardApi.listAcademicYears,
  });
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? id;
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? id;

  return (
    <div>
      {batches.length === 0 && !isLoading && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No batches yet. Your organization admin creates batches in the Examination Board portal.
        </div>
      )}
      <DataTable<EbBatch>
        rows={batches}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No batches yet."
        columns={[
          { key: 'name', header: 'Batch', render: (b) => (
            <div className="leading-tight">
              <div className="font-medium text-slate-900">{b.name}</div>
              {b.code && <code className="text-xs text-slate-500">{b.code}</code>}
            </div>
          ) },
          { key: 'course', header: 'Course', render: (b) => courseName(b.examBoardCourseId) },
          { key: 'year', header: 'Academic Year', render: (b) => yearName(b.examBoardAcademicYearId) },
          { key: 'capacity', header: 'Capacity', render: (b) => b.capacity ?? '—' },
          { key: 'status', header: 'Status', render: (b) => (
            <Badge tone={b.status === 'active' ? 'green' : 'slate'}>{b.status}</Badge>
          ) },
        ]}
        actions={(b) => (
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
            title="View enrolled students"
            onClick={() => setViewBatch(b)}
          >
            <Users className="h-4 w-4" />
          </button>
        )}
      />

      {viewBatch && (
        <Modal
          open
          onClose={() => setViewBatch(null)}
          title={`Enrolled — ${viewBatch.name}`}
          footer={<button className="btn-secondary" onClick={() => setViewBatch(null)}>Close</button>}
        >
          <EnrollmentList batchId={viewBatch.id} />
        </Modal>
      )}
    </div>
  );
}

function EnrollmentList({ batchId }: { batchId: string }) {
  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['eb-tenant-enrollments', batchId],
    queryFn: () => TenantExamBoardApi.listEnrollments(batchId),
  });
  if (isLoading) return <div className="py-6 text-center text-slate-400">Loading…</div>;
  if (enrollments.length === 0)
    return <div className="py-6 text-center text-sm text-slate-400">No students enrolled yet.</div>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs text-slate-500">
        <tr>
          <th className="py-1.5">Admission #</th>
          <th className="py-1.5">Name</th>
        </tr>
      </thead>
      <tbody>
        {enrollments.map((e) => (
          <tr key={e.id} className="border-t border-slate-100">
            <td className="py-2"><code className="text-xs">{e.student?.admissionNumber}</code></td>
            <td className="py-2 font-medium text-slate-900">{e.student?.studentName}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Exams ──────────────────────────────────────────────────────────────────────
const EXAM_TYPES = ['unit_test', 'mid_term', 'final', 'quarterly', 'half_yearly'] as const;
const examSchema = z.object({
  examBoardBatchId: z.string().min(1, 'Required'),
  termNumber: z.coerce.number().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  examType: z.enum(EXAM_TYPES),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
});
type ExamForm = z.infer<typeof examSchema>;

function ExamsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<EbExam | null>(null);
  const { data: batches = [] } = useQuery({
    queryKey: ['eb-tenant-batches-all'],
    queryFn: () => TenantExamBoardApi.listBatches(),
  });
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['eb-tenant-exams'],
    queryFn: () => TenantExamBoardApi.listExams(),
  });
  const batchName = (id: string) => batches.find((b) => b.id === id)?.name ?? id;

  const create = useMutation({
    mutationFn: (p: ExamForm) => TenantExamBoardApi.createExam(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-tenant-exams'] });
      setOpen(false);
      toast.success('Exam scheduled');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<ExamForm>({
    resolver: zodResolver(examSchema),
    values: { examBoardBatchId: '', termNumber: 1, name: '', examType: 'unit_test', startDate: '', endDate: '' },
  });
  const formBatchId = watch('examBoardBatchId');
  const formCourseId = batches.find((b) => b.id === formBatchId)?.examBoardCourseId;
  const { data: terms = [] } = useQuery<CourseTerm[]>({
    queryKey: ['eb-tenant-course-terms', formCourseId],
    queryFn: () => TenantExamBoardApi.listCourseTerms(formCourseId!),
    enabled: open && !!formCourseId,
  });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn-primary" onClick={() => setOpen(true)} disabled={batches.length === 0}>
          <Plus className="mr-1.5 h-4 w-4" /> Schedule exam
        </button>
      </div>
      {batches.length === 0 && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No batches available. Ask your organization admin to create one.
        </div>
      )}
      <DataTable<EbExam>
        rows={exams}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No exams scheduled yet."
        columns={[
          { key: 'name', header: 'Exam', render: (e) => e.name },
          { key: 'batch', header: 'Batch', render: (e) => batchName(e.examBoardBatchId) },
          { key: 'term', header: 'Term', render: (e) => `Term ${e.termNumber}` },
          { key: 'type', header: 'Type', render: (e) => e.examType.replace('_', ' ') },
          { key: 'dates', header: 'Dates', render: (e) => `${e.startDate} – ${e.endDate}` },
          { key: 'status', header: 'Status', render: (e) => (
            <Badge tone={e.status === 'completed' ? 'green' : 'amber'}>{e.status}</Badge>
          ) },
        ]}
        actions={(e) => (
          <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => setDetail(e)}>
            Manage
          </button>
        )}
      />

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title="Schedule exam"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => create.mutate(v))} disabled={create.isPending}>
              {create.isPending ? 'Scheduling…' : 'Schedule'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4">
          <Field label="Batch" required error={errors.examBoardBatchId?.message}>
            <Select {...register('examBoardBatchId')}>
              <option value="">Select batch…</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field label="Term" required error={errors.termNumber?.message}>
            <Select {...register('termNumber')} disabled={!formCourseId}>
              {terms.map((t) => <option key={t.number} value={t.number}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Exam name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="Semester 1 Final" />
          </Field>
          <Field label="Type" error={errors.examType?.message}>
            <Select {...register('examType')}>
              {EXAM_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Start date" required error={errors.startDate?.message}>
            <Input type="date" {...register('startDate')} />
          </Field>
          <Field label="End date" required error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} />
          </Field>
        </form>
      </Modal>

      {detail && (
        <ExamDetailModal exam={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function ExamDetailModal({ exam, onClose }: { exam: EbExam; onClose: () => void }) {
  const [activeSubject, setActiveSubject] = useState<EbExamSubject | null>(null);
  const { data: subjects = [] } = useQuery({
    queryKey: ['eb-tenant-subjects', exam.id],
    queryFn: () => TenantExamBoardApi.listSubjects(exam.id),
  });
  const { data: enrollments = [] } = useQuery({
    queryKey: ['eb-tenant-enrollments', exam.examBoardBatchId],
    queryFn: () => TenantExamBoardApi.listEnrollments(exam.examBoardBatchId),
  });
  const { data: batchSubjects = [] } = useQuery({
    queryKey: ['eb-tenant-batch-subjects', exam.examBoardBatchId, exam.termNumber],
    queryFn: () => TenantExamBoardApi.listAssignedSubjects(exam.examBoardBatchId, exam.termNumber),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={exam.name}
      description={`${exam.examType.replace('_', ' ')} · ${exam.startDate} – ${exam.endDate}`}
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={() => printExamSchedule(exam, subjects, {})}>
            <Printer className="mr-1.5 h-4 w-4 inline" /> Print / PDF
          </button>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </>
      }
    >
      {batchSubjects.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">
          No subjects are assigned to this batch's term yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5">Subject</th>
              <th className="py-1.5">Date</th>
              <th className="py-1.5">Time</th>
              <th className="py-1.5">Max / Pass</th>
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {batchSubjects.map((s) => (
              <TenantSubjectScheduleRow
                key={s.id}
                examId={exam.id}
                subjectMaster={s}
                existing={subjects.find((es) => es.subjectName === s.name) ?? null}
                onEnterMarks={setActiveSubject}
              />
            ))}
          </tbody>
        </table>
      )}

      {activeSubject && (
        <MarksEntryModal
          examId={exam.id}
          subject={activeSubject}
          students={enrollments.map((e) => e.student).filter((s): s is NonNullable<typeof s> => !!s)}
          onClose={() => setActiveSubject(null)}
        />
      )}
    </Modal>
  );
}

function TenantSubjectScheduleRow({
  examId,
  subjectMaster,
  existing,
  onEnterMarks,
}: {
  examId: string;
  subjectMaster: EbAssignedSubject;
  existing: EbExamSubject | null;
  onEnterMarks: (subject: EbExamSubject) => void;
}) {
  const qc = useQueryClient();
  const [row, setRow] = useState<EbExamSubject | null>(existing);
  const [date, setDate] = useState(existing?.date?.slice(0, 10) ?? '');
  const [time, setTime] = useState(existing?.time?.slice(0, 5) ?? '');

  useEffect(() => {
    if (existing) {
      setRow(existing);
      setDate(existing.date?.slice(0, 10) ?? '');
      setTime(existing.time?.slice(0, 5) ?? '');
    }
  }, [existing]);

  const ensureRow = async (): Promise<EbExamSubject> => {
    if (row) return row;
    const created = await TenantExamBoardApi.addSubject(examId, {
      subjectName: subjectMaster.name,
      maxMarks: subjectMaster.maxMarks,
      passMarks: subjectMaster.passMarks,
      ceMaxMarks: subjectMaster.ceMaxMarks ?? undefined,
      cePassMarks: subjectMaster.cePassMarks ?? undefined,
      date: date || undefined,
      time: time || undefined,
    });
    setRow(created);
    qc.invalidateQueries({ queryKey: ['eb-tenant-subjects', examId] });
    return created;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (row) {
        const updated = await TenantExamBoardApi.updateSubject(examId, row.id, {
          date: date || undefined,
          time: time || undefined,
        });
        setRow(updated);
        return updated;
      }
      return ensureRow();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eb-tenant-subjects', examId] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  const handleEnterMarks = async () => {
    try {
      const r = await ensureRow();
      onEnterMarks(r);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 font-medium text-slate-900">{subjectMaster.name}</td>
      <td className="py-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={() => save.mutate()}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => save.mutate()}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 text-slate-500">{subjectMaster.maxMarks} / {subjectMaster.passMarks}</td>
      <td className="py-2 text-right">
        <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={handleEnterMarks}>
          Enter marks
        </button>
      </td>
    </tr>
  );
}

function MarksEntryModal({
  examId,
  subject,
  students,
  onClose,
}: {
  examId: string;
  subject: EbExamSubject;
  students: { id: string; admissionNumber: string; studentName: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: existing = [] } = useQuery({
    queryKey: ['eb-tenant-marks', examId, subject.id],
    queryFn: () => TenantExamBoardApi.listMarks(examId, subject.id),
  });

  const hasCe = subject.ceMaxMarks != null || subject.cePassMarks != null;
  const [values, setValues] = useState<Record<string, { marks: string; ceMarks: string; absent: boolean }>>({});

  useEffect(() => {
    const existingByStudent = new Map(existing.map((m) => [m.studentId, m]));
    setValues(
      Object.fromEntries(
        students.map((s) => {
          const m = existingByStudent.get(s.id);
          return [
            s.id,
            {
              marks: m ? String(m.marksObtained) : '',
              ceMarks: m?.ceMarksObtained != null ? String(m.ceMarksObtained) : '',
              absent: m?.isAbsent ?? false,
            },
          ];
        }),
      ),
    );
  }, [existing, students]);

  const save = useMutation({
    mutationFn: () =>
      TenantExamBoardApi.saveMarks(
        examId,
        subject.id,
        students.map((s) => ({
          studentId: s.id,
          marksObtained: Number(values[s.id]?.marks || 0),
          ceMarksObtained: hasCe ? Number(values[s.id]?.ceMarks || 0) : undefined,
          isAbsent: values[s.id]?.absent ?? false,
        })),
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-tenant-marks', examId, subject.id] });
      toast.success('Marks saved');
      onClose();
    },
    onError: (e: any) => toast.error(errMsg(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Marks — ${subject.subjectName}`}
      description={
        hasCe
          ? `Max ${subject.maxMarks} · Pass ${subject.passMarks} · CE Max ${subject.ceMaxMarks ?? '—'} · CE Pass ${subject.cePassMarks ?? '—'}`
          : `Max ${subject.maxMarks} · Pass ${subject.passMarks}`
      }
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending || students.length === 0}>
            {save.isPending ? 'Saving…' : 'Save marks'}
          </button>
        </>
      }
    >
      {students.length === 0 ? (
        <p className="text-sm text-slate-400">No students enrolled in this batch yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5">Admission #</th>
              <th className="py-1.5">Name</th>
              <th className="py-1.5">Marks</th>
              {hasCe && <th className="py-1.5">CE Marks</th>}
              <th className="py-1.5">Absent</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-1.5"><code className="text-xs">{s.admissionNumber}</code></td>
                <td className="py-1.5 font-medium text-slate-900">{s.studentName}</td>
                <td className="py-1.5">
                  <input
                    type="number"
                    className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-50"
                    value={values[s.id]?.marks ?? ''}
                    disabled={values[s.id]?.absent}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [s.id]: { ...v[s.id], marks: e.target.value, absent: false } }))
                    }
                  />
                </td>
                {hasCe && (
                  <td className="py-1.5">
                    <input
                      type="number"
                      className="w-20 rounded-md border border-slate-200 px-2 py-1 text-sm disabled:bg-slate-50"
                      value={values[s.id]?.ceMarks ?? ''}
                      disabled={values[s.id]?.absent}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [s.id]: { ...v[s.id], ceMarks: e.target.value, absent: false } }))
                      }
                    />
                  </td>
                )}
                <td className="py-1.5">
                  <input
                    type="checkbox"
                    checked={values[s.id]?.absent ?? false}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [s.id]: { ...v[s.id], absent: e.target.checked } }))
                    }
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}
