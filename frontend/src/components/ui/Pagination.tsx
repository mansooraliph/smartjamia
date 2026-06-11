import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 20, 50, 100],
}: PaginationProps) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
      <div className="flex items-center gap-2">
        <span>
          {from}–{to} of <span className="font-medium text-slate-900">{total}</span>
        </span>
        {onLimitChange && (
          <select
            className="rounded-md border border-slate-200 py-1 pl-2 pr-6 text-xs"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {limitOptions.map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40 hover:bg-slate-50"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" /> Prev
        </button>
        <span className="px-2 text-xs">
          Page <span className="font-medium text-slate-900">{page}</span> of{' '}
          {Math.max(1, totalPages)}
        </span>
        <button
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 disabled:opacity-40 hover:bg-slate-50"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
