import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  Database,
  Server,
  RefreshCw,
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
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';

const STATUSES = [
  'trial',
  'active',
  'grace_period',
  'suspended',
  'cancelled',
] as const;

const schema = z
  .object({
    name: z.string().min(1, 'Required'),
    code: z
      .string()
      .regex(/^[A-Z0-9][A-Z0-9-]{0,49}$/, 'UPPERCASE, alphanumeric (- allowed)')
      .optional()
      .or(z.literal('')),
    slug: z
      .string()
      .regex(/^[a-z][a-z0-9-]{0,99}$/, 'lowercase, kebab-case')
      .optional()
      .or(z.literal('')),
    email: z.string().email('Invalid email'),
    phone: z.string().optional().or(z.literal('')),
    planId: z.string().uuid('Required').or(z.literal('')),
    status: z.enum(STATUSES),
    ownerName: z.string().optional().or(z.literal('')),
    ownerEmail: z.union([z.string().email(), z.literal('')]).optional(),
    ownerPassword: z.string().optional().or(z.literal('')),
  })
  .superRefine((vals, ctx) => {
    const any = vals.ownerName || vals.ownerEmail || vals.ownerPassword;
    if (!any) return;
    if (!vals.ownerName) {
      ctx.addIssue({
        path: ['ownerName'],
        code: z.ZodIssueCode.custom,
        message: 'Required when creating owner',
      });
    }
    if (!vals.ownerEmail) {
      ctx.addIssue({
        path: ['ownerEmail'],
        code: z.ZodIssueCode.custom,
        message: 'Required when creating owner',
      });
    }
    if (!vals.ownerPassword || vals.ownerPassword.length < 8) {
      ctx.addIssue({
        path: ['ownerPassword'],
        code: z.ZodIssueCode.custom,
        message: 'At least 8 characters',
      });
    }
  });
type FormValues = z.infer<typeof schema>;

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
  const [modal, setModal] = useState<{ open: boolean; school?: School }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; school?: School }>({
    open: false,
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [provisionTarget, setProvisionTarget] = useState<School | null>(null);

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
        `Provisioned dedicated schema "${r.schemaName}" — ${r.totalRowsMoved} rows moved out of shared_pool.`,
      );
    },
  });

  const runExpiry = useMutation({
    mutationFn: () => MaintenanceApi.runExpiry(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['schools'] });
      setNotice(
        `Expiry sweep: checked ${r.checked} · →grace ${r.toGrace} · →suspended ${r.toSuspended} · restored ${r.restored}.`,
      );
    },
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
            ✕
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
              <div className="leading-tight">
                <div className="font-medium text-slate-900">{s.name}</div>
                <code className="text-xs text-slate-500">{s.slug}</code>
              </div>
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

function SchoolFormModal({
  open,
  school,
  plans,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  school?: School;
  plans: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: FormValues) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const isEdit = !!school;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: school?.name ?? '',
      code: school?.code ?? '',
      slug: school?.slug ?? '',
      email: school?.email ?? '',
      phone: school?.phone ?? '',
      planId: school?.planId ?? '',
      status: (school?.status as FormValues['status']) ?? 'trial',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={school ? `Edit ${school.name}` : 'Onboard new school'}
      description={
        isEdit
          ? 'Update school details. To change the owner, manage users separately.'
          : 'Code and slug are auto-generated from the name when blank. Owner is created in the tenant database.'
      }
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
          >
            {saving ? 'Saving…' : school ? 'Save changes' : 'Create school'}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field
          label="School name"
          required
          error={errors.name?.message}
          className="sm:col-span-2"
        >
          <Input {...register('name')} placeholder="Sunrise Public School" />
        </Field>

        <Field
          label="School Code"
          hint="UPPERCASE — what owners type to log in (e.g. SUNRISE). Auto-generated if blank."
          error={errors.code?.message}
        >
          <Input
            {...register('code')}
            placeholder="SUNRISE"
            className="font-mono uppercase"
            style={{ textTransform: 'uppercase' }}
          />
        </Field>

        <Field
          label="URL Slug"
          hint="Lowercase kebab-case. Auto-generated if blank."
          error={errors.slug?.message}
        >
          <Input
            {...register('slug')}
            placeholder="sunrise-public-school"
            className="font-mono"
          />
        </Field>

        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>

        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} />
        </Field>

        <Field label="Plan" error={errors.planId?.message}>
          <Select {...register('planId')}>
            <option value="">— None —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Status" error={errors.status?.message}>
          <Select {...register('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        {!isEdit && (
          <>
            <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
              <h4 className="mb-1 font-medium text-slate-900">
                School admin (owner)
              </h4>
              <p className="text-xs text-slate-500">
                Creates a user with role <code>owner</code> in the tenant
                database. They can immediately sign in at <code>/login</code>{' '}
                using the School Code above.
              </p>
            </div>

            <Field label="Owner name" error={errors.ownerName?.message}>
              <Input {...register('ownerName')} placeholder="Principal Name" />
            </Field>
            <Field label="Owner email" error={errors.ownerEmail?.message}>
              <Input
                type="email"
                {...register('ownerEmail')}
                placeholder="owner@school.edu"
              />
            </Field>
            <Field
              label="Owner password"
              hint="At least 8 characters"
              error={errors.ownerPassword?.message}
              className="sm:col-span-2"
            >
              <Input
                type="password"
                {...register('ownerPassword')}
                placeholder="Min 8 chars"
              />
            </Field>
          </>
        )}

        {errorMsg && (
          <div className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
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
