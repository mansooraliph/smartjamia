import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = true,
  loading = false,
}: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      variant="center"
      footer={
        <>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={
              destructive
                ? 'btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-50'
                : 'btn-primary'
            }
          >
            {loading ? 'Please wait…' : confirmText}
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <div
          className={
            destructive
              ? 'rounded-full bg-red-100 p-2 text-red-600 h-fit'
              : 'rounded-full bg-amber-100 p-2 text-amber-600 h-fit'
          }
        >
          <AlertTriangle className="h-5 w-5" />
        </div>
        <p className="text-sm text-slate-700">{message}</p>
      </div>
    </Modal>
  );
}
