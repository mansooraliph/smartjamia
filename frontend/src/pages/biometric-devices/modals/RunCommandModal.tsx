import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Field, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { toast } from '@/stores/toast.store';
import {
  BiometricDevicesApi,
  BiometricDeviceDto,
} from '@/services/biometric-devices.api';

interface Props {
  device: BiometricDeviceDto;
  onClose: () => void;
  onSuccess: () => void;
}

// Use literal \t in presets; the backend converts it to a real tab.
const PRESETS: { label: string; value: string }[] = [
  { label: 'Reboot', value: 'REBOOT' },
  { label: 'Read info', value: 'INFO' },
  {
    label: 'Add user',
    value: 'DATA USER PIN=1001\\tName=Test User\\tPri=0\\tCard=\\tPasswd=',
  },
  {
    label: 'Update userinfo',
    value: 'DATA UPDATE USERINFO PIN=1001\\tName=Test User\\tPri=0',
  },
  {
    label: 'Enroll fingerprint',
    value: 'ENROLL_FP PIN=1001\\tFID=0\\tRETRY=3\\tOVERWRITE=1',
  },
  { label: 'Duplicate punch 30s', value: 'SET OPTION AlarmReRec=30' },
  { label: 'Clear attendance log', value: 'CLEAR LOG' },
  { label: 'Clear all data', value: 'CLEAR DATA' },
];

export function RunCommandModal({ device, onClose, onSuccess }: Props) {
  const [command, setCommand] = useState('');

  const run = useMutation({
    mutationFn: () => BiometricDevicesApi.runCommand(device.id, command),
    onSuccess: (res) => {
      toast.success(`Command queued for ${device.alias || device.sn}`);
      // eslint-disable-next-line no-console
      console.log('Queued command:', res.command);
      onSuccess();
      onClose();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.error?.message ?? 'Failed to queue command'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Run Command"
      description={`Queue a raw command to ${device.alias || device.sn}`}
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={run.isPending}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => run.mutate()}
            disabled={!command.trim() || run.isPending}
          >
            {run.isPending ? 'Queuing…' : 'Queue command'}
          </button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setCommand(p.value)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition',
              'border-slate-300 text-slate-600 hover:bg-slate-50',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Field label="Command">
        <Textarea
          rows={3}
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="e.g. DATA USER PIN=1001\tName=John\tPri=0\tCard=\tPasswd="
          className="font-mono text-xs"
        />
      </Field>

      <div className="mt-3 flex gap-2 rounded-md bg-slate-50 p-3 text-xs text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Use <code>\t</code> for tab-separated fields (converted to a real tab
          on send). One command per run. The result appears in the device’s
          Commands tab once it polls.
        </span>
      </div>
    </Modal>
  );
}
