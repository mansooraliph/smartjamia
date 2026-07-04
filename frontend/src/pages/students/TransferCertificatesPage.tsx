import { useEffect, useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Download, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  ExportFormat,
  IssueTcPayload,
  StudentsApi,
  TcConduct,
  TcReason,
  TransferCertificate,
  TransferCertificatesApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { useTerminology } from '@/hooks/useTerminology';
import { formatDate } from '@/lib/format';

const REASONS: TcReason[] = [
  'transfer',
  'completion',
  'expulsion',
  'withdrawal',
  'other',
];
const CONDUCTS: TcConduct[] = ['excellent', 'good', 'satisfactory', 'poor'];

const reasonTone: Record<TcReason, 'blue' | 'green' | 'red' | 'amber' | 'slate'> =
  {
    transfer: 'blue',
    completion: 'green',
    expulsion: 'red',
    withdrawal: 'amber',
    other: 'slate',
  };

const schema = z.object({
  studentId: z.string().uuid('Select a student'),
  reason: z.enum(['transfer', 'completion', 'expulsion', 'withdrawal', 'other']),
  conduct: z.enum(['excellent', 'good', 'satisfactory', 'poor']),
  feesCleared: z.boolean(),
  issueDate: z.string().min(1, 'Required'),
  lastClass: z.string().optional().or(z.literal('')),
});
type FormValues = z.infer<typeof schema>;

export function TransferCertificatesPage() {
  const qc = useQueryClient();
  const term = useTerminology();
  const [params, setParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    tc?: TransferCertificate;
  }>({ open: false });
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const { data: tcData, isLoading } = useQuery({
    queryKey: ['transfer-certificates', page, limit],
    queryFn: () => TransferCertificatesApi.list({ page, limit }),
    placeholderData: keepPreviousData,
    // Poll while any certificate PDF is still being generated in the background.
    refetchInterval: (query) =>
      query.state.data?.items?.some((t) => !t.pdfUrl) ? 2500 : false,
  });
  const tcs = tcData?.items ?? [];

  const { data: students = [] } = useQuery({
    queryKey: ['students', 'lookup-for-tc'],
    queryFn: () => StudentsApi.lookup({ status: 'active' }),
  });

  // Open the issue modal pre-selected when arriving from a student row.
  const preselectStudentId = params.get('student') ?? '';
  useEffect(() => {
    if (preselectStudentId) setModalOpen(true);
  }, [preselectStudentId]);

  const issue = useMutation({
    mutationFn: (payload: IssueTcPayload) =>
      TransferCertificatesApi.issue(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfer-certificates'] });
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      closeModal();
    },
  });

  const regen = useMutation({
    mutationFn: (id: string) => TransferCertificatesApi.regeneratePdf(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['transfer-certificates'] }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => TransferCertificatesApi.revoke(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transfer-certificates'] });
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setConfirm({ open: false });
    },
  });

  function closeModal() {
    setModalOpen(false);
    if (preselectStudentId) {
      params.delete('student');
      setParams(params, { replace: true });
    }
  }

  // Students already holding a TC can't be issued another.
  const issuedStudentIds = useMemo(
    () => new Set(tcs.map((t) => t.studentId)),
    [tcs],
  );
  const eligibleStudents = useMemo(
    () => students.filter((s) => !issuedStudentIds.has(s.id)),
    [students, issuedStudentIds],
  );

  return (
    <>
      <PageHeader
        title="Transfer Certificates"
        description="Issue and track TCs. Issuing a certificate transitions the student out of the active roll."
        actions={
          <div className="flex items-center gap-2">
            <ExportButtons
              onExport={(format: ExportFormat) =>
                TransferCertificatesApi.export(format)
              }
            />
            <button className="btn-primary" onClick={() => setModalOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Issue TC
            </button>
          </div>
        }
      />

      <DataTable<TransferCertificate>
        rows={tcs}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No transfer certificates issued yet."
        columns={[
          {
            key: 'tcNumber',
            header: 'TC #',
            render: (t) => (
              <code className="text-xs font-medium text-slate-700">
                {t.tcNumber}
              </code>
            ),
          },
          {
            key: 'student',
            header: 'Student',
            render: (t) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">
                  {t.student
                    ? t.student.studentName
                    : '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {t.student?.admissionNumber ?? ''}
                </div>
              </div>
            ),
          },
          {
            key: 'lastClass',
            header: `Last ${term.level.toLowerCase()}`,
            render: (t) => t.lastClass,
          },
          {
            key: 'reason',
            header: 'Reason',
            render: (t) => (
              <Badge tone={reasonTone[t.reason]}>{t.reason}</Badge>
            ),
          },
          {
            key: 'conduct',
            header: 'Conduct',
            render: (t) => <span className="capitalize">{t.conduct}</span>,
          },
          {
            key: 'fees',
            header: 'Fees',
            render: (t) =>
              t.feesCleared ? (
                <Badge tone="green">Cleared</Badge>
              ) : (
                <Badge tone="amber">Pending</Badge>
              ),
          },
          {
            key: 'issueDate',
            header: 'Issued',
            render: (t) => formatDate(t.issueDate),
          },
          {
            key: 'pdf',
            header: 'Certificate',
            render: (t) =>
              t.pdfUrl ? (
                <a
                  href={t.pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> PDF
                </a>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…
                </span>
              ),
          },
        ]}
        actions={(t) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600 disabled:opacity-40"
              onClick={() => regen.mutate(t.id)}
              disabled={regen.isPending}
              title="Regenerate PDF"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, tc: t })}
              title="Revoke"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      {tcData && (
        <Pagination
          page={tcData.page}
          totalPages={tcData.totalPages}
          total={tcData.total}
          limit={tcData.limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}

      <IssueTcModal
        open={modalOpen}
        students={eligibleStudents.map((s) => ({
          id: s.id,
          label: `${s.admissionNumber} · ${s.studentName}`,
        }))}
        preselectStudentId={preselectStudentId}
        saving={issue.isPending}
        errorMsg={errMsg(issue.error)}
        onClose={closeModal}
        onSubmit={(v) =>
          issue.mutate({
            studentId: v.studentId,
            reason: v.reason,
            conduct: v.conduct,
            feesCleared: v.feesCleared,
            issueDate: v.issueDate,
            lastClass: v.lastClass || undefined,
          })
        }
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.tc && revoke.mutate(confirm.tc.id)}
        loading={revoke.isPending}
        title="Revoke certificate?"
        message={`Revoke ${confirm.tc?.tcNumber} and restore ${
          confirm.tc?.student
            ? confirm.tc.student.studentName
            : 'the student'
        } to active status.`}
        confirmText="Revoke TC"
      />
    </>
  );
}

function IssueTcModal({
  open,
  students,
  preselectStudentId,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  students: { id: string; label: string }[];
  preselectStudentId: string;
  onClose: () => void;
  onSubmit: (v: FormValues) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const term = useTerminology();
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      studentId: preselectStudentId,
      reason: 'transfer',
      conduct: 'good',
      feesCleared: false,
      issueDate: today,
      lastClass: '',
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Issue transfer certificate"
      description="The student will be marked transferred (or alumni, for course completion) and their active enrollment closed."
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
          >
            {saving ? 'Issuing…' : 'Issue TC'}
          </button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Student"
          required
          error={errors.studentId?.message}
          className="sm:col-span-2"
        >
          <Select {...register('studentId')} disabled={!!preselectStudentId}>
            <option value="">— Select a student —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
          {preselectStudentId && (
            <p className="mt-1 text-xs text-slate-500">
              Pre-selected from the student record.
            </p>
          )}
        </Field>

        <Field label="Reason" required error={errors.reason?.message}>
          <Select {...register('reason')}>
            {REASONS.map((r) => (
              <option key={r} value={r} className="capitalize">
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Conduct" required error={errors.conduct?.message}>
          <Select {...register('conduct')}>
            {CONDUCTS.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Issue date" required error={errors.issueDate?.message}>
          <Input type="date" {...register('issueDate')} />
        </Field>
        <Field label={`Last ${term.level.toLowerCase()} (optional)`}>
          <Input
            {...register('lastClass')}
            placeholder="Auto-resolved from enrollment"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" {...register('feesCleared')} />
          All dues cleared
        </label>

        {errorMsg && (
          <div className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}

function errMsg(e: unknown): string | undefined {
  if (!e) return undefined;
  const anyE = e as any;
  return (
    anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong'
  );
}
