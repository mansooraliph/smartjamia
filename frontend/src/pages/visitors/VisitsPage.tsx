import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Check,
  X,
  LogIn,
  LogOut,
  CircleSlash,
  Search,
  Users,
  Clock,
  CalendarDays,
} from 'lucide-react';
import {
  ExportFormat,
  Visit,
  VisitStatus,
  VisitorsApi,
  VisitsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';

const STATUS_TONE: Record<
  VisitStatus,
  'amber' | 'blue' | 'green' | 'slate' | 'red'
> = {
  requested: 'amber',
  approved: 'blue',
  checked_in: 'green',
  checked_out: 'slate',
  rejected: 'red',
  cancelled: 'slate',
  no_show: 'red',
};
const STATUS_LABEL: Record<VisitStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  checked_in: 'Inside',
  checked_out: 'Left',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};
const STATUSES = Object.keys(STATUS_LABEL) as VisitStatus[];

function fmtTime(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
function fmtDuration(min: number | null): string {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function VisitsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<VisitStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => setPage(1), [search, status, dateFrom, dateTo, limit]);

  const { data: summary } = useQuery({
    queryKey: ['visit-summary'],
    queryFn: VisitsApi.summary,
    refetchInterval: 30000,
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['visits', page, limit, search, status, dateFrom, dateTo],
    queryFn: () =>
      VisitsApi.list({
        page,
        limit,
        search: search || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const visits = pageData?.items ?? [];

  const [requestOpen, setRequestOpen] = useState(false);
  const [checkIn, setCheckIn] = useState<{ open: boolean; visit?: Visit }>({
    open: false,
  });
  const [reject, setReject] = useState<{ open: boolean; visit?: Visit }>({
    open: false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['visits'] });
    qc.invalidateQueries({ queryKey: ['visit-summary'] });
  };
  const act = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: refresh,
  });

  return (
    <>
      <PageHeader
        title="Visits"
        description="Visit requests, gate entry/exit, and full visit history."
        actions={
          <div className="flex items-center gap-2">
            <ExportButtons
              onExport={(format: ExportFormat) =>
                VisitsApi.export(format, {
                  search: search || undefined,
                  status: status || undefined,
                  dateFrom: dateFrom || undefined,
                  dateTo: dateTo || undefined,
                })
              }
            />
            <button className="btn-primary" onClick={() => setRequestOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New visit request
            </button>
          </div>
        }
      />

      {/* Live summary */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={Users}
          label="Currently inside"
          value={summary?.currentlyInside ?? 0}
          tone="green"
        />
        <SummaryCard
          icon={Clock}
          label="Pending requests"
          value={summary?.pendingRequests ?? 0}
          tone="amber"
        />
        <SummaryCard
          icon={CalendarDays}
          label="Scheduled today"
          value={summary?.scheduledToday ?? 0}
          tone="blue"
        />
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search visitor, host, pass #…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-sm"
          />
        </div>
        <Select
          className="!w-40"
          value={status}
          onChange={(e) => setStatus(e.target.value as VisitStatus | '')}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          title="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          title="To date"
        />
      </div>

      <DataTable<Visit>
        rows={visits}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No visits found."
        columns={[
          {
            key: 'visitor',
            header: 'Visitor',
            render: (v) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">
                  {v.visitor?.name ?? '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {[v.visitor?.relation, v.visitor?.mobile]
                    .filter(Boolean)
                    .join(' · ')}
                  {v.partySize > 1 ? ` · party of ${v.partySize}` : ''}
                </div>
              </div>
            ),
          },
          {
            key: 'student',
            header: 'Visiting student',
            render: (v) => (
              <div className="leading-tight">
                <div className="text-sm text-slate-900">
                  {v.student
                    ? v.student.studentName
                    : '—'}
                </div>
                <div className="text-xs text-slate-500">
                  {v.purpose}
                  {v.meetingWith ? ` · meet ${v.meetingWith}` : ''}
                </div>
              </div>
            ),
          },
          {
            key: 'scheduled',
            header: 'Scheduled',
            render: (v) => (
              <span className="text-sm">
                {String(v.scheduledDate).slice(0, 10)}
                {v.scheduledTime ? ` ${v.scheduledTime.slice(0, 5)}` : ''}
              </span>
            ),
          },
          {
            key: 'inout',
            header: 'In → Out',
            render: (v) => (
              <span className="text-xs text-slate-600">
                {fmtTime(v.checkInAt)} → {fmtTime(v.checkOutAt)}
              </span>
            ),
          },
          {
            key: 'duration',
            header: 'Spent',
            render: (v) => fmtDuration(v.durationMinutes),
          },
          {
            key: 'status',
            header: 'Status',
            render: (v) => (
              <Badge tone={STATUS_TONE[v.status]}>{STATUS_LABEL[v.status]}</Badge>
            ),
          },
        ]}
        actions={(v) => (
          <div className="flex items-center gap-0.5">
            {v.status === 'requested' && (
              <IconBtn
                title="Approve"
                tone="green"
                onClick={() => act.mutate(() => VisitsApi.approve(v.id))}
              >
                <Check className="h-4 w-4" />
              </IconBtn>
            )}
            {v.status === 'requested' && (
              <IconBtn
                title="Reject"
                tone="red"
                onClick={() => setReject({ open: true, visit: v })}
              >
                <X className="h-4 w-4" />
              </IconBtn>
            )}
            {(v.status === 'requested' || v.status === 'approved') && (
              <IconBtn
                title="Check in (entry)"
                tone="brand"
                onClick={() => setCheckIn({ open: true, visit: v })}
              >
                <LogIn className="h-4 w-4" />
              </IconBtn>
            )}
            {v.status === 'checked_in' && (
              <IconBtn
                title="Check out (exit)"
                tone="brand"
                onClick={() => act.mutate(() => VisitsApi.checkOut(v.id, {}))}
              >
                <LogOut className="h-4 w-4" />
              </IconBtn>
            )}
            {(v.status === 'requested' || v.status === 'approved') && (
              <IconBtn
                title="Cancel"
                tone="slate"
                onClick={() => act.mutate(() => VisitsApi.cancel(v.id))}
              >
                <CircleSlash className="h-4 w-4" />
              </IconBtn>
            )}
          </div>
        )}
      />

      {pageData && (
        <Pagination
          page={pageData.page}
          totalPages={pageData.totalPages}
          total={pageData.total}
          limit={pageData.limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}

      <RequestModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        onCreated={() => {
          refresh();
          setRequestOpen(false);
        }}
      />

      <CheckInModal
        open={checkIn.open}
        visit={checkIn.visit}
        onClose={() => setCheckIn({ open: false })}
        onDone={() => {
          refresh();
          setCheckIn({ open: false });
        }}
      />

      <RejectModal
        open={reject.open}
        visit={reject.visit}
        onClose={() => setReject({ open: false })}
        onDone={() => {
          refresh();
          setReject({ open: false });
        }}
      />
    </>
  );
}

// ── Request modal ────────────────────────────────────────────────────────────
const requestSchema = z.object({
  visitorId: z.string().uuid('Select a visitor'),
  meetingWith: z.string().optional().or(z.literal('')),
  purpose: z.string().min(1, 'Required'),
  reason: z.string().optional().or(z.literal('')),
  partySize: z.coerce.number().min(1),
  vehicleNumber: z.string().optional().or(z.literal('')),
  scheduledDate: z.string().min(1, 'Required'),
  scheduledTime: z.string().optional().or(z.literal('')),
});
type RequestForm = z.infer<typeof requestSchema>;

function RequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [visitorSearch, setVisitorSearch] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const { data: visitors = [] } = useQuery({
    queryKey: ['visitors', 'lookup', visitorSearch],
    queryFn: () => VisitorsApi.lookup({ search: visitorSearch || undefined }),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<RequestForm>({
    resolver: zodResolver(requestSchema),
    values: {
      visitorId: '',
      meetingWith: '',
      purpose: '',
      reason: '',
      partySize: 1,
      vehicleNumber: '',
      scheduledDate: today,
      scheduledTime: '',
    },
  });

  const create = useMutation({
    mutationFn: (v: RequestForm) =>
      VisitsApi.create({
        visitorId: v.visitorId,
        meetingWith: v.meetingWith || undefined,
        purpose: v.purpose,
        reason: v.reason || undefined,
        partySize: v.partySize,
        vehicleNumber: v.vehicleNumber || undefined,
        scheduledDate: v.scheduledDate,
        scheduledTime: v.scheduledTime || undefined,
      }),
    onSuccess: () => {
      reset();
      onCreated();
    },
    onError: (e: any) =>
      setErr(e?.response?.data?.error?.message ?? 'Could not create request'),
  });

  const selectedVisitor = visitors.find((v) => v.id === watch('visitorId'));

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="New visit request"
      description="Pick a registered visitor and the details of their planned visit."
      size="xl"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit((v) => {
              setErr(null);
              create.mutate(v);
            })}
            disabled={create.isPending}
          >
            {create.isPending ? 'Saving…' : 'Create request'}
          </button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label="Visitor"
          required
          error={errors.visitorId?.message}
          className="sm:col-span-3"
        >
          <input
            type="search"
            placeholder="Search visitors by name or mobile…"
            value={visitorSearch}
            onChange={(e) => setVisitorSearch(e.target.value)}
            className="mb-1.5 w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
          />
          <Select {...register('visitorId')}>
            <option value="">— Select a registered visitor —</option>
            {visitors.map((v) => (
              <option key={v.id} value={v.id} disabled={v.isBlacklisted}>
                {v.name} · {v.mobile}
                {v.student
                  ? ` → ${v.student.studentName}`
                  : ''}
                {v.isBlacklisted ? ' (blacklisted)' : ''}
              </option>
            ))}
          </Select>
          {selectedVisitor?.student && (
            <p className="mt-1 text-xs text-slate-500">
              Visiting{' '}
              <span className="font-medium text-slate-700">
                {selectedVisitor.student.studentName}
              </span>{' '}
              ({selectedVisitor.student.admissionNumber})
            </p>
          )}
        </Field>

        <Field label="Purpose" required error={errors.purpose?.message}>
          <Input {...register('purpose')} placeholder="Meet ward, drop belongings…" />
        </Field>
        <Field label="Also meeting (optional)" className="sm:col-span-2">
          <Input
            {...register('meetingWith')}
            placeholder="Class teacher, warden…"
          />
        </Field>

        <Field label="Scheduled date" required error={errors.scheduledDate?.message}>
          <Input type="date" {...register('scheduledDate')} />
        </Field>
        <Field label="Scheduled time">
          <Input type="time" {...register('scheduledTime')} />
        </Field>
        <Field label="Party size">
          <Input type="number" min={1} {...register('partySize')} />
        </Field>

        <Field label="Vehicle number">
          <Input {...register('vehicleNumber')} />
        </Field>
        <Field label="Reason / details" className="sm:col-span-2">
          <Input {...register('reason')} />
        </Field>

        {err && (
          <div className="sm:col-span-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ── Check-in modal ───────────────────────────────────────────────────────────
function CheckInModal({
  open,
  visit,
  onClose,
  onDone,
}: {
  open: boolean;
  visit?: Visit;
  onClose: () => void;
  onDone: () => void;
}) {
  const [passNumber, setPassNumber] = useState('');
  const [belongings, setBelongings] = useState('');
  useEffect(() => {
    if (open) {
      setPassNumber('');
      setBelongings('');
    }
  }, [open]);

  const checkIn = useMutation({
    mutationFn: () =>
      VisitsApi.checkIn(visit!.id, {
        passNumber: passNumber || undefined,
        belongings: belongings || undefined,
      }),
    onSuccess: onDone,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Check in — ${visit?.visitor?.name ?? 'visitor'}`}
      description="Records the actual entry time now and issues a gate pass."
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => checkIn.mutate()}
            disabled={checkIn.isPending}
          >
            <LogIn className="mr-1.5 h-4 w-4" />
            {checkIn.isPending ? 'Checking in…' : 'Check in'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Gate pass number">
          <Input
            value={passNumber}
            onChange={(e) => setPassNumber(e.target.value)}
            placeholder="V-001"
          />
        </Field>
        <Field label="Belongings carried in">
          <Textarea
            rows={2}
            value={belongings}
            onChange={(e) => setBelongings(e.target.value)}
            placeholder="Laptop bag, documents…"
          />
        </Field>
      </div>
    </Modal>
  );
}

// ── Reject modal ─────────────────────────────────────────────────────────────
function RejectModal({
  open,
  visit,
  onClose,
  onDone,
}: {
  open: boolean;
  visit?: Visit;
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const reject = useMutation({
    mutationFn: () => VisitsApi.reject(visit!.id, reason || undefined),
    onSuccess: onDone,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Reject request — ${visit?.visitor?.name ?? ''}`}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => reject.mutate()}
            disabled={reject.isPending}
          >
            {reject.isPending ? 'Rejecting…' : 'Reject'}
          </button>
        </>
      }
    >
      <Field label="Reason (optional)">
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Host unavailable…"
        />
      </Field>
    </Modal>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tone: 'green' | 'amber' | 'blue';
}) {
  const toneCls = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
  }[tone];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className={`rounded-md p-2 ${toneCls}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-900">{value}</div>
        <div className="text-xs text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function IconBtn({
  title,
  tone,
  onClick,
  children,
}: {
  title: string;
  tone: 'green' | 'red' | 'brand' | 'slate';
  onClick: () => void;
  children: React.ReactNode;
}) {
  const hover = {
    green: 'hover:bg-green-50 hover:text-green-700',
    red: 'hover:bg-red-50 hover:text-red-600',
    brand: 'hover:bg-slate-100 hover:text-brand-600',
    slate: 'hover:bg-slate-100 hover:text-slate-700',
  }[tone];
  return (
    <button
      className={`rounded-md p-1.5 text-slate-500 ${hover}`}
      onClick={onClick}
      title={title}
    >
      {children}
    </button>
  );
}
