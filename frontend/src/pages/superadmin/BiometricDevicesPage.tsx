import { useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  Search,
  CheckCircle2,
  Link2,
  Unlink,
  Ban,
  RotateCw,
  RefreshCw,
  Trash2,
  Terminal,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  BiometricDevice,
  BiometricDevicesApi,
  ListDevicesParams,
  SchoolsApi,
} from '@/services/superadmin.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

type Filter = 'all' | 'unassigned' | 'pending' | 'assigned';

function fmt(dt?: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

const FILTERS: { key: Filter; label: string; params: ListDevicesParams }[] = [
  { key: 'all', label: 'All', params: {} },
  { key: 'unassigned', label: 'Unassigned', params: { isAssigned: false } },
  { key: 'pending', label: 'Pending approval', params: { isApproved: false } },
  { key: 'assigned', label: 'Assigned', params: { isAssigned: true } },
];

export function BiometricDevicesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [assign, setAssign] = useState<{ open: boolean; device?: BiometricDevice }>({ open: false });
  const [deactivate, setDeactivate] = useState<{ open: boolean; device?: BiometricDevice }>({ open: false });
  const [commands, setCommands] = useState<{ open: boolean; device?: BiometricDevice }>({ open: false });
  const [confirm, setConfirm] = useState<{
    open: boolean;
    device?: BiometricDevice;
    action?: 'approve' | 'unassign' | 'reactivate' | 'restart' | 'sync' | 'delete';
  }>({ open: false });

  const params: ListDevicesParams = {
    page,
    limit: 20,
    search: search || undefined,
    ...FILTERS.find((f) => f.key === filter)!.params,
  };
  const { data, isLoading } = useQuery({
    queryKey: ['sa-bio', filter, search, page],
    queryFn: () => BiometricDevicesApi.list(params),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['sa-bio'] });

  const simple = useMutation({
    mutationFn: (v: { device: BiometricDevice; action: string }): Promise<unknown> => {
      const id = v.device.id;
      switch (v.action) {
        case 'approve':
          return BiometricDevicesApi.approve(id);
        case 'unassign':
          return BiometricDevicesApi.unassign(id);
        case 'reactivate':
          return BiometricDevicesApi.reactivate(id);
        case 'restart':
          return BiometricDevicesApi.restart(id);
        case 'sync':
          return BiometricDevicesApi.sync(id);
        case 'delete':
          return BiometricDevicesApi.remove(id);
        default:
          return Promise.resolve();
      }
    },
    onSuccess: () => {
      invalidate();
      setConfirm({ open: false });
    },
  });

  return (
    <>
      <PageHeader
        title="Biometric Devices"
        description="All registered terminals across schools. Approve, assign and manage devices."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search by serial or name"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition',
                filter === f.key
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <DataTable<BiometricDevice>
        rows={rows}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No devices. Terminals appear here automatically the first time they contact the server."
        columns={[
          {
            key: 'sn',
            header: 'Device',
            render: (d) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">{d.alias || d.sn}</div>
                <code className="text-xs text-slate-500">{d.sn}</code>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (d) =>
              d.deactivatedAt ? (
                <Badge tone="red">Deactivated</Badge>
              ) : !d.isApproved ? (
                <Badge tone="amber">Pending</Badge>
              ) : d.state === '1' ? (
                <Badge tone="green">
                  <Wifi className="-ml-0.5 mr-1 h-3 w-3" /> Online
                </Badge>
              ) : (
                <Badge tone="slate">
                  <WifiOff className="-ml-0.5 mr-1 h-3 w-3" /> Offline
                </Badge>
              ),
          },
          {
            key: 'school',
            header: 'School',
            render: (d) =>
              d.school ? (
                <span className="text-sm">{d.school.name}</span>
              ) : (
                <span className="text-slate-400">Unassigned</span>
              ),
          },
          {
            key: 'counts',
            header: 'Users / FP / Face',
            render: (d) => `${d.userCount ?? 0} / ${d.fpCount ?? 0} / ${d.faceCount ?? 0}`,
          },
          { key: 'seen', header: 'Last seen', render: (d) => fmt(d.lastActivity ?? d.lastSyncAt) },
        ]}
        actions={(d) => (
          <>
            {!d.isApproved && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-green-50 hover:text-green-700"
                onClick={() => setConfirm({ open: true, device: d, action: 'approve' })}
                title="Approve"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            {d.schoolId ? (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-700"
                onClick={() => setConfirm({ open: true, device: d, action: 'unassign' })}
                title="Unassign from school"
              >
                <Unlink className="h-4 w-4" />
              </button>
            ) : (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-700"
                onClick={() => setAssign({ open: true, device: d })}
                title="Assign to school"
              >
                <Link2 className="h-4 w-4" />
              </button>
            )}
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setConfirm({ open: true, device: d, action: 'sync' })}
              title="Sync info"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => setConfirm({ open: true, device: d, action: 'restart' })}
              title="Restart"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              onClick={() => setCommands({ open: true, device: d })}
              title="Command log"
            >
              <Terminal className="h-4 w-4" />
            </button>
            {d.deactivatedAt ? (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-green-50 hover:text-green-700"
                onClick={() => setConfirm({ open: true, device: d, action: 'reactivate' })}
                title="Reactivate"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            ) : (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => setDeactivate({ open: true, device: d })}
                title="Deactivate"
              >
                <Ban className="h-4 w-4" />
              </button>
            )}
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, device: d, action: 'delete' })}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />
      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        limit={data?.limit ?? 20}
        onPageChange={setPage}
      />

      {assign.open && assign.device && (
        <AssignModal
          device={assign.device}
          onClose={() => setAssign({ open: false })}
          onSaved={() => {
            invalidate();
            setAssign({ open: false });
          }}
        />
      )}

      {deactivate.open && deactivate.device && (
        <DeactivateModal
          device={deactivate.device}
          onClose={() => setDeactivate({ open: false })}
          onSaved={() => {
            invalidate();
            setDeactivate({ open: false });
          }}
        />
      )}

      {commands.open && commands.device && (
        <CommandsModal
          device={commands.device}
          onClose={() => setCommands({ open: false })}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() =>
          confirm.device &&
          confirm.action &&
          simple.mutate({ device: confirm.device, action: confirm.action })
        }
        loading={simple.isPending}
        title={CONFIRM_COPY[confirm.action ?? 'approve']?.title ?? 'Confirm'}
        message={CONFIRM_COPY[confirm.action ?? 'approve']?.message ?? ''}
        confirmText={CONFIRM_COPY[confirm.action ?? 'approve']?.confirm ?? 'Confirm'}
      />
    </>
  );
}

