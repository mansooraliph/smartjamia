import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Users,
  GraduationCap,
  BookOpen,
  Layers,
  Eye,
  Loader2,
  Database,
  Server,
  Mail,
  Phone,
  LayoutGrid,
  CreditCard,
  Pencil,
  UserCog,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  CreateSchoolPayload,
  PlansApi,
  School,
  SchoolsApi,
  Subscription,
  SubscriptionsApi,
} from '@/services/superadmin.api';
import { Badge } from '@/components/ui/Badge';
import { DataTable } from '@/components/ui/DataTable';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import { OwnerModal, SchoolFormModal } from '@/components/superadmin/SchoolModals';

const statusTone: Record<
  School['status'],
  'green' | 'amber' | 'red' | 'slate' | 'blue'
> = {
  trial: 'amber',
  active: 'green',
  grace_period: 'amber',
  suspended: 'red',
  cancelled: 'slate',
};

const subTone: Record<
  Subscription['status'],
  'green' | 'amber' | 'red' | 'slate'
> = {
  active: 'green',
  trial: 'amber',
  grace_period: 'amber',
  cancelled: 'slate',
  expired: 'red',
};

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'subscription', label: 'Subscription', icon: CreditCard },
  { key: 'users', label: 'Staff logins', icon: Users },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function SchoolDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const enterImpersonation = useAuthStore((s) => s.enterImpersonation);
  const [tab, setTab] = useState<TabKey>('overview');
  const [editOpen, setEditOpen] = useState(false);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const { data: school, isLoading: schoolLoading } = useQuery({
    queryKey: ['school', id],
    queryFn: () => SchoolsApi.get(id),
    enabled: !!id,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: PlansApi.list,
  });

  const upsert = useMutation({
    mutationFn: (payload: CreateSchoolPayload) => SchoolsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', id] });
      qc.invalidateQueries({ queryKey: ['schools'] });
      setEditOpen(false);
    },
  });

  const { data: summary } = useQuery({
    queryKey: ['school-summary', id],
    queryFn: () => SchoolsApi.getSummary(id),
    enabled: !!id,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['school-users', id],
    queryFn: () => SchoolsApi.getUsers(id),
    enabled: !!id,
  });

  const { data: subscriptions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['school-subscriptions', id],
    queryFn: () => SubscriptionsApi.list(id),
    enabled: !!id,
  });

  const impersonate = useMutation({
    mutationFn: () => SchoolsApi.impersonate(id),
    onSuccess: (session) => {
      enterImpersonation({
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          role: session.user.role,
          schoolId: session.user.schoolId,
          schoolSlug: session.user.schoolSlug,
          scope: 'tenant',
        },
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken,
        schoolSlug: session.school.slug,
      });
      qc.clear();
      navigate('/dashboard');
    },
    onError: (e) =>
      toast.error(errMsg(e) ?? 'Could not impersonate this school'),
  });

  if (schoolLoading || !school) {
    return (
      <div className="py-16 text-center text-slate-400">
        {schoolLoading ? 'Loading…' : 'School not found.'}
      </div>
    );
  }

  const currentSub = subscriptions.find((s) =>
    ['active', 'trial', 'grace_period'].includes(s.status),
  );

  return (
    <>
      <button
        onClick={() => navigate('/superadmin/schools')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> All schools
      </button>

      {/* Header card */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{school.name}</h1>
            <Badge tone={statusTone[school.status] ?? 'slate'}>{school.status}</Badge>
            {school.plan && <Badge tone="blue">{school.plan.name}</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> {school.email}
            </span>
            {school.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {school.phone}
              </span>
            )}
            <code className="rounded bg-slate-50 px-1.5 py-0.5 font-mono text-xs font-semibold">
              {school.code}
            </code>
            <code className="text-xs text-slate-400">{school.slug}</code>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
            {school.isSchemaProvisioned ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Server className="h-3.5 w-3.5" /> Dedicated schema ({school.schemaName})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Database className="h-3.5 w-3.5" /> Shared pool
              </span>
            )}
            <span>Created {formatDate(school.createdAt)}</span>
            {school.trialEndsAt && <span>Trial ends {formatDate(school.trialEndsAt)}</span>}
            {school.subscriptionEndsAt && (
              <span>Subscription ends {formatDate(school.subscriptionEndsAt)}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary inline-flex items-center gap-1.5"
            onClick={() => setEditOpen(true)}
            title="Edit school details"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            className="btn-secondary inline-flex items-center gap-1.5"
            onClick={() => setOwnerOpen(true)}
            title="Manage admin / reset password"
          >
            <UserCog className="h-4 w-4" />
            Reset password
          </button>
          <button
            className="btn-secondary inline-flex items-center gap-1.5 disabled:opacity-50"
            onClick={() => impersonate.mutate()}
            disabled={impersonate.isPending}
            title="Log in as this school's admin"
          >
            {impersonate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Impersonate
          </button>
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-600 hover:text-green-800">
            ✕
          </button>
        </div>
      )}

      <SchoolFormModal
        open={editOpen}
        school={school}
        plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        onClose={() => setEditOpen(false)}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onSubmit={(v) =>
          upsert.mutate({
            name: v.name,
            code: v.code ? v.code.toUpperCase() : undefined,
            slug: v.slug || undefined,
            email: v.email,
            phone: v.phone || undefined,
            planId: v.planId || undefined,
            status: v.status,
          })
        }
      />

      {ownerOpen && (
        <OwnerModal
          school={school}
          onClose={() => setOwnerOpen(false)}
          onSaved={(msg) => {
            setOwnerOpen(false);
            setNotice(msg);
          }}
        />
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="-mb-px flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 border-b-2 px-3 pb-2.5 text-sm font-medium',
                  active
                    ? 'border-brand-500 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700',
                )}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile icon={GraduationCap} label="Students" value={summary?.studentsCount} />
          <StatTile icon={Users} label="Staff logins" value={summary?.staffCount} />
          <StatTile icon={BookOpen} label="Classes" value={summary?.classesCount} />
          <StatTile icon={Layers} label="Sections" value={summary?.sectionsCount} />
        </div>
      )}

      {tab === 'subscription' && (
        <div>
          {currentSub && (
            <div className="mb-4 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-4">
              <div>
                <div className="text-xs text-slate-400">Plan</div>
                <div className="font-medium text-slate-900">
                  {currentSub.plan?.name ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Status</div>
                <Badge tone={subTone[currentSub.status] ?? 'slate'}>
                  {currentSub.status}
                </Badge>
              </div>
              <div>
                <div className="text-xs text-slate-400">Billing</div>
                <div className="font-medium text-slate-900">
                  {formatMoney(currentSub.amount, currentSub.currency)} /{' '}
                  {currentSub.billingCycle}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Current period</div>
                <div className="font-medium text-slate-900">
                  {formatDate(currentSub.currentPeriodStart)} –{' '}
                  {formatDate(currentSub.currentPeriodEnd)}
                </div>
              </div>
            </div>
          )}
          <DataTable<Subscription>
            rows={subscriptions}
            getRowId={(r) => r.id}
            isLoading={subsLoading}
            emptyMessage="No subscriptions on record for this school."
            columns={[
              { key: 'plan', header: 'Plan', render: (s) => s.plan?.name ?? '—' },
              {
                key: 'status',
                header: 'Status',
                render: (s) => (
                  <Badge tone={subTone[s.status] ?? 'slate'}>{s.status}</Badge>
                ),
              },
              { key: 'cycle', header: 'Cycle', render: (s) => s.billingCycle },
              {
                key: 'amount',
                header: 'Amount',
                render: (s) => formatMoney(s.amount, s.currency),
              },
              {
                key: 'period',
                header: 'Period',
                render: (s) =>
                  `${formatDate(s.currentPeriodStart)} – ${formatDate(s.currentPeriodEnd)}`,
              },
              {
                key: 'gateway',
                header: 'Gateway',
                render: (s) => s.paymentGateway ?? '—',
              },
            ]}
          />
        </div>
      )}

      {tab === 'users' && (
        <DataTable
          rows={users}
          getRowId={(r) => r.id}
          isLoading={usersLoading}
          emptyMessage="No staff logins in this school yet."
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (u) => <span className="font-medium text-slate-900">{u.name}</span>,
            },
            { key: 'email', header: 'Email' },
            {
              key: 'role',
              header: 'Role',
              render: (u) => <Badge tone="blue">{u.role}</Badge>,
            },
            {
              key: 'active',
              header: 'Active',
              render: (u) => (
                <Badge tone={u.isActive ? 'green' : 'slate'}>
                  {u.isActive ? 'Active' : 'Disabled'}
                </Badge>
              ),
            },
            {
              key: 'lastLogin',
              header: 'Last login',
              render: (u) => formatDateTime(u.lastLoginAt),
            },
          ]}
        />
      )}
    </>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value?: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">
        {value ?? <span className="text-slate-300">—</span>}
      </div>
    </div>
  );
}

function errMsg(e: unknown): string | undefined {
  if (!e) return undefined;
  const anyE = e as any;
  return (
    anyE?.response?.data?.error?.message ??
    anyE?.message ??
    'Something went wrong'
  );
}
