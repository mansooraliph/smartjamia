import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Ban } from 'lucide-react';
import {
  PlansApi,
  SchoolsApi,
  Subscription,
  SubscriptionsApi,
} from '@/services/superadmin.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatDate, formatMoney, paiseToRupees, rupeesToPaise } from '@/lib/format';

const SUB_STATUSES = ['trial', 'active', 'grace_period', 'cancelled', 'expired'] as const;
const CYCLES = ['monthly', 'yearly'] as const;
const GATEWAYS = ['razorpay', 'stripe', 'manual'] as const;

const schema = z.object({
  schoolId: z.string().uuid('Required'),
  planId: z.string().uuid('Required'),
  status: z.enum(SUB_STATUSES),
  billingCycle: z.enum(CYCLES),
  amountRupees: z.coerce.number().min(0),
  currency: z.string().default('INR'),
  paymentGateway: z.union([z.enum(GATEWAYS), z.literal('')]).optional(),
});
type FormValues = z.infer<typeof schema>;

const subTone: Record<Subscription['status'], 'green' | 'amber' | 'red' | 'slate'> = {
  active: 'green',
  trial: 'amber',
  grace_period: 'amber',
  cancelled: 'slate',
  expired: 'red',
};

export function SubscriptionsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; sub?: Subscription }>({
    open: false,
  });
  const [cancelDlg, setCancelDlg] = useState<{
    open: boolean;
    sub?: Subscription;
  }>({ open: false });
  const [delDlg, setDelDlg] = useState<{ open: boolean; sub?: Subscription }>({
    open: false,
  });

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: SubscriptionsApi.list,
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: SchoolsApi.list,
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: PlansApi.list,
  });

  const upsert = useMutation({
    mutationFn: (vals: { id?: string; payload: Partial<Subscription> }) =>
      vals.id
        ? SubscriptionsApi.update(vals.id, vals.payload)
        : SubscriptionsApi.create(vals.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'stats'] });
      setModal({ open: false });
    },
  });

  const cancel = useMutation({
    mutationFn: (id: string) => SubscriptionsApi.cancel(id, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      setCancelDlg({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => SubscriptionsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'stats'] });
      setDelDlg({ open: false });
    },
  });

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Links schools to plans with billing cycle and pricing."
        actions={
          <button
            className="btn-primary"
            onClick={() => setModal({ open: true })}
            disabled={schools.length === 0 || plans.length === 0}
            title={
              schools.length === 0 || plans.length === 0
                ? 'Create at least one school and one plan first'
                : 'Create subscription'
            }
          >
            <Plus className="mr-1.5 h-4 w-4" /> New subscription
          </button>
        }
      />

      <DataTable<Subscription>
        rows={subs}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No subscriptions yet."
        columns={[
          {
            key: 'school',
            header: 'School',
            render: (s) =>
              s.school ? (
                <div className="leading-tight">
                  <div className="font-medium text-slate-900">
                    {s.school.name}
                  </div>
                  <code className="text-xs text-slate-500">
                    {s.school.slug}
                  </code>
                </div>
              ) : (
                '—'
              ),
          },
          {
            key: 'plan',
            header: 'Plan',
            render: (s) =>
              s.plan ? <Badge tone="blue">{s.plan.name}</Badge> : '—',
          },
          {
            key: 'status',
            header: 'Status',
            render: (s) => (
              <Badge tone={subTone[s.status] ?? 'slate'}>{s.status}</Badge>
            ),
          },
          {
            key: 'cycle',
            header: 'Cycle',
            render: (s) => <span className="capitalize">{s.billingCycle}</span>,
          },
          {
            key: 'amount',
            header: 'Amount',
            render: (s) => formatMoney(s.amount, s.currency),
          },
          {
            key: 'period',
            header: 'Period',
            render: (s) => (
              <span className="text-xs text-slate-600">
                {formatDate(s.currentPeriodStart)} →{' '}
                {formatDate(s.currentPeriodEnd)}
              </span>
            ),
          },
          {
            key: 'gateway',
            header: 'Gateway',
            render: (s) =>
              s.paymentGateway ? (
                <Badge tone="indigo">{s.paymentGateway}</Badge>
              ) : (
                '—'
              ),
          },
          {
            key: 'autorenew',
            header: 'Renews',
            render: (s) =>
              s.cancelAtPeriodEnd ? (
                <Badge tone="red">Cancels @ period end</Badge>
              ) : (
                <Badge tone="green">Auto-renew</Badge>
              ),
          },
        ]}
        actions={(s) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, sub: s })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-30"
              onClick={() => setCancelDlg({ open: true, sub: s })}
              disabled={s.status === 'cancelled'}
              title="Cancel subscription"
            >
              <Ban className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setDelDlg({ open: true, sub: s })}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <SubFormModal
        open={modal.open}
        sub={modal.sub}
        schools={schools.map((s) => ({ id: s.id, name: s.name }))}
        plans={plans}
        onClose={() => setModal({ open: false })}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onSubmit={(v) =>
          upsert.mutate({
            id: modal.sub?.id,
            payload: {
              schoolId: v.schoolId,
              planId: v.planId,
              status: v.status,
              billingCycle: v.billingCycle,
              amount: rupeesToPaise(v.amountRupees),
              currency: v.currency || 'INR',
              paymentGateway: (v.paymentGateway as any) || undefined,
            },
          })
        }
      />

      <ConfirmDialog
        open={cancelDlg.open}
        onClose={() => setCancelDlg({ open: false })}
        onConfirm={() => cancelDlg.sub && cancel.mutate(cancelDlg.sub.id)}
        loading={cancel.isPending}
        destructive={false}
        title="Cancel subscription?"
        message={`Immediately cancel subscription for ${cancelDlg.sub?.school?.name ?? 'this school'}. The school's status may need a manual update afterwards.`}
        confirmText="Cancel subscription"
      />

      <ConfirmDialog
        open={delDlg.open}
        onClose={() => setDelDlg({ open: false })}
        onConfirm={() => delDlg.sub && remove.mutate(delDlg.sub.id)}
        loading={remove.isPending}
        title="Delete subscription?"
        message="This permanently removes the subscription record. Past invoices are kept."
        confirmText="Delete"
      />
    </>
  );
}

