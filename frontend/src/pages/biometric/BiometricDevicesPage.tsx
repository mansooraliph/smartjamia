import { useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  RefreshCw,
  RotateCw,
  Trash2,
  Pencil,
  Eraser,
  Wifi,
  WifiOff,
  Lock,
} from 'lucide-react';
import {
  BiometricApi,
  BiometricDevice,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input } from '@/components/ui/Input';

type Tab = 'devices' | 'transactions' | 'enrollments';

function fmt(dt?: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function BiometricDevicesPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('devices');

  const stats = useQuery({
    queryKey: ['bio-stats'],
    queryFn: BiometricApi.stats,
    retry: false,
  });

  // The premium guard returns 403; surface an upgrade prompt instead of errors.
  const forbidden =
    (stats.error as any)?.response?.status === 403 ||
    /premium/i.test((stats.error as any)?.response?.data?.error?.message ?? '');

  if (forbidden) {
    return (
      <>
        <PageHeader
          title="Biometric Devices"
          description="Fingerprint / face attendance terminals."
        />
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="h-8 w-8 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-900">
            A premium feature
          </h3>
          <p className="max-w-md text-sm text-slate-500">
            Biometric device integration is available on the Professional and
            Enterprise plans. Upgrade your plan to connect ZKTeco / ESSL
            terminals and sync attendance automatically.
          </p>
          <a href="/billing" className="btn-primary mt-2">
            View plans
          </a>
        </div>
      </>
    );
  }

  const s = stats.data;
  const cards = [
    { label: 'Devices', value: s?.total_devices ?? '—' },
    { label: 'Online', value: s?.online_devices ?? '—' },
    { label: "Today's punches", value: s?.total_transactions_today ?? '—' },
    { label: 'Enrolled users', value: s?.enrolled_users ?? '—' },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: 'devices', label: 'Devices' },
    { key: 'transactions', label: 'Attendance log' },
    { key: 'enrollments', label: 'Enrollments' },
  ];

  return (
    <>
      <PageHeader
        title="Biometric Devices"
        description="ZKTeco / ESSL fingerprint & face terminals — live attendance."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {c.label}
            </div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'devices' && <DevicesTab onChanged={() => qc.invalidateQueries({ queryKey: ['bio-stats'] })} />}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'enrollments' && <EnrollmentsTab />}
    </>
  );
}

/* ── Devices ───────────────────────────────────────────────────────────────── */
function DevicesTab({ onChanged }: { onChanged: () => void }) {
  const qc = useQueryClient();
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['bio-devices'],
    queryFn: BiometricApi.listDevices,
  });
  const [rename, setRename] = useState<{ open: boolean; device?: BiometricDevice }>({ open: false });
  const [confirm, setConfirm] = useState<{
    open: boolean;
    device?: BiometricDevice;
    action?: 'restart' | 'clear';
  }>({ open: false });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['bio-devices'] });
    onChanged();
  };

  const syncUsers = useMutation({
    mutationFn: (id: string) => BiometricApi.syncUsers(id),
  });
  const act = useMutation({
    mutationFn: (v: { id: string; action: 'restart' | 'clear' }) =>
      v.action === 'restart'
        ? BiometricApi.restart(v.id)
        : BiometricApi.clearData(v.id),
    onSuccess: () => setConfirm({ open: false }),
  });

  return (
    <>
      <DataTable<BiometricDevice>
        rows={devices}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No devices assigned to your school yet. Contact support to register a terminal."
        columns={[
          {
            key: 'sn',
            header: 'Device',
            render: (d) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">
                  {d.alias || d.sn}
                </div>
                <code className="text-xs text-slate-500">{d.sn}</code>
              </div>
            ),
          },
          {
            key: 'state',
            header: 'Status',
            render: (d) =>
              d.deactivatedAt ? (
                <Badge tone="red">Deactivated</Badge>
              ) : !d.isApproved ? (
                <Badge tone="amber">Pending approval</Badge>
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
            key: 'counts',
            header: 'Users / FP / Face',
            render: (d) =>
              `${d.userCount ?? 0} / ${d.fpCount ?? 0} / ${d.faceCount ?? 0}`,
          },
          { key: 'ip', header: 'IP', render: (d) => d.ipAddress ?? '—' },
          {
            key: 'lastSync',
            header: 'Last seen',
            render: (d) => fmt(d.lastActivity ?? d.lastSyncAt),
          },
        ]}
        actions={(d) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600 disabled:opacity-40"
              onClick={() => syncUsers.mutate(d.id)}
              disabled={syncUsers.isPending}
              title="Push all students & staff to this device"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setRename({ open: true, device: d })}
              title="Rename"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => setConfirm({ open: true, device: d, action: 'restart' })}
              title="Restart device"
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, device: d, action: 'clear' })}
              title="Clear attendance logs on device"
            >
              <Eraser className="h-4 w-4" />
            </button>
          </>
        )}
      />

      {syncUsers.isSuccess && (
        <p className="mt-2 text-sm text-green-700">
          Queued user sync — the device will pull them on its next check-in.
        </p>
      )}

      {rename.open && rename.device && (
        <RenameModal
          device={rename.device}
          onClose={() => setRename({ open: false })}
          onSaved={() => {
            refresh();
            setRename({ open: false });
          }}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() =>
          confirm.device &&
          confirm.action &&
          act.mutate({ id: confirm.device.id, action: confirm.action })
        }
        loading={act.isPending}
        title={confirm.action === 'clear' ? 'Clear device logs?' : 'Restart device?'}
        message={
          confirm.action === 'clear'
            ? 'Queues a command to delete attendance logs stored on the device (enrolled users are kept). Punches already synced here are not affected.'
            : 'Queues a reboot command. The device reboots on its next check-in.'
        }
        confirmText={confirm.action === 'clear' ? 'Clear logs' : 'Restart'}
      />
    </>
  );
}

