import { useEffect, useState } from 'react';
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

interface PortalPinModalProps {
  open: boolean;
  onClose: () => void;
  subject: string; // e.g. "Aryan Khan"
  loginHint: string; // e.g. "Logs in with admission # ADM2026001"
  hasAccess: boolean;
  busy?: boolean;
  error?: string | null;
  onSet: (pin: string) => void;
  onRevoke: () => void;
}

/** Admin dialog to enable/reset/revoke a student's or parent's portal PIN. */
export function PortalPinModal({
  open,
  onClose,
  subject,
  loginHint,
  hasAccess,
  busy,
  error,
  onSet,
  onRevoke,
}: PortalPinModalProps) {
  const [pin, setPin] = useState('');
  useEffect(() => {
    if (open) setPin('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Portal access — ${subject}`}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Close
          </button>
          {hasAccess && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={onRevoke}
              disabled={busy}
            >
              <ShieldOff className="h-4 w-4" /> Revoke access
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSet(pin)}
            disabled={busy || pin.length < 4}
          >
            <KeyRound className="mr-1.5 h-4 w-4" />
            {busy ? 'Saving…' : hasAccess ? 'Reset PIN' : 'Enable & set PIN'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
            hasAccess
              ? 'bg-green-50 text-green-700'
              : 'bg-slate-50 text-slate-500'
          }`}
        >
          {hasAccess ? (
            <ShieldCheck className="h-4 w-4" />
          ) : (
            <ShieldOff className="h-4 w-4" />
          )}
          {hasAccess
            ? 'Portal access is enabled.'
            : 'Portal access is not enabled yet.'}
        </div>

        <p className="text-sm text-slate-500">{loginHint}, plus the PIN below.</p>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            {hasAccess ? 'New PIN' : 'PIN'} (4–6 digits)
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 1234"
            className="w-40 rounded-md border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.4em]"
          />
        </label>

        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
