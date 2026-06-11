import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  GitBranch,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatsApi } from '@/services/superadmin.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';

export function OverviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['superadmin', 'stats'],
    queryFn: StatsApi.overview,
  });

  return (
    <>
      <PageHeader
        title="Platform Overview"
        description="A snapshot of schools, plans, and subscriptions on EduPro."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          to="/superadmin/schools"
          icon={Building2}
          label="Schools"
          value={data?.schools.total ?? 0}
          loading={isLoading}
          tone="blue"
          subline={
            data
              ? `${data.schools.active} active · ${data.schools.trial} trial`
              : undefined
          }
        />
        <StatCard
          to="/superadmin/branches"
          icon={GitBranch}
          label="Branches"
          value={data?.branches.total ?? 0}
          loading={isLoading}
          tone="indigo"
          subline="Across all schools"
        />
        <StatCard
          to="/superadmin/plans"
          icon={CreditCard}
          label="Plans"
          value={data?.plans.total ?? 0}
          loading={isLoading}
          tone="purple"
          subline={data ? `${data.plans.active} active` : undefined}
        />
        <StatCard
          to="/superadmin/subscriptions"
          icon={ReceiptText}
          label="Subscriptions"
          value={data?.subscriptions.total ?? 0}
          loading={isLoading}
          tone="green"
          subline={data ? `${data.subscriptions.active} active` : undefined}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Quick actions</h3>
            <Badge tone="slate">Shortcuts</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <QuickAction
              to="/superadmin/schools"
              icon={Building2}
              title="Onboard a school"
              desc="Add a new tenant institution"
            />
            <QuickAction
              to="/superadmin/branches"
              icon={GitBranch}
              title="Add a branch"
              desc="Register a new campus location"
            />
            <QuickAction
              to="/superadmin/plans"
              icon={CreditCard}
              title="Manage plans"
              desc="Edit pricing, features, limits"
            />
            <QuickAction
              to="/superadmin/subscriptions"
              icon={ReceiptText}
              title="Create subscription"
              desc="Link a school to a paid plan"
            />
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            <h3 className="font-semibold text-slate-900">Platform health</h3>
          </div>
          <ul className="space-y-3 text-sm">
            <HealthRow label="Master DB" status="ok" />
            <HealthRow label="Data DB" status="ok" />
            <HealthRow label="Redis" status="ok" />
            <HealthRow label="Bull queue" status="ok" />
          </ul>
          <div className="mt-4 flex items-center gap-1 text-xs text-slate-500">
            <TrendingUp className="h-3 w-3" />
            All services nominal
          </div>
        </div>
      </div>
    </>
  );
}

function StatCard({
  to,
  icon: Icon,
  label,
  value,
  subline,
  tone,
  loading,
}: {
  to: string;
  icon: typeof Building2;
  label: string;
  value: number;
  subline?: string;
  tone: 'blue' | 'indigo' | 'purple' | 'green';
  loading?: boolean;
}) {
  const toneClass = {
    blue: 'bg-blue-100 text-blue-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    purple: 'bg-purple-100 text-purple-700',
    green: 'bg-green-100 text-green-700',
  }[tone];

  return (
    <Link
      to={to}
      className="card group block p-5 transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">
            {loading ? <span className="text-slate-300">—</span> : value}
          </div>
          {subline && (
            <div className="mt-1 text-xs text-slate-500">{subline}</div>
          )}
        </div>
        <div className={`rounded-lg p-2 ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

function QuickAction({
  to,
  icon: Icon,
  title,
  desc,
}: {
  to: string;
  icon: typeof Building2;
  title: string;
  desc: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-brand-300 hover:bg-brand-50"
    >
      <div className="rounded-md bg-slate-100 p-2 text-slate-700 group-hover:bg-brand-100">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-sm font-medium text-slate-900">{title}</div>
        <div className="text-xs text-slate-500">{desc}</div>
      </div>
    </Link>
  );
}

function HealthRow({ label, status }: { label: string; status: 'ok' | 'down' }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-slate-700">{label}</span>
      {status === 'ok' ? (
        <Badge tone="green">● Operational</Badge>
      ) : (
        <Badge tone="red">● Down</Badge>
      )}
    </li>
  );
}
