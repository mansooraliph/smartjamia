import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, User, AlertTriangle, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast.store';
import {
  BIOMETRIC_TYPES,
  BiometricType,
  ENROLL_USER_TYPES,
  EnrollUserType,
  FINGER_NAMES,
} from '@/constants/biometric';
import {
  BiometricDevicesApi,
  BiometricDeviceDto,
  EnrollableUser,
  isOnline,
} from '@/services/biometric-devices.api';
import { ClassesApi, classLabel } from '@/services/school.api';

const ENROLLMENT_STATUS_STYLE: Record<
  EnrollableUser['enrollmentStatus'],
  string
> = {
  enrolled: 'bg-green-50 text-green-700',
  pending: 'bg-amber-50 text-amber-700',
  none: 'bg-slate-100 text-slate-500',
};

const ENROLLMENT_STATUS_LABEL: Record<EnrollableUser['enrollmentStatus'], string> = {
  enrolled: 'Enrolled',
  pending: 'Pending',
  none: 'Not enrolled',
};

interface Props {
  devices: BiometricDeviceDto[];
  presetDeviceIds?: string[];
  /** Pre-select a specific user (e.g. from a list row's "quick enroll" action)
   *  and skip the search step — only biometric type + devices remain. */
  presetUser?: EnrollableUser;
  onClose: () => void;
  onSuccess: () => void;
}

export function EnrollUserModal({
  devices,
  presetDeviceIds,
  presetUser,
  onClose,
  onSuccess,
}: Props) {
  const [userType, setUserType] = useState<EnrollUserType>(
    presetUser?.userType ?? 'student',
  );
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [classId, setClassId] = useState('');
  const [selected, setSelected] = useState<EnrollableUser | null>(
    presetUser ?? null,
  );
  const [bioType, setBioType] = useState<BiometricType>('fingerprint');
  const [fingerId, setFingerId] = useState(6);
  const [deviceIds, setDeviceIds] = useState<Set<string>>(
    () => new Set(presetDeviceIds ?? []),
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset the selected user (and class filter) whenever the type changes —
  // but NOT on mount, or a presetUser's selection would be wiped immediately
  // (effects run once after the first render regardless of deps).
  const skipNextTypeReset = useRef(true);
  useEffect(() => {
    if (skipNextTypeReset.current) {
      skipNextTypeReset.current = false;
      return;
    }
    setSelected(null);
    setSearch('');
    setClassId('');
  }, [userType]);

  const classes = useQuery({
    queryKey: ['bio-enroll-classes'],
    queryFn: () => ClassesApi.list(),
    enabled: userType === 'student',
    staleTime: 5 * 60 * 1000,
  });

  const results = useQuery({
    queryKey: ['bio-enroll-users', userType, debounced, classId],
    queryFn: () =>
      BiometricDevicesApi.listEnrollableUsers(
        userType,
        debounced,
        userType === 'student' && classId ? classId : undefined,
      ),
    enabled: !selected,
  });

  const enrollable = useMemo(
    () => devices.filter((d) => !d.deactivatedAt),
    [devices],
  );

  const toggleDevice = (id: string) =>
    setDeviceIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const enroll = useMutation({
    mutationFn: () =>
      BiometricDevicesApi.enrollUser({
        userType,
        userId: selected!.id,
        biometricType: bioType,
        fingerId: bioType === 'fingerprint' ? fingerId : undefined,
        deviceIds: [...deviceIds],
      }),
    onSuccess: (res) => {
      if (res.failed_count > 0) {
        toast.warning(res.message);
      } else {
        toast.success(res.message);
      }
      onSuccess();
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? 'Enrollment failed'),
  });

  const canSubmit = selected && deviceIds.size > 0 && !enroll.isPending;

  return (
    <Modal
      open
      onClose={onClose}
      title="Enroll User"
      description="Register a user and capture their biometric on selected devices."
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={enroll.isPending}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => enroll.mutate()}
            disabled={!canSubmit}
          >
            {enroll.isPending ? 'Enrolling…' : 'Enroll'}
          </button>
        </>
      }
    >
      {/* User type */}
      {!presetUser && (
        <>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            User Type
          </label>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ENROLL_USER_TYPES.map((u) => (
              <button
                key={u.value}
                type="button"
                onClick={() => setUserType(u.value)}
                className={cn(
                  'flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-sm font-medium transition',
                  userType === u.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50',
                )}
              >
                <span>{u.icon}</span>
                {u.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* User search / selection */}
      {selected ? (
        <Field label="User">
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
                  ID {selected.code}
                </div>
              </div>
            </div>
            {!presetUser && (
              <button
                className="text-xs font-medium text-brand-700 hover:underline"
                onClick={() => setSelected(null)}
              >
                Change
              </button>
            )}
          </div>
        </Field>
      ) : (
        <div className="grid grid-cols-6 gap-2">
          <Field
            label="User"
            className={userType === 'student' ? 'col-span-4' : 'col-span-6'}
          >
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
          </Field>
          {userType === 'student' && (
            <Field label="Class" className="col-span-2">
              <Select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">All classes</option>
                {(classes.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {classLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
      )}

      {!selected && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-200">
          {results.isLoading ? (
            <p className="p-3 text-sm text-slate-400">Searching…</p>
          ) : (results.data ?? []).length === 0 ? (
            <p className="p-3 text-sm text-slate-400">No matching users.</p>
          ) : (
            (results.data ?? []).map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <User className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="text-sm text-slate-900">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.subtitle ?? u.code}</div>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    ENROLLMENT_STATUS_STYLE[u.enrollmentStatus],
                  )}
                >
                  {ENROLLMENT_STATUS_LABEL[u.enrollmentStatus]}
                </span>
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
              onClick={() => setBioType(b.value)}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition',
                bioType === b.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50',
              )}
            >
              <span>{b.icon}</span>
              {b.label}
              {bioType === b.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {bioType === 'fingerprint' && (
        <Field label="Finger" className="mt-4">
          <Select value={fingerId} onChange={(e) => setFingerId(Number(e.target.value))}>
            {Object.entries(FINGER_NAMES).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {/* Device selection */}
      <div className="mt-4">
        <label className="mb-1 flex items-center justify-between text-sm font-medium text-slate-700">
          <span>Devices</span>
          {enrollable.length > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-brand-700 hover:underline"
              onClick={() =>
                setDeviceIds((prev) =>
                  prev.size === enrollable.length
                    ? new Set()
                    : new Set(enrollable.map((d) => d.id)),
                )
              }
            >
              {deviceIds.size === enrollable.length ? 'Clear all' : 'Select all'}
            </button>
          )}
        </label>
        {enrollable.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-400">
            No active devices available.
          </p>
        ) : (
          <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
            {enrollable.map((d) => (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={deviceIds.has(d.id)}
                  onChange={() => toggleDevice(d.id)}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="font-medium text-slate-800">
                  {d.alias || d.sn}
                </span>
                <span
                  className={cn(
                    'ml-auto text-xs',
                    isOnline(d) ? 'text-green-600' : 'text-slate-400',
                  )}
                >
                  {isOnline(d) ? 'Online' : 'Offline'}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          The user must be standing at the device to complete the scan. We queue
          an add-user command plus the enroll command on each selected device.
        </span>
      </div>
    </Modal>
  );
}
