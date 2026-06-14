import { AlertTriangle, Info, RotateCw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

interface Props {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  variant?: ConfirmVariant;
  loading?: boolean;
}

const ICON = { danger: AlertTriangle, warning: RotateCw, info: Info };
const ICON_TONE = {
  danger: 'bg-red-100 text-red-600',
  warning: 'bg-amber-100 text-amber-600',
  info: 'bg-blue-100 text-blue-600',
};
const CONFIRM_BTN = {
  danger: 'btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
  warning: 'btn bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50',
  info: 'btn-primary',
};

export function ConfirmActionModal({
  title,
  description,
  confirmLabel = 'Confirm',
  onConfirm,
  onClose,
  variant = 'warning',
  loading = false,
}: Props) {
  const Icon = ICON[variant];
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className={CONFIRM_BTN[variant]}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div className={`h-fit rounded-full p-2 ${ICON_TONE[variant]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-sm text-slate-700">{description}</p>
      </div>
    </Modal>
  );
}
