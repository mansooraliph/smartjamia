import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { toast } from '@/stores/toast.store';
import { ENROLL_USER_TYPES, EnrollUserType } from '@/constants/biometric';
import {
  BiometricDevicesApi,
  DevicePrefixes,
} from '@/services/biometric-devices.api';

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const DEFAULTS: DevicePrefixes = {
  student: 'S',
  teacher: 'T',
  staff: 'E',
  visitor: 'V',
};

/** Client-side mirror of the backend validation. A prefix is nullable — an
 *  empty field means no prefix (raw id) for that user type; when set, it
 *  must be 1-8 alphanumerics, and no prefix may be a leading substring of
 *  another. */
function validate(p: DevicePrefixes): string | null {
  const types = Object.keys(p) as (keyof DevicePrefixes)[];
  for (const t of types) {
    const v = p[t];
    if (!v) continue;
    if (!/^[A-Za-z0-9]{1,8}$/.test(v))
      return `Prefix "${v}" (${t}) must be 1-8 letters or digits`;
  }
  for (const a of types)
    for (const b of types)
      if (a !== b && p[a] && p[b] && p[b]!.startsWith(p[a]!))
        return `"${p[a]}" (${a}) conflicts with "${p[b]}" (${b}) — one can't start the other`;
  return null;
}

export function DeviceSettingsModal({ onClose, onSaved }: Props) {
  const [prefixes, setPrefixes] = useState<DevicePrefixes>(DEFAULTS);

  useQuery({
    queryKey: ['bio-settings'],
    queryFn: async () => {
      const res = await BiometricDevicesApi.getSettings();
      setPrefixes({ ...DEFAULTS, ...res.prefixes });
      return res;
    },
  });

  const save = useMutation({
    mutationFn: () => BiometricDevicesApi.updateSettings(prefixes),
    onSuccess: () => {
      toast.success('Device settings saved');
      onSaved();
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to save settings'),
  });

  const err = validate(prefixes);
  const set = (t: EnrollUserType, v: string) =>
    setPrefixes((p) => ({ ...p, [t]: v }));

  return (
    <Modal
      open
      onClose={onClose}
      title="Device Settings"
      description="Configure the PIN prefix used per user type on devices."
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={!!err || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {ENROLL_USER_TYPES.map((u) => (
          <Field key={u.value} label={`${u.icon} ${u.label} prefix`}>
            <Input
              value={prefixes[u.value] ?? ''}
              maxLength={8}
              onChange={(e) =>
                set(u.value, e.target.value.replace(/[^A-Za-z0-9]/g, ''))
              }
              placeholder="No prefix"
            />
            <p className="mt-1 text-xs text-slate-400">
              {prefixes[u.value]
                ? `e.g. ${prefixes[u.value]}${u.value === 'visitor' ? '<visitor-id>' : '<id>'}`
                : `No prefix — raw ${u.value === 'visitor' ? 'visitor id' : 'id'} used as-is`}
            </p>
          </Field>
        ))}
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <div className="mt-4 flex gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-700">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Prefixes keep PINs unique across user types and let punches resolve
          back to the right person. Changing them affects new enrollments — use
          “Sync Users” on each device afterwards so existing users get the new
          PINs.
        </span>
      </div>
    </Modal>
  );
}
