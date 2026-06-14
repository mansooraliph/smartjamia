import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Minus, Plus, Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Field, Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast.store';
import { DUPLICATE_PUNCH_PRESETS } from '@/constants/biometric';
import {
  BiometricDevicesApi,
  BulkActionResult,
} from '@/services/biometric-devices.api';

interface Props {
  deviceIds: string[];
  deviceNames: string[];
  onClose: () => void;
  onSuccess: (seconds: number) => void;
}

export function SetDuplicatePunchModal({
  deviceIds,
  deviceNames,
  onClose,
  onSuccess,
}: Props) {
  const [seconds, setSeconds] = useState(30);
  const isBulk = deviceIds.length > 1;

  const save = useMutation({
    mutationFn: async () => {
      if (isBulk) {
        return BiometricDevicesApi.bulkSetDuplicatePunch(deviceIds, seconds);
      }
      await BiometricDevicesApi.setDuplicatePunch(deviceIds[0], seconds);
      return null;
    },
    onSuccess: (res) => {
      if (res && (res as BulkActionResult).failed_count > 0) {
        const r = res as BulkActionResult;
        toast.warning(
          `Set on ${r.success_count} device(s). Failed: ${r.failed_devices.join(', ')}`,
        );
      } else {
        toast.success(
          `Duplicate punch interval set to ${seconds}s on ${
            isBulk ? `${deviceIds.length} devices` : deviceNames[0]
          }`,
        );
      }
      onSuccess(seconds);
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to set interval'),
  });

  const clamp = (n: number) => Math.max(0, Math.min(3600, Math.round(n) || 0));

  return (
    <Modal
      open
      onClose={onClose}
      title="Set Duplicate Punch Interval"
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending ? 'Applying…' : 'Apply'}
          </button>
        </>
      }
    >
      <p className="mb-4 text-sm text-slate-500">
        Devices:{' '}
        <span className="font-medium text-slate-700">
          {deviceNames.slice(0, 3).join(', ')}
          {deviceNames.length > 3 ? ` +${deviceNames.length - 3} more` : ''}
        </span>
      </p>

      <Field label="Interval (seconds)">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary !px-2.5"
            onClick={() => setSeconds((s) => clamp(s - 5))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <Input
            type="number"
            min={0}
            max={3600}
            value={seconds}
            onChange={(e) => setSeconds(clamp(Number(e.target.value)))}
            className="text-center"
          />
          <button
            type="button"
            className="btn-secondary !px-2.5"
            onClick={() => setSeconds((s) => clamp(s + 5))}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </Field>

      <div className="mt-3 flex flex-wrap gap-2">
        {DUPLICATE_PUNCH_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setSeconds(p.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              seconds === p.value
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-300 text-slate-600 hover:bg-slate-50',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Prevents double-counting if a user taps the reader twice within this
          window. Set to 0 to turn off.
        </span>
      </div>
    </Modal>
  );
}
