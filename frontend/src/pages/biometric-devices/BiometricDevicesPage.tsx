import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Radio, UserPlus, Settings, FileClock } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { toast } from '@/stores/toast.store';
import { useBiometricDevicesStore } from '@/stores/biometric-devices.store';
import {
  BiometricDevicesApi,
  BiometricDeviceDto,
  BulkActionResult,
  deriveStats,
} from '@/services/biometric-devices.api';
import { DeviceCard, DeviceAction } from './DeviceCard';
import { BulkActionBar, BulkAction } from './BulkActionBar';
import { DeviceDetailDrawer } from './DeviceDetailDrawer';
import { SetDuplicatePunchModal } from './modals/SetDuplicatePunchModal';
import { EnrollUserModal } from './modals/EnrollUserModal';
import { ConfirmActionModal } from './modals/ConfirmActionModal';
import { DeviceSettingsModal } from './modals/DeviceSettingsModal';
import { RunCommandModal } from './modals/RunCommandModal';

type ConfirmState =
  | { kind: 'restart'; device: BiometricDeviceDto }
  | { kind: 'clear'; device: BiometricDeviceDto }
  | { kind: 'clear-commands'; device: BiometricDeviceDto }
  | { kind: 'bulk-restart' }
  | null;

type PunchState = { deviceIds: string[]; names: string[] } | null;