function SubFormModal({
  open,
  sub,
  schools,
  plans,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  sub?: Subscription;
  schools: { id: string; name: string }[];
  plans: { id: string; name: string; priceMonthly: number; priceYearly: number }[];
  onClose: () => void;
  onSubmit: (v: FormValues) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      schoolId: sub?.schoolId ?? (schools[0]?.id ?? ''),
      planId: sub?.planId ?? (plans[0]?.id ?? ''),
      status: (sub?.status as FormValues['status']) ?? 'trial',
      billingCycle: (sub?.billingCycle as FormValues['billingCycle']) ?? 'monthly',
      amountRupees: sub ? paiseToRupees(sub.amount) : paiseToRupees(plans[0]?.priceMonthly ?? 0),
      currency: sub?.currency ?? 'INR',
      paymentGateway: (sub?.paymentGateway as any) ?? '',
    },
  });

  const watchPlanId = watch('planId');
  const watchCycle = watch('billingCycle');

  // Auto-suggest amount when plan/cycle changes (only when creating)
  const suggested = useMemo(() => {
    if (sub) return null;
    const plan = plans.find((p) => p.id === watchPlanId);
    if (!plan) return null;
    return watchCycle === 'monthly'
      ? paiseToRupees(plan.priceMonthly)
      : paiseToRupees(plan.priceYearly);
  }, [sub, watchPlanId, watchCycle, plans]);

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={sub ? 'Edit subscription' : 'New subscription'}
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
            {saving ? 'Saving…' : sub ? 'Save changes' : 'Create subscription'}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field label="School" required error={errors.schoolId?.message}>
          <Select {...register('schoolId')}>
            <option value="">Select…</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Plan" required error={errors.planId?.message}>
          <Select {...register('planId')}>
            <option value="">Select…</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Billing cycle">
          <Select {...register('billingCycle')}>
            {CYCLES.map((c) => (
              <option key={c} value={c} className="capitalize">
                {c}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Amount (₹)"
          required
          error={errors.amountRupees?.message}
          hint={
            suggested != null
              ? `Suggested from plan: ₹${suggested.toLocaleString('en-IN')}`
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              step="0.01"
              {...register('amountRupees')}
            />
            {suggested != null && (
              <button
                type="button"
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                onClick={() => setValue('amountRupees', suggested)}
              >
                Use suggested
              </button>
            )}
          </div>
        </Field>

        <Field label="Status">
          <Select {...register('status')}>
            {SUB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Currency">
          <Input {...register('currency')} placeholder="INR" />
        </Field>

        <Field label="Payment gateway" className="sm:col-span-2">
          <Select {...register('paymentGateway')}>
            <option value="">— None —</option>
            {GATEWAYS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
        </Field>

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
