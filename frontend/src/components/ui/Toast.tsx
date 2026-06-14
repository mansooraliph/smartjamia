import { useEffect } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Toast, ToastType, useToastStore } from '@/stores/toast.store';

const ICONS: Record<ToastType, typeof Info> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
};

const BAR: Record<ToastType, string> = {
  success: 'bg-green-500',
  error: 'bg-red-500',
  warning: 'bg-amber-500',
  info: 'bg-blue-500',
};

function ToastItem({ t }: { t: Toast }) {
  const remove = useToastStore((s) => s.removeToast);
  const duration = t.duration ?? 3000;
  const Icon = ICONS[t.type];

  useEffect(() => {
    const timer = setTimeout(() => remove(t.id), duration);
    return () => clearTimeout(timer);
  }, [t.id, duration, remove]);

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto relative w-80 overflow-hidden rounded-lg border shadow-lg',
        'animate-[toastIn_180ms_ease-out]',
        TONE[t.type],
      )}
    >
      <div className="flex items-start gap-3 p-3.5">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="flex-1 text-sm font-medium leading-snug">{t.message}</p>
        <button
          onClick={() => remove(t.id)}
          className="shrink-0 rounded p-0.5 text-current/70 hover:bg-black/5"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        className={cn('h-0.5 origin-left animate-[toastBar_linear_forwards]', BAR[t.type])}
        style={{ animationDuration: `${duration}ms` }}
      />
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
