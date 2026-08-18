import { ComponentType } from 'react';
import { cn } from '@/lib/cn';

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

interface Props<K extends string> {
  items: TabItem<K>[];
  active: K;
  onChange: (key: K) => void;
  className?: string;
}

/** Underline-style tab nav — matches the superadmin School Detail page. */
export function Tabs<K extends string>({ items, active, onChange, className }: Props<K>) {
  return (
    <div className={cn('mb-6 border-b border-slate-200', className)}>
      <nav className="-mb-px flex gap-1">
        {items.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={cn(
                'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium',
                isActive
                  ? 'border-brand-500 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}
            >
              {Icon && <Icon className="h-4 w-4" />} {t.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
