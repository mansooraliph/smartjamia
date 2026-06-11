import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Check,
  CreditCard,
  Loader2,
  Sparkles,
} from 'lucide-react';
import {
  BillingApi,
  BillingInfo,
  BillingPlanRef,
} from '@/services/school.api';
import { rupees } from '@/lib/public-api';
import { openRazorpay } from '@/lib/razorpay';
import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/cn';

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'slate'> = {
  active: 'green',
  trial: 'amber',
  grace_period: 'amber',
  suspended: 'red',
  cancelled: 'red',
};

export function BillingPage() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: BillingApi.get,
  });

  const verify = useMutation({
    mutationFn: BillingApi.verify,
    onSuccess: (b) => qc.setQueryData(['billing'], b),
  });

  const subscribe = async (plan: BillingPlanRef) => {
    setError(null);
    setBusyPlan(plan.id);
    try {
      const order = await BillingApi.checkout(plan.id, cycle);
      const resp = await openRazorpay({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        description: `${order.planName} plan (${cycle})`,
        prefill: { name: user?.name, email: user?.email },
      });
      await verify.mutateAsync({
        planId: plan.id,
        billingCycle: cycle,
        razorpayOrderId: resp.razorpay_order_id,
        razorpayPaymentId: resp.razorpay_payment_id,
        razorpaySignature: resp.razorpay_signature,
      });
    } catch (e: any) {
      if (e?.message !== 'Payment cancelled') {
        setError(
          e?.response?.data?.error?.message ?? e?.message ?? 'Payment failed',
        );
      }
    } finally {
      setBusyPlan(null);
    }
  };

  if (isLoading || !data) {
    return (
      <>
        <PageHeader title="Billing" description="Your subscription & invoices." />
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Billing" description="Manage your subscription, plan and invoices." />

      {/* Current status */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatusCard data={data} />
        <div className="card p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Plan</div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {data.plan?.name ?? '—'}
          </div>
          {data.subscription && (
            <div className="mt-1 text-sm text-slate-500">
              {rupees(data.subscription.amount)}/
              {data.subscription.billingCycle === 'yearly' ? 'yr' : 'mo'}
            </div>
          )}
        </div>
        <div className="card p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {data.status === 'active' ? 'Renews on' : 'Trial ends'}
          </div>
          <div className="mt-1 text-lg font-bold text-slate-900">
            {fmtDate(
              data.status === 'active'
                ? data.subscription?.currentPeriodEnd ?? data.subscriptionEndsAt
                : data.trialEndsAt,
            )}
          </div>
        </div>
      </div>

      {!data.gatewayConfigured && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            Online payments aren’t configured yet. Add{' '}
            <code className="rounded bg-amber-100 px-1">RAZORPAY_KEY_ID</code> and{' '}
            <code className="rounded bg-amber-100 px-1">RAZORPAY_KEY_SECRET</code>{' '}
            to enable checkout.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Plans */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">
          {data.status === 'active' ? 'Change plan' : 'Choose a plan'}
        </h3>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-sm">
          {(['monthly', 'yearly'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={cn(
                'rounded-full px-3 py-1 font-medium capitalize transition',
                cycle === c ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500',
              )}
            >
              {c}
              {c === 'yearly' && <span className="ml-1 text-xs text-green-600">-17%</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.availablePlans.map((p) => {
          const isCurrent = data.plan?.id === p.id && data.status === 'active';
          const price = cycle === 'yearly' ? p.priceYearly : p.priceMonthly;
          return (
            <div
              key={p.id}
              className={cn(
                'relative flex flex-col rounded-xl border bg-white p-5',
                p.isFeatured ? 'border-brand-300 ring-1 ring-brand-200' : 'border-slate-200',
              )}
            >
              {p.isFeatured && (
                <span className="absolute -top-2.5 left-4 inline-flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                  <Sparkles className="h-3 w-3" /> Popular
                </span>
              )}
              <div className="font-semibold text-slate-900">{p.name}</div>
              <div className="mt-2">
                {p.isCustom ? (
                  <div className="text-xl font-bold text-slate-900">Custom</div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-slate-900">{rupees(price)}</span>
                    <span className="text-xs text-slate-500">/{cycle === 'yearly' ? 'yr' : 'mo'}</span>
                  </div>
                )}
              </div>
              <ul className="mt-3 flex-1 space-y-1.5 text-xs text-slate-600">
                <li className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                  {p.maxStudents === -1 ? 'Unlimited' : p.maxStudents?.toLocaleString('en-IN')} students
                </li>
                {(p.features ?? []).slice(0, 4).map((f) => (
                  <li key={f} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-green-600" />
                    <span className="capitalize">{f.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => subscribe(p)}
                disabled={
                  isCurrent || p.isCustom || !data.gatewayConfigured || busyPlan === p.id
                }
                className={cn(
                  'mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50',
                  p.isFeatured
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'border border-slate-300 text-slate-700 hover:bg-slate-50',
                )}
              >
                {busyPlan === p.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {isCurrent
                  ? 'Current plan'
                  : p.isCustom
                    ? 'Contact sales'
                    : data.status === 'active'
                      ? 'Switch'
                      : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Invoices */}
      <h3 className="mb-3 mt-8 text-base font-semibold text-slate-900">Invoices</h3>
      {data.invoices.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          No invoices yet. Invoices appear here after your first payment.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.invoices.map((inv) => (
                <tr key={inv.invoiceNumber} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-medium text-slate-800">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtDate(inv.paidAt ?? inv.createdAt)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-900">{rupees(inv.amount)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={inv.status === 'paid' ? 'green' : 'slate'}>{inv.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function StatusCard({ data }: { data: BillingInfo }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">Status</div>
      <div className="mt-1 flex items-center gap-2">
        <Badge tone={STATUS_TONE[data.status] ?? 'slate'}>
          {data.status.replace('_', ' ')}
        </Badge>
      </div>
      {data.isTrial && data.trialDaysLeft != null && (
        <div className="mt-2 text-sm text-slate-600">
          <span className={cn('font-semibold', data.trialDaysLeft <= 3 ? 'text-red-600' : 'text-amber-600')}>
            {data.trialDaysLeft} day{data.trialDaysLeft === 1 ? '' : 's'}
          </span>{' '}
          left in trial
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
      {children}
    </th>
  );
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
