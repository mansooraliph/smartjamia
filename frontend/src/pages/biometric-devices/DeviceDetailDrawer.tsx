import { useQuery } from '@tanstack/react-query';
import {
  X,
  Copy,
  Check,
  RotateCw,
  Info,
  Clock,
  Fingerprint,
  Eraser,
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/constants/biometric';
import {
  BiometricDevicesApi,
  BiometricDeviceDto,
  isOnline,
} from '@/services/biometric-devices.api';
import { useBiometricDevicesStore, DrawerTab } from '@/stores/biometric-devices.store';
import type { DeviceAction } from './DeviceCard';

function fmt(dt?: string | null): string {
  if (!dt) return '—';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

interface Props {
  device: BiometricDeviceDto;
  onAction: (action: DeviceAction, device: BiometricDeviceDto) => void;
}

const TABS: { key: DrawerTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'commands', label: 'Commands' },
];

export function DeviceDetailDrawer({ device, onAction }: Props) {
  const { drawerTab, setDrawerTab, closeDrawer } = useBiometricDevicesStore();
  const [copied, setCopied] = useState(false);

  const copySn = () =>
    navigator.clipboard?.writeText(device.sn).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40" onClick={closeDrawer} />
      <div className="animate-slide-in-right absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-200 p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {device.alias || device.sn}
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                {device.deactivatedAt ? (
                  <Badge tone="red">Deactivated</Badge>
                ) : isOnline(device) ? (
                  <Badge tone="green">● Online</Badge>
                ) : (
                  <Badge tone="slate">○ Offline</Badge>
                )}
                <span>
                  Last seen {timeAgo(device.lastActivity ?? device.lastSyncAt)}
                </span>
              </p>
            </div>
            <button
              onClick={closeDrawer}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 flex gap-1 border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setDrawerTab(t.key)}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition',
                  drawerTab === t.key
                    ? 'border-brand-500 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {drawerTab === 'overview' && (
            <OverviewTab device={device} copied={copied} onCopy={copySn} onAction={onAction} />
          )}
          {drawerTab === 'transactions' && <TransactionsTab sn={device.sn} />}
          {drawerTab === 'commands' && <CommandsTab deviceId={device.id} />}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{children}</span>
    </div>
  );
}

function OverviewTab({
  device,
  copied,
  onCopy,
  onAction,
}: {
  device: BiometricDeviceDto;
  copied: boolean;
  onCopy: () => void;
  onAction: (action: DeviceAction, device: BiometricDeviceDto) => void;
}) {
  return (
    <>
      <div className="divide-y divide-slate-100">
        <Row label="SN">
          <button onClick={onCopy} className="flex items-center gap-1 font-mono hover:text-brand-600">
            {device.sn}
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </Row>
        <Row label="IP">{device.ipAddress ?? '—'}</Row>
        <Row label="Model">{device.deviceModel ?? '—'}</Row>
        <Row label="Firmware">{device.fwVer ?? '—'}</Row>
        <Row label="Users">{device.userCount ?? 0}</Row>
        <Row label="Fingerprints">{device.fpCount ?? 0}</Row>
        <Row label="Faces">{device.faceCount ?? 0}</Row>
        <Row label="Transactions">{device.transactionCount ?? 0}</Row>
        <Row label="Punch gap">
          {device.transferInterval != null ? `${device.transferInterval}s` : '—'}
        </Row>
        <Row label="Assigned">{fmt(device.assignedAt)}</Row>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Quick Actions
        </p>
        <div className="grid grid-cols-2 gap-2">
          <QuickBtn icon={RotateCw} label="Restart" onClick={() => onAction('restart', device)} />
          <QuickBtn icon={Info} label="Read Info" onClick={() => onAction('info', device)} />
          <QuickBtn icon={Clock} label="Punch Gap" onClick={() => onAction('punch-gap', device)} />
          <QuickBtn icon={Fingerprint} label="Enroll" onClick={() => onAction('enroll', device)} />
          <QuickBtn icon={Eraser} label="Clear Logs" onClick={() => onAction('clear', device)} />
        </div>
      </div>
    </>
  );
}

function QuickBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof RotateCw;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="btn-secondary justify-start !py-2 text-sm"
    >
      <Icon className="mr-2 h-4 w-4" /> {label}
    </button>
  );
}

function TransactionsTab({ sn }: { sn: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['bio-drawer-tx', sn],
    queryFn: () => BiometricDevicesApi.listTransactions({ page: 1, limit: 50 }),
  });
  const rows = (data?.items ?? []).filter((t) => t.deviceSn === sn);

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!rows.length)
    return <p className="text-sm text-slate-400">No recent punches for this device.</p>;

  return (
    <div className="divide-y divide-slate-100">
      {rows.map((t) => (
        <div key={t.id} className="flex items-center justify-between py-2 text-sm">
          <div className="leading-tight">
            <div className="font-mono text-xs text-slate-700">{t.userCode}</div>
            <div className="text-xs text-slate-400">{fmt(t.punchTime)}</div>
          </div>
          <Badge tone={t.punchState === 1 ? 'amber' : 'green'}>
            {t.punchStateDisplay}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function CommandsTab({ deviceId }: { deviceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['bio-drawer-cmd', deviceId],
    queryFn: () => BiometricDevicesApi.listCommands(deviceId),
  });

  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (!data?.length)
    return <p className="text-sm text-slate-400">No commands queued yet.</p>;

  const tone = (s: number) => (s === 1 ? 'green' : s === 2 ? 'red' : 'amber');
  const label = (s: number) =>
    s === 1 ? '✓ success' : s === 2 ? '✗ error' : '● pending';

  return (
    <div className="divide-y divide-slate-100">
      {data.map((c) => (
        <div key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
          <code className="truncate text-xs text-slate-700">{c.command}</code>
          <Badge tone={tone(c.status)}>{label(c.status)}</Badge>
        </div>
      ))}
    </div>
  );
}
