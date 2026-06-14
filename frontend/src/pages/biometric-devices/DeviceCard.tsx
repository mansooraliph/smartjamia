import { useEffect, useRef, useState } from 'react';
import {
  RotateCw,
  Info,
  MoreVertical,
  Copy,
  Check,
  Clock,
  Fingerprint,
  ListChecks,
  Terminal,
  Pencil,
  RefreshCw,
  Eraser,
  Ban,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/constants/biometric';
import { BiometricDeviceDto, isOnline } from '@/services/biometric-devices.api';

export type DeviceAction =
  | 'restart'
  | 'info'
  | 'punch-gap'
  | 'enroll'
  | 'transactions'
  | 'commands'
  | 'rename'
  | 'sync-users'
  | 'clear'
  | 'clear-commands';

interface Props {
  device: BiometricDeviceDto;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAction: (action: DeviceAction, device: BiometricDeviceDto) => void;
  onOpen: (device: BiometricDeviceDto) => void;
  busy?: boolean;
}

function StatusBadge({ device }: { device: BiometricDeviceDto }) {
  if (device.deactivatedAt) return <Badge tone="red">⊗ Deactivated</Badge>;
  if (!device.isApproved) return <Badge tone="amber">Pending approval</Badge>;
  return isOnline(device) ? (
    <Badge tone="green">● Online</Badge>
  ) : (
    <Badge tone="slate">○ Offline</Badge>
  );
}

export function DeviceCard({
  device,
  isSelected,
  onSelect,
  onAction,
  onOpen,
  busy,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const copySn = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(device.sn).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fire = (action: DeviceAction) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(false);
    onAction(action, device);
  };

  const menuItem =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50';

  return (
    <div
      onClick={() => onOpen(device)}
      className={cn(
        'card relative flex cursor-pointer flex-col p-4 transition hover:shadow-md',
        isSelected && 'ring-2 ring-brand-500',
      )}
    >
      {/* Top row */}
      <div className="mb-2 flex items-start justify-between">
        <input
          type="checkbox"
          checked={isSelected}
          onClick={(e) => e.stopPropagation()}
          onChange={() => onSelect(device.id)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          aria-label="Select device"
        />
        <StatusBadge device={device} />
      </div>

      {/* Identity */}
      <div className="leading-tight">
        <div className="truncate text-base font-semibold text-slate-900">
          {device.alias || device.sn}
        </div>
        {device.terminalName && (
          <div className="truncate text-xs text-slate-400">
            {device.terminalName}
          </div>
        )}
      </div>

      {/* Details */}
      <div className="mt-3 space-y-1 text-xs text-slate-500">
        <button
          onClick={copySn}
          className="flex items-center gap-1 font-mono hover:text-brand-600"
          title="Copy serial number"
        >
          SN: {device.sn}
          {copied ? (
            <Check className="h-3 w-3 text-green-600" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
        <div>IP: {device.ipAddress ?? '—'}</div>
        <div>
          Users: {device.userCount ?? 0} · FP: {device.fpCount ?? 0} · Face:{' '}
          {device.faceCount ?? 0}
        </div>
        <div>Last sync: {timeAgo(device.lastActivity ?? device.lastSyncAt)}</div>
      </div>

      {/* Footer actions */}
      <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3">
        <button
          onClick={fire('restart')}
          disabled={busy}
          className="btn-secondary flex-1 !py-1.5 text-xs disabled:opacity-50"
          title="Restart device"
        >
          <RotateCw className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Restart</span>
        </button>
        <button
          onClick={fire('info')}
          disabled={busy}
          className="btn-secondary flex-1 !py-1.5 text-xs disabled:opacity-50"
          title="Read device info"
        >
          <Info className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Info</span>
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((o) => !o);
            }}
            className="btn-secondary !px-2 !py-1.5"
            title="More actions"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <div className="absolute bottom-full right-0 z-20 mb-1 w-48 overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              <button className={menuItem} onClick={fire('punch-gap')}>
                <Clock className="h-4 w-4" /> Set Punch Gap
              </button>
              <button className={menuItem} onClick={fire('enroll')}>
                <Fingerprint className="h-4 w-4" /> Remote Enroll
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button className={menuItem} onClick={fire('transactions')}>
                <ListChecks className="h-4 w-4" /> View Transactions
              </button>
              <button className={menuItem} onClick={fire('commands')}>
                <Terminal className="h-4 w-4" /> View Commands
              </button>
              <button className={menuItem} onClick={fire('clear-commands')}>
                <Ban className="h-4 w-4" /> Clear Pending Commands
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button className={menuItem} onClick={fire('rename')}>
                <Pencil className="h-4 w-4" /> Rename Device
              </button>
              <button className={menuItem} onClick={fire('sync-users')}>
                <RefreshCw className="h-4 w-4" /> Sync Users
              </button>
              <button className={menuItem} onClick={fire('clear')}>
                <Eraser className="h-4 w-4" /> Clear Logs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