const CONFIRM_COPY: Record<string, { title: string; message: string; confirm: string }> = {
  approve: { title: 'Approve device?', message: 'Approved devices can receive commands and sync data.', confirm: 'Approve' },
  unassign: { title: 'Unassign device?', message: 'Removes the school assignment. The device stays registered but stops syncing to that school.', confirm: 'Unassign' },
  reactivate: { title: 'Reactivate device?', message: 'Clears the deactivation and restores normal operation.', confirm: 'Reactivate' },
  restart: { title: 'Restart device?', message: 'Queues a reboot command; the device reboots on its next check-in.', confirm: 'Restart' },
  sync: { title: 'Sync device info?', message: 'Queues an INFO command so the device reports its latest stats.', confirm: 'Sync' },
  delete: { title: 'Delete device?', message: 'Soft-deletes the device record. It will re-register if it contacts the server again.', confirm: 'Delete' },
};

function AssignModal({
  device,
  onClose,
  onSaved,
}: {
  device: BiometricDevice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: schools = [] } = useQuery({
    queryKey: ['sa-schools'],
    queryFn: SchoolsApi.list,
  });
  const [schoolId, setSchoolId] = useState('');
  const save = useMutation({
    mutationFn: () => BiometricDevicesApi.assign(device.id, schoolId),
    onSuccess: onSaved,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Assign ${device.alias || device.sn}`}
      description="The school's plan must include the biometric feature."
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={!schoolId || save.isPending}
          >
            {save.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </>
      }
    >
      <Field label="School" required>
        <Select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="">— Select a school —</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.plan?.name ?? 'no plan'})
            </option>
          ))}
        </Select>
      </Field>
      {save.error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errMsg(save.error)}
        </div>
      )}
    </Modal>
  );
}

function DeactivateModal({
  device,
  onClose,
  onSaved,
}: {
  device: BiometricDevice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [reason, setReason] = useState('');
  const save = useMutation({
    mutationFn: () => BiometricDevicesApi.deactivate(device.id, reason),
    onSuccess: onSaved,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={`Deactivate ${device.alias || device.sn}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={!reason.trim() || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Deactivate'}
          </button>
        </>
      }
    >
      <Field label="Reason" required>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this device being deactivated?"
        />
      </Field>
    </Modal>
  );
}

function CommandsModal({
  device,
  onClose,
}: {
  device: BiometricDevice;
  onClose: () => void;
}) {
  const { data: cmds = [], isLoading } = useQuery({
    queryKey: ['sa-bio-cmds', device.id],
    queryFn: () => BiometricDevicesApi.deviceCommands(device.id),
  });
  const statusBadge = (s: number) =>
    s === 1 ? (
      <Badge tone="green">Success</Badge>
    ) : s === 2 ? (
      <Badge tone="red">Error</Badge>
    ) : (
      <Badge tone="amber">Pending</Badge>
    );
  return (
    <Modal open onClose={onClose} title={`Commands — ${device.alias || device.sn}`} size="lg">
      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : cmds.length === 0 ? (
        <p className="text-sm text-slate-400">No commands yet.</p>
      ) : (
        <div className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
          {cmds.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 py-2">
              <code className="truncate text-xs text-slate-700">{c.command}</code>
              <div className="flex shrink-0 items-center gap-2">
                {statusBadge(c.status)}
                <span className="text-xs text-slate-400">{fmt(c.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function errMsg(e: unknown): string | undefined {
  if (!e) return undefined;
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}
