import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Star } from 'lucide-react';
import { Plan, PlansApi } from '@/services/superadmin.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Textarea, Checkbox } from '@/components/ui/Input';
import { formatLimit, formatMoney, paiseToRupees, rupeesToPaise } from '@/lib/format';

const planSchema = z.object({
  name: z.string().min(1, 'Required'),
  slug: z.string().regex(/^[a-z][a-z0-9-]{0,99}$/, 'lowercase, kebab-case'),
  description: z.string().optional(),
  priceMonthlyRupees: z.coerce.number().min(0),
  priceYearlyRupees: z.coerce.number().min(0),
  trialDays: z.coerce.number().int().min(0),
  maxUsers: z.coerce.number().int(),
  maxStudents: z.coerce.number().int(),
  maxStaff: z.coerce.number().int(),
  featuresCsv: z.string().optional(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  isCustom: z.boolean(),
  displayOrder: z.coerce.number().int(),
});
type FormValues = z.infer<typeof planSchema>;

export function PlansPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; plan?: Plan }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; plan?: Plan }>({
    open: false,
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans'],
    queryFn: PlansApi.list,
  });

  const upsert = useMutation({
    mutationFn: (vals: { id?: string; payload: Partial<Plan> }) =>
      vals.id
        ? PlansApi.update(vals.id, vals.payload)
        : PlansApi.create(vals.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'stats'] });
      setModal({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => PlansApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plans'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'stats'] });
      setConfirm({ open: false });
    },
  });

  return (
    <>
      <PageHeader
        title="Plans"
        description="Define pricing tiers, feature flags, and limits."
        actions={
          <button
            className="btn-primary"
            onClick={() => setModal({ open: true })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> New plan
          </button>
        }
      />

      <DataTable<Plan>
        rows={plans}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No plans yet. Create your first plan."
        columns={[
          {
            key: 'name',
            header: 'Plan',
            render: (p) => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{p.name}</span>
                {p.isFeatured && (
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                )}
                {p.isCustom && <Badge tone="purple">Custom</Badge>}
              </div>
            ),
          },
          {
            key: 'slug',
            header: 'Slug',
            render: (p) => (
              <code className="text-xs text-slate-600">{p.slug}</code>
            ),
          },
          {
            key: 'price',
            header: 'Monthly',
            render: (p) =>
              p.isCustom ? (
                <span className="text-slate-500">Custom</span>
              ) : (
                <span className="font-medium">{formatMoney(p.priceMonthly)}</span>
              ),
          },
          {
            key: 'yearly',
            header: 'Yearly',
            render: (p) =>
              p.isCustom ? '—' : formatMoney(p.priceYearly),
          },
          {
            key: 'students',
            header: 'Max Students',
            render: (p) => formatLimit(p.maxStudents),
          },
          {
            key: 'users',
            header: 'Max Users',
            render: (p) => formatLimit(p.maxUsers),
          },
          {
            key: 'features',
            header: 'Features',
            render: (p) => (
              <span className="text-xs text-slate-500">
                {p.features.length} enabled
              </span>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (p) =>
              p.isActive ? (
                <Badge tone="green">Active</Badge>
              ) : (
                <Badge tone="slate">Inactive</Badge>
              ),
          },
        ]}
        actions={(p) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, plan: p })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, plan: p })}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <PlanFormModal
        open={modal.open}
        plan={modal.plan}
        onClose={() => setModal({ open: false })}
        onSubmit={(vals) =>
          upsert.mutate({
            id: modal.plan?.id,
            payload: {
              name: vals.name,
              slug: vals.slug,
              description: vals.description || undefined,
              priceMonthly: rupeesToPaise(vals.priceMonthlyRupees),
              priceYearly: rupeesToPaise(vals.priceYearlyRupees),
              trialDays: vals.trialDays,
              maxUsers: vals.maxUsers,
              maxStudents: vals.maxStudents,
              maxStaff: vals.maxStaff,
              features: (vals.featuresCsv ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              isActive: vals.isActive,
              isFeatured: vals.isFeatured,
              isCustom: vals.isCustom,
              displayOrder: vals.displayOrder,
            },
          })
        }
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.plan && remove.mutate(confirm.plan.id)}
        loading={remove.isPending}
        title="Delete plan?"
        message={`This will permanently delete the plan "${confirm.plan?.name}". Schools currently on this plan won't be auto-migrated.`}
        confirmText="Delete plan"
      />
    </>
  );
}

function PlanFormModal({
  open,
  plan,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  plan?: Plan;
  onClose: () => void;
  onSubmit: (v: FormValues) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(planSchema),
    values: {
      name: plan?.name ?? '',
      slug: plan?.slug ?? '',
      description: plan?.description ?? '',
      priceMonthlyRupees: plan ? paiseToRupees(plan.priceMonthly) : 0,
      priceYearlyRupees: plan ? paiseToRupees(plan.priceYearly) : 0,
      trialDays: plan?.trialDays ?? 14,
      maxUsers: plan?.maxUsers ?? 5,
      maxStudents: plan?.maxStudents ?? 100,
      maxStaff: plan?.maxStaff ?? 10,
      featuresCsv: (plan?.features ?? []).join(', '),
      isActive: plan?.isActive ?? true,
      isFeatured: plan?.isFeatured ?? false,
      isCustom: plan?.isCustom ?? false,
      displayOrder: plan?.displayOrder ?? 0,
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={plan ? `Edit ${plan.name}` : 'New plan'}
      description="Pricing is entered in rupees; stored as paise."
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
            {saving ? 'Saving…' : plan ? 'Save changes' : 'Create plan'}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field label="Name" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="Starter" />
        </Field>
        <Field label="Slug" required error={errors.slug?.message}>
          <Input {...register('slug')} placeholder="starter" />
        </Field>

        <Field label="Description" className="sm:col-span-2">
          <Textarea {...register('description')} rows={2} />
        </Field>

        <Field
          label="Monthly price (₹)"
          required
          error={errors.priceMonthlyRupees?.message}
        >
          <Input type="number" min={0} step="0.01" {...register('priceMonthlyRupees')} />
        </Field>
        <Field
          label="Yearly price (₹)"
          required
          error={errors.priceYearlyRupees?.message}
        >
          <Input type="number" min={0} step="0.01" {...register('priceYearlyRupees')} />
        </Field>

        <Field label="Trial days" error={errors.trialDays?.message}>
          <Input type="number" min={0} {...register('trialDays')} />
        </Field>
        <Field label="Display order" error={errors.displayOrder?.message}>
          <Input type="number" {...register('displayOrder')} />
        </Field>

        <Field label="Max users" hint="-1 = unlimited" error={errors.maxUsers?.message}>
          <Input type="number" {...register('maxUsers')} />
        </Field>
        <Field
          label="Max students"
          hint="-1 = unlimited"
          error={errors.maxStudents?.message}
        >
          <Input type="number" {...register('maxStudents')} />
        </Field>
        <Field label="Max staff" hint="-1 = unlimited" error={errors.maxStaff?.message}>
          <Input type="number" {...register('maxStaff')} />
        </Field>

        <Field
          label="Features (comma separated)"
          className="sm:col-span-2"
          hint='e.g. "attendance, fees, sms_alerts"'
        >
          <Input {...register('featuresCsv')} />
        </Field>

        <div className="sm:col-span-2 flex flex-wrap items-center gap-6 pt-2">
          <Checkbox label="Active" {...register('isActive')} />
          <Checkbox label="Featured" {...register('isFeatured')} />
          <Checkbox label="Custom pricing" {...register('isCustom')} />
        </div>

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
