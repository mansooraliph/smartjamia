import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Check, Sparkles } from 'lucide-react';
import { PublicApi, PublicPlan, rupees } from '@/lib/public-api';
import { cn } from '@/lib/cn';

type Cycle = 'monthly' | 'yearly';

export function PlanCards() {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['public-plans'],
    queryFn: PublicApi.plans,
  });

  return (
    <div>
      {/* Billing toggle */}
      <div className="mb-10 flex items-center justify-center gap-3">
        <Toggle active={cycle === 'monthly'} onClick={() => setCycle('monthly')}>
          Monthly
        </Toggle>
        <Toggle active={cycle === 'yearly'} onClick={() => setCycle('yearly')}>
          Yearly <span className="ml-1 text-xs text-green-600">2 months free</span>
        </Toggle>
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400">Loading plans…</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              cycle={cycle}
              onChoose={() =>
                p.isCustom
                  ? (window.location.href =
                      'mailto:sales@edupro.app?subject=Enterprise%20plan')
                  : navigate(`/signup?plan=${p.id}&cycle=${cycle}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-full px-4 py-1.5 text-sm font-medium transition',
        active ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100',
      )}
    >
      {children}
    </button>
  );
}

function PlanCard({
  plan,
  cycle,
  onChoose,
}: {
  plan: PublicPlan;
  cycle: Cycle;
  onChoose: () => void;
}) {
  const price = cycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const featured = plan.isFeatured;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm',
        featured ? 'border-brand-400 ring-2 ring-brand-200' : 'border-slate-200',
      )}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
            <Sparkles className="h-3 w-3" /> Most popular
          </span>
        </div>
      )}
      <div className="text-lg font-bold text-slate-900">{plan.name}</div>
      <p className="mt-1 min-h-[2.5rem] text-sm text-slate-500">
        {plan.description}
      </p>

      <div className="mt-4">
        {plan.isCustom ? (
          <div className="text-3xl font-extrabold text-slate-900">Custom</div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-slate-900">
              {rupees(price)}
            </span>
            <span className="text-sm text-slate-500">
              /{cycle === 'yearly' ? 'yr' : 'mo'}
            </span>
          </div>
        )}
        <div className="mt-1 text-xs text-slate-400">
          {plan.isCustom
            ? 'Tailored to your institution'
            : `${plan.trialDays}-day free trial · no card required`}
        </div>
      </div>

      <button
        onClick={onChoose}
        className={cn(
          'mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition',
          featured
            ? 'bg-brand-600 text-white hover:bg-brand-700'
            : 'border border-slate-300 text-slate-700 hover:bg-slate-50',
        )}
      >
        {plan.isCustom ? 'Contact sales' : 'Start free trial'}
      </button>

      <ul className="mt-6 space-y-2 text-sm">
        <li className="flex items-center gap-2 text-slate-600">
          <Check className="h-4 w-4 shrink-0 text-green-600" />
          {plan.maxStudents === -1
            ? 'Unlimited students'
            : `Up to ${plan.maxStudents.toLocaleString('en-IN')} students`}
        </li>
        <li className="flex items-center gap-2 text-slate-600">
          <Check className="h-4 w-4 shrink-0 text-green-600" />
          {plan.maxStaff === -1 ? 'Unlimited staff' : `${plan.maxStaff} staff accounts`}
        </li>
        {plan.features.slice(0, 6).map((f) => (
          <li key={f} className="flex items-center gap-2 text-slate-600">
            <Check className="h-4 w-4 shrink-0 text-green-600" />
            <span className="capitalize">{f.replace(/_/g, ' ')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
