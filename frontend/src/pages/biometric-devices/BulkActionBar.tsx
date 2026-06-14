import { RotateCw, Info, Clock, X, CheckSquare } from 'lucide-react';

export type BulkAction = 'restart' | 'read-info' | 'punch-gap';

interface Props {
  selectedCount: number;
  totalCount: number;
  onAction: (action: BulkAction) => void;
  onSelectAll: () => void;
  onClear: () => void;
  busy?: boolean;
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onAction,
  onSelectAll,
  onClear,
  busy,
}: Props) {
  if (selectedCount === 0) return null;
  const allSelected = selectedCount >= totalCount;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4">
      <div className="animate-slide-up pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-t-xl rounded-b-xl bg-gray-900 px-4 py-3 text-white shadow-2xl">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <CheckSquare className="h-4 w-4 text-brand-400" />
          {selectedCount} selected
        </span>

        {!allSelected && (
          <button
            onClick={onSelectAll}
            className="text-xs text-slate-300 underline-offset-2 hover:underline"
          >
            Select all {totalCount}
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={() => onAction('restart')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
          >
            <RotateCw className="h-4 w-4" /> Restart All
          </button>
          <button
            onClick={() => onAction('read-info')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
          >
            <Info className="h-4 w-4" /> Read Info
          </button>
          <button
            onClick={() => onAction('punch-gap')}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1.5 text-sm font-medium hover:bg-white/20 disabled:opacity-50"
          >
            <Clock className="h-4 w-4" /> Punch Gap
          </button>
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" /> Clear
          </button>
        </div>
      </div>
    </div>
  );
}
