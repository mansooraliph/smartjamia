import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, User, AlertTriangle, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast.store';
import {
  BIOMETRIC_TYPES,
  BiometricType,
  FINGER_NAMES,
} from '@/constants/biometric';
import {
  BiometricDevicesApi,
  BiometricDeviceDto,
  UserSearchResult,
} from '@/services/biometric-devices.api';

interface Props {
  device: BiometricDeviceDto;
  onClose: () => void;
  onSuccess: () => void;
}

export function RemoteEnrollModal({ device, onClose, onSuccess }: Props) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [type, setType] = useState<BiometricType>('fingerprint');
  const [fingerId, setFingerId] = useState(6);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const results = useQuery({
    queryKey: ['bio-user-search', debounced],
    queryFn: () => BiometricDevicesApi.searchUsers(debounced),
    enabled: debounced.trim().length >= 1 && !selected,
  });

  const enroll = useMutation({
    mutationFn: () =>
      BiometricDevicesApi.enrollRemotely(device.id, {
        userCode: selected!.userCode,
        biometricType: type,
        fingerId: type === 'fingerprint' ? fingerId : undefined,
      }),
    onSuccess: () => {
      toast.success(`Enrollment command sent to ${device.alias || device.sn}`);
      onSuccess();
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to send enrollment'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Remote Enrollment"
      description={device.alias || device.sn}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={enroll.isPending}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => enroll.mutate()}
            disabled={!selected || enroll.isPending}
          >
            {enroll.isPending ? 'Sending…' : 'Send'}
          </button>
        </>
      }
    >
      {/* User search / selection */}
      <Field label="Find User">
        {selected ? (
          <div className="flex items-center justify-between rounded-md border border-brand-200 bg-brand-50 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <User className="h-4 w-4" />
              </span>
              <div className="leading-tight">
                <div className="text-sm font-medium text-slate-900">
                  {selected.name}
                </div>
                <div className="text-xs text-slate-500">
                  {selected.kind} · {selected.userCode}
                </div>
              </div>
            </div>
            <button
              className="text-xs font-medium text-brand-700 hover:underline"
              onClick={() => {
                setSelected(null);
                setSearch('');
              }}
            >
              Change
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID…"
              className="pl-9"
            />
          </div>
        )}
      </Field>

      {!selected && debounced.trim().length >= 1 && (
        <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-slate-200">
          {results.isLoading ? (
            <p className="p-3 text-sm text-slate-400">Searching…</p>
          ) : (results.data ?? []).length === 0 ? (
            <p className="p-3 text-sm text-slate-400">No matching users.</p>
          ) : (
            (results.data ?? []).map((u) => (
              <button
                key={`${u.kind}-${u.id}`}
                onClick={() => setSelected(u)}
                className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <User className="h-3.5 w-3.5" />
                </span>
                <div className="leading-tight">
                  <div className="text-sm text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">
                    {u.kind} · {u.subtitle ?? u.userCode}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Biometric type */}
      <div className="mt-4">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Biometric Type
        </label>
        <div className="flex gap-2">
          {BIOMETRIC_TYPES.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => setType(b.value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition',
                type === b.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50',
              )}
            >
              <span>{b.icon}</span>
              {b.label}
              {type === b.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* Finger (fingerprint only) */}
      {type === 'fingerprint' && (
        <Field label="Finger" className="mt-4">
          <Select
            value={fingerId}
            onChange={(e) => setFingerId(Number(e.target.value))}
          >
            {Object.entries(FINGER_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <div className="mt-4 flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>The user must be standing at the device when you click Send.</span>
      </div>
    </Modal>
  );
}
