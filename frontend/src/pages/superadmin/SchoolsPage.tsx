import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  Database,
  Server,
  RefreshCw,
  UserCog,
  Loader2,
  Eye,
} from 'lucide-react';
import {
  CreateSchoolPayload,
  MaintenanceApi,
  PlansApi,
  School,
  SchoolsApi,
} from '@/services/superadmin.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatDate } from '@/lib/format';
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

export function SchoolsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [modal, setModal] = useState<{ open: boolean; school?: School }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; school?: School }>({
    open: false,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [provisionTarget, setProvisionTarget] = useState<School | null>(null);
  const [ownerTarget, setOwnerTarget] = useState<School | null>(null);

  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: SchoolsApi.list,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: PlansApi.list,
  });

  const upsert = useMutation({
    mutationFn: (vals: { id?: string; payload: CreateSchoolPayload }) =>
      vals.id
        ? SchoolsApi.update(vals.id, vals.payload)
        : SchoolsApi.create(vals.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'stats'] });
      setModal({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => SchoolsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schools'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'stats'] });
      setConfirm({ open: false });
    },
  });

  const provision = useMutation({
    mutationFn: (id: string) => SchoolsApi.provision(id),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['schools'] });
      setProvisionTarget(null);
      setNotice(
        `Provisioned dedicated schema "${r.schemaName}" â€” ${r.totalRowsMoved} rows moved out of shared_pool.`,
      );
    },
  });

  const runExpiry = useMutation({
    mutationFn: () => MaintenanceApi.runExpiry(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['schools'] });
      setNotice(
        `Expiry sweep: checked ${r.checked} Â· â†’grace ${r.toGrace} Â· â†’suspended ${r.toSuspended} Â· restored ${r.restored}.`,
      );
    },
  });

  const impersonate = useMutation({
    mutationFn: (id: string) => SchoolsApi.impersonate(id),
    onSuccess: (session) => {
      navigate('/impersonate-handoff', {
        state: {
          action: 'enter',
          session: {
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
          },
        },
      });
    },
    onError: (e) =>
      toast.error(errMsg(e) ?? 'Could not impersonate this school'),
  });

  const copyCode = (s: School) => {
    navigator.clipboard.writeText(s.code);
    setCopiedId(s.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <>
      <PageHeader
        title="Schools"
        description="Tenant institutions. The School Code is what owners type to log in."
        actions={
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={() => runExpiry.mutate()}
              disabled={runExpiry.isPending}
              title="Re-evaluate every school's trial/subscription status now"
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${runExpiry.isPending ? 'animate-spin' : ''}`}
              />
              Run expiry sweep
            </button>
            <button
              className="btn-primary"
              onClick={() => setModal({ open: true })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Onboard school
            </button>
          </div>
        }
      />

      {notice && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-600 hover:text-green-800">
            âœ•
          </button>
        </div>
      )}

      <DataTable<School>
        rows={schools}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No schools onboarded yet."
        columns={[
          {
            key: 'name',
            header: 'School',
            render: (s) => (
              <button
                className="leading-tight text-left hover:underline"
                onClick={() => navigate(`/superadmin/schools/${s.id}`)}
                title="View school details"
              >
                <div className="font-medium text-slate-900">{s.name}</div>
                <code className="text-xs text-slate-500">{s.slug}</code>
              </button>
            ),
          },
          {
            key: 'code',
            header: 'Login Code',
            render: (s) => (
              <button
                onClick={() => copyCode(s)}
                className="group inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-sm hover:border-brand-400 hover:bg-brand-50"
                title="Copy"
              >
                <span className="font-semibold">{s.code}</span>
                {copiedId === s.id ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3 text-slate-400 group-hover:text-brand-600" />
                )}
              </button>
            ),
          },
          { key: 'email', header: 'Email' },
          {
            key: 'plan',
            header: 'Plan',
            render: (s) =>
              s.plan ? (
                <Badge tone="blue">{s.plan.name}</Badge>
              ) : (
                <span className="text-slate-400">No plan</span>
              ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (s) => (
              <Badge tone={statusTone[s.status] ?? 'slate'}>{s.status}</Badge>
            ),
          },
          {
            key: 'trial',
            header: 'Trial ends',
            render: (s) => formatDate(s.trialEndsAt),
          },
          {
            key: 'subscriptionEnds',
            header: 'Subscription ends',
            render: (s) =>
              s.subscriptionEndsAt ? (
                new Date(s.subscriptionEndsAt).getFullYear() >= 2099 ? (
                  <span className="text-slate-500">Lifetime</span>
                ) : (
                  formatDate(s.subscriptionEndsAt)
                )
              ) : (
                <span className="text-slate-400">â€”</span>
              ),
          },
          {
            key: 'schema',
            header: 'Schema',
            render: (s) =>
              s.isSchemaProvisioned ? (
                <span
                  className="inline-flex items-center gap-1 text-xs text-emerald-700"
                  title={s.schemaName}
                >
                  <Server className="h-3.5 w-3.5" /> Dedicated
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Database className="h-3.5 w-3.5" /> Shared pool
                </span>
              ),
          },
        ]}
        actions={(s) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, school: s })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
              onClick={() => setOwnerTarget(s)}
              title="Manage admin / reset password"
            >
              <UserCog className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-violet-50 hover:text-violet-600 disabled:opacity-50"
              onClick={() => impersonate.mutate(s.id)}
              disabled={impersonate.isPending}
              title="Log in as this school's admin (impersonate)"
            >
              {impersonate.isPending && impersonate.variables === s.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
            {!s.isSchemaProvisioned && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                onClick={() => setProvisionTarget(s)}
                disabled={provision.isPending}
                title="Provision a dedicated schema"
              >
                <Server className="h-4 w-4" />
              </button>
            )}
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, school: s })}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <SchoolFormModal
        open={modal.open}
        school={modal.school}
        plans={plans.map((p) => ({ id: p.id, name: p.name }))}
        onClose={() => setModal({ open: false })}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onSubmit={(v) =>
          upsert.mutate({
            id: modal.school?.id,
            payload: {
              name: v.name,
              code: v.code ? v.code.toUpperCase() : undefined,
              slug: v.slug || undefined,
              email: v.email,
              phone: v.phone || undefined,
              planId: v.planId || undefined,
              status: v.status,
              ...(modal.school
                ? {}
                : {
                    ownerName: v.ownerName || undefined,
                    ownerEmail: v.ownerEmail || undefined,
                    ownerPassword: v.ownerPassword || undefined,
                  }),
            },
          })
        }
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.school && remove.mutate(confirm.school.id)}
        loading={remove.isPending}
        title="Delete school?"
        message={`Soft-delete "${confirm.school?.name}". Data is retained but the school will be hidden from listings.`}
        confirmText="Delete school"
      />

      {ownerTarget && (
        <OwnerModal
          school={ownerTarget}
          onClose={() => setOwnerTarget(null)}
          onSaved={(msg) => {
            setOwnerTarget(null);
            setNotice(msg);
          }}
        />
      )}

      <ConfirmDialog
        open={!!provisionTarget}
        onClose={() => {
          setProvisionTarget(null);
          provision.reset();
        }}
        onConfirm={() => provisionTarget && provision.mutate(provisionTarget.id)}
        loading={provision.isPending}
        destructive={false}
        title="Provision dedicated schema?"
        message={
          provision.error
            ? errMsg(provision.error)!
            : `Move "${provisionTarget?.name}" off the shared pool into its own database schema. Its data is relocated in one transaction; the school keeps working throughout. This can't be undone automatically.`
        }
        confirmText="Provision schema"
      />
    </>
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
