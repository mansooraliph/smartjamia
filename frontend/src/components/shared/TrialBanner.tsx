import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { BillingApi } from '@/services/school.api';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/cn';

/** Slim banner nudging trial schools to subscribe. Admin-only (billing is admin-gated). */
export function TrialBanner() {
  const { isAdmin } = usePermissions();
  const { data } = useQuery({
    queryKey: ['billing'],
    queryFn: BillingApi.get,
    enabled: isAdmin,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (!isAdmin || !data?.isTrial) return null;
  const days = data.trialDaysLeft ?? 0;
  const urgent = days <= 3;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 text-sm',
        urgent ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800',
      )}
    >
      <div className="flex items-center gap-2">
        {urgent ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0" />
        )}
        <span>
          {days > 0 ? (
            <>
              <span className="font-semibold">
                {days} day{days === 1 ? '' : 's'}
              </span>{' '}
              left in your free trial.
            </>
          ) : (
            <span className="font-semibold">Your free trial has ended.</span>
          )}{' '}
          {data.plan?.name ? `You’re on the ${data.plan.name} plan.` : ''}
        </span>
      </div>
      <Link
        to="/billing"
        className={cn(
          'rounded-md px-3 py-1 text-xs font-semibold text-white',
          urgent ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700',
        )}
      >
        Upgrade now
      </Link>
    </div>
  );
}