export function BiometricDevicesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const {
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    drawerDeviceId,
    openDrawer,
  } = useBiometricDevicesStore();

  // Premium guard returns 403 — detect it via the stats probe.
  const probe = useQuery({
    queryKey: ['bio-stats-probe'],
    queryFn: BiometricDevicesApi.stats,
    retry: false,
  });
  const forbidden =
    (probe.error as any)?.response?.status === 403 ||
    /premium/i.test((probe.error as any)?.response?.data?.error?.message ?? '');

  const devicesQuery = useQuery({
    queryKey: ['bio-devices'],
    queryFn: BiometricDevicesApi.listDevices,
    enabled: !forbidden,
    // Keep online/offline + last-seen fresh (devices flip offline after ~40s).
    refetchInterval: 20000,
  });
  const devices = devicesQuery.data ?? [];
  const stats = useMemo(() => deriveStats(devices), [devices]);

  // Modal / dialog state
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [punch, setPunch] = useState<PunchState>(null);
  const [enroll, setEnroll] = useState<{ presetDeviceIds?: string[] } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runCmdDevice, setRunCmdDevice] = useState<BiometricDeviceDto | null>(null);
  const [renameDevice, setRenameDevice] = useState<BiometricDeviceDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refetchDevices = () => qc.invalidateQueries({ queryKey: ['bio-devices'] });

  // ── Single immediate actions (no refetch for command-style actions) ─────────
  const runImmediate = async (
    device: BiometricDeviceDto,
    fn: () => Promise<unknown>,
    successMsg: string,
  ) => {
    setBusyId(device.id);
    try {
      await fn();
      toast.success(successMsg);
    } catch (e: any) {
      toast.error(e?.response?.data?.error?.message ?? 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleCardAction = (action: DeviceAction, device: BiometricDeviceDto) => {
    const name = device.alias || device.sn;
    switch (action) {
      case 'restart':
        setConfirm({ kind: 'restart', device });
        break;
      case 'info':
        runImmediate(
          device,
          () => BiometricDevicesApi.readDeviceInfo(device.id),
          `Info request sent to ${name}`,
        );
        break;
      case 'punch-gap':
        setPunch({ deviceIds: [device.id], names: [name] });
        break;
      case 'enroll':
        setEnroll({ presetDeviceIds: [device.id] });
        break;
      case 'transactions':
        openDrawer(device.id, 'transactions');
        break;
      case 'commands':
        openDrawer(device.id, 'commands');
        break;
      case 'rename':
        setRenameDevice(device);
        break;
      case 'sync-users':
        runImmediate(
          device,
          () => BiometricDevicesApi.syncUsers(device.id),
          `Queued user sync to ${name}`,
        );
        break;
      case 'clear':
        setConfirm({ kind: 'clear', device });
        break;
      case 'clear-commands':
        setConfirm({ kind: 'clear-commands', device });
        break;
      case 'run-command':
        setRunCmdDevice(device);
        break;
    }
  };

  // ── Confirm dialog actions ──────────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!confirm) return;
      if (confirm.kind === 'restart') {
        return BiometricDevicesApi.restartDevice(confirm.device.id);
      }
      if (confirm.kind === 'clear') {
        return BiometricDevicesApi.clearData(confirm.device.id);
      }
      if (confirm.kind === 'clear-commands') {
        return BiometricDevicesApi.clearCommands(confirm.device.id);
      }
      if (confirm.kind === 'bulk-restart') {
        return BiometricDevicesApi.bulkRestart([...selectedIds]);
      }
    },
    onSuccess: (res) => {
      if (!confirm) return;
      if (confirm.kind === 'bulk-restart') {
        reportBulk(res as BulkActionResult, 'Restart command sent');
        clearSelection();
      } else if (confirm.kind === 'clear-commands') {
        const n = (res as { cleared: number })?.cleared ?? 0;
        toast.success(`Cleared ${n} pending command(s)`);
      } else {
        const name = confirm.device.alias || confirm.device.sn;
        toast.success(
          confirm.kind === 'restart'
            ? `Restart command sent to ${name}`
            : `Clear-logs command sent to ${name}`,
        );
      }
      setConfirm(null);
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.error?.message ?? 'Action failed');
      setConfirm(null);
    },
  });

  // ── Bulk bar actions ────────────────────────────────────────────────────────
  const reportBulk = (res: BulkActionResult, verb: string) => {
    if (res.failed_count > 0) {
      toast.warning(
        `${verb} to ${res.success_count} device(s). Failed: ${res.failed_devices.join(', ')}`,
      );
    } else {
      toast.success(`${verb} to ${res.success_count} device(s)`);
    }
  };

  const bulkBusy = confirmMutation.isPending;
  const handleBulk = async (action: BulkAction) => {
    const ids = [...selectedIds];
    if (action === 'restart') {
      setConfirm({ kind: 'bulk-restart' });
      return;
    }
    if (action === 'read-info') {
      try {
        const res = await BiometricDevicesApi.bulkReadInfo(ids);
        reportBulk(res, 'Info request sent');
        clearSelection();
      } catch (e: any) {
        toast.error(e?.response?.data?.error?.message ?? 'Bulk action failed');
      }
      return;
    }
    if (action === 'punch-gap') {
      const names = devices
        .filter((d) => selectedIds.has(d.id))
        .map((d) => d.alias || d.sn);
      setPunch({ deviceIds: ids, names });
    }
  };

  // ── Premium gate ────────────────────────────────────────────────────────────
  if (forbidden) {
    return (
      <>
        <PageHeader
          title="Biometric Devices"
          description="Fingerprint / face attendance terminals."
        />
        <div className="card flex flex-col items-center gap-3 p-10 text-center">
          <Lock className="h-8 w-8 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-900">A premium feature</h3>
          <p className="max-w-md text-sm text-slate-500">
            Biometric device integration is available on the Professional and
            Enterprise plans. Upgrade to connect ZKTeco / ESSL terminals.
          </p>
          <a href="/billing" className="btn-primary mt-2">
            View plans
          </a>
        </div>
      </>
    );
  }

  const cards = [
    { label: 'Total Devices', value: stats.total },
    { label: 'Online', value: stats.online },
    { label: 'Offline', value: stats.offline },
    { label: 'Unsynced', value: stats.unsynced },
  ];

  const drawerDevice = devices.find((d) => d.id === drawerDeviceId) ?? null;

  return (
    <>
      <PageHeader
        title="Biometric Devices"
        description="Manage and monitor your biometric terminals."
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => navigate('/biometric-devices/transactions')}
              title="Transaction report"
            >
              <FileClock className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Transactions</span>
            </button>
            <button
              className="btn-secondary"
              onClick={() => setSettingsOpen(true)}
              title="Device settings"
            >
              <Settings className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            {devices.length > 0 && (
              <button className="btn-primary" onClick={() => setEnroll({})}>
                <UserPlus className="mr-1.5 h-4 w-4" /> Enroll User
              </button>
            )}
          </>
        }
      />

      {/* Stats row */}
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

      {/* Devices grid / states */}
      {devicesQuery.isLoading ? (
        <p className="text-sm text-slate-400">Loading devices…</p>
      ) : devices.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-12 text-center">
          <Radio className="h-9 w-9 text-slate-300" />
          <h3 className="text-base font-semibold text-slate-900">
            No biometric devices yet
          </h3>
          <p className="max-w-sm text-sm text-slate-500">
            Devices connect automatically once configured to point to this
            system's IP. Contact your superadmin to assign a device to your
            school.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              isSelected={selectedIds.has(d.id)}
              onSelect={toggleSelect}
              onAction={handleCardAction}
              onOpen={(dev) => openDrawer(dev.id)}
              busy={busyId === d.id}
            />
          ))}
        </div>
      )}

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        totalCount={devices.length}
        onAction={handleBulk}
        onSelectAll={() => selectAll(devices.map((d) => d.id))}
        onClear={clearSelection}
        busy={bulkBusy}
      />

      {/* Detail drawer */}
      {drawerDevice && (
        <DeviceDetailDrawer device={drawerDevice} onAction={handleCardAction} />
      )}

      {/* Modals */}
      {punch && (
        <SetDuplicatePunchModal
          deviceIds={punch.deviceIds}
          deviceNames={punch.names}
          onClose={() => setPunch(null)}
          onSuccess={() => {
            refetchDevices();
            if (punch.deviceIds.length > 1) clearSelection();
          }}
        />
      )}

      {enroll && (
        <EnrollUserModal
          devices={devices}
          presetDeviceIds={enroll.presetDeviceIds}
          onClose={() => setEnroll(null)}
          onSuccess={() => undefined}
        />
      )}

      {settingsOpen && (
        <DeviceSettingsModal
          onClose={() => setSettingsOpen(false)}
          onSaved={() => undefined}
        />
      )}

      {runCmdDevice && (
        <RunCommandModal
          device={runCmdDevice}
          onClose={() => setRunCmdDevice(null)}
          onSuccess={() => undefined}
        />
      )}

      {renameDevice && (
        <RenameModal
          device={renameDevice}
          onClose={() => setRenameDevice(null)}
          onSaved={() => {
            refetchDevices();
            setRenameDevice(null);
          }}
        />
      )}

      {confirm && (
        <ConfirmActionModal
          variant={confirm.kind === 'clear' ? 'danger' : 'warning'}
          title={
            confirm.kind === 'clear'
              ? 'Clear device logs?'
              : confirm.kind === 'clear-commands'
                ? 'Clear pending commands?'
                : confirm.kind === 'bulk-restart'
                  ? `Restart ${selectedIds.size} device(s)?`
                  : 'Restart device?'
          }
          description={
            confirm.kind === 'clear'
              ? 'Queues a command to delete attendance logs stored on the device (enrolled users are kept).'
              : confirm.kind === 'clear-commands'
                ? 'Removes all queued commands not yet sent to this device. Any pending enrollment/sync for it will be cancelled.'
                : 'This will reboot the device. Any ongoing authentication will be interrupted.'
          }
          confirmLabel={
            confirm.kind === 'clear'
              ? 'Clear logs'
              : confirm.kind === 'clear-commands'
                ? 'Clear commands'
                : 'Restart'
          }
          loading={confirmMutation.isPending}
          onConfirm={() => confirmMutation.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

function RenameModal({
  device,
  onClose,
  onSaved,
}: {
  device: BiometricDeviceDto;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [alias, setAlias] = useState(device.alias ?? '');
  const save = useMutation({
    mutationFn: () => BiometricDevicesApi.rename(device.id, alias),
    onSuccess: () => {
      toast.success('Device renamed');
      onSaved();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? 'Rename failed'),
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
        <Input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="Main gate"
        />
      </Field>
    </Modal>
  );
}