function RenameModal({
  device,
  onClose,
  onSaved,
}: {
  device: BiometricDevice;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [alias, setAlias] = useState(device.alias ?? '');
  const save = useMutation({
    mutationFn: () => BiometricApi.rename(device.id, alias),
    onSuccess: onSaved,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Rename device"
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <Field label="Display name" hint={`Serial: ${device.sn}`}>
        <Input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Main gate" />
      </Field>
    </Modal>
  );
}

/* ── Transactions ──────────────────────────────────────────────────────────── */
function TransactionsTab() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['bio-tx', page],
    queryFn: () => BiometricApi.transactions({ page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items ?? [];
  const del = useMutation({
    mutationFn: (id: string) => BiometricApi.deleteTransaction(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bio-tx'] }),
  });

  return (
    <>
      <DataTable
        rows={rows}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No attendance punches recorded yet."
        columns={[
          { key: 'user', header: 'User code', render: (t) => <code className="text-xs">{t.userCode}</code> },
          {
            key: 'who',
            header: 'Resolved',
            render: (t) =>
              t.studentId ? (
                <Badge tone="blue">Student</Badge>
              ) : t.staffId ? (
                <Badge tone="purple">Staff</Badge>
              ) : (
                <span className="text-slate-400">Unmatched</span>
              ),
          },
          { key: 'time', header: 'Punch time', render: (t) => fmt(t.punchTime) },
          {
            key: 'state',
            header: 'Direction',
            render: (t) => (
              <Badge tone={t.punchState === 1 ? 'amber' : 'green'}>
                {t.punchStateDisplay}
              </Badge>
            ),
          },
          { key: 'sn', header: 'Device', render: (t) => <code className="text-xs">{t.deviceSn}</code> },
        ]}
        actions={(t) => (
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => del.mutate(t.id)}
            title="Delete punch"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      />
      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        limit={data?.limit ?? 20}
        onPageChange={setPage}
      />
    </>
  );
}

/* ── Enrollments ───────────────────────────────────────────────────────────── */
function EnrollmentsTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['bio-enroll', page],
    queryFn: () => BiometricApi.enrollments({ page, limit: 20 }),
    placeholderData: keepPreviousData,
  });
  const rows = data?.items ?? [];
  return (
    <>
      <DataTable
        rows={rows}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No biometric templates enrolled yet."
        columns={[
          { key: 'user', header: 'User code', render: (e) => <code className="text-xs">{e.userCode}</code> },
          {
            key: 'type',
            header: 'Type',
            render: (e) => <Badge tone="slate">{e.type}</Badge>,
          },
          {
            key: 'who',
            header: 'Resolved',
            render: (e) =>
              e.studentId ? (
                <Badge tone="blue">Student</Badge>
              ) : e.staffId ? (
                <Badge tone="purple">Staff</Badge>
              ) : (
                <span className="text-slate-400">Unmatched</span>
              ),
          },
          { key: 'index', header: 'Index', render: (e) => e.index },
          { key: 'sn', header: 'Device', render: (e) => <code className="text-xs">{e.deviceSn ?? '—'}</code> },
          { key: 'at', header: 'Enrolled', render: (e) => fmt(e.createdAt) },
        ]}
      />
      <Pagination
        page={data?.page ?? 1}
        totalPages={data?.totalPages ?? 1}
        total={data?.total ?? 0}
        limit={data?.limit ?? 20}
        onPageChange={setPage}
      />
    </>
  );
}
