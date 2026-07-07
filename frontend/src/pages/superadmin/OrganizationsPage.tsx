import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import {
  CreateOrganizationPayload,
  Organization,
  OrganizationsApi,
  UpdateOrganizationPayload,
} from '@/services/superadmin.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Checkbox } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';

/** "3 / 5" or "3 / ∞" for unlimited. */
function usageLabel(o: Organization): string {
  return `${o.schoolsUsed} / ${o.maxSchoolsAllowed === -1 ? '∞' : o.maxSchoolsAllowed}`;
}
function isFull(o: Organization): boolean {
  return o.maxSchoolsAllowed !== -1 && o.schoolsUsed >= o.maxSchoolsAllowed;
}

const schema = z.object({
  name: z.string().min(1, 'Required'),
  adminName: z.string().optional().or(z.literal('')),
  adminEmail: z.string().email('Invalid email'),
  adminPhone: z.string().optional().or(z.literal('')),
  maxSchoolsAllowed: z.coerce
    .number()
    .int('Whole number')
    .min(-1, '-1 (unlimited) or higher'),
  status: z.enum(['active', 'inactive']),
  adminPassword: z
    .union([z.string().min(8, 'At least 8 characters'), z.literal('')])
    .optional(),
  force: z.boolean().optional(),
});
type FormValues = z.infer<typeof schema>;

export function OrganizationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [modal, setModal] = useState<{ open: boolean; org?: Organization }>({
    open: false,
  });
  const [confirmDelete, setConfirmDelete] = useState<Organization | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Organization | null>(
    null,
  );

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['organizations'],
    queryFn: OrganizationsApi.list,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['organizations'] });
    qc.invalidateQueries({ queryKey: ['schools'] });
  };

  const upsert = useMutation({
    mutationFn: (vals: {
      id?: string;
      payload: CreateOrganizationPayload | UpdateOrganizationPayload;
    }) =>
      vals.id
        ? OrganizationsApi.update(vals.id, vals.payload)
        : OrganizationsApi.create(vals.payload as CreateOrganizationPayload),
    onSuccess: () => {
      invalidate();
      setModal({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => OrganizationsApi.remove(id),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) => OrganizationsApi.activate(id),
    onSuccess: invalidate,
  });

  return (
    <>
      <PageHeader
        title="Organizations"
        description="Groups that own schools. Each organization has a cap on how many schools it can create."
        actions={
          <button className="btn-primary" onClick={() => setModal({ open: true })}>
            <Plus className="mr-1.5 h-4 w-4" /> Create organization
          </button>
        }
      />

      <DataTable<Organization>
        rows={orgs}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No organizations yet."
        columns={[
          {
            key: 'name',
            header: 'Organization',
            render: (o) => (
              <button
                onClick={() => navigate(`/superadmin/organizations/${o.id}`)}
                className="text-left leading-tight"
              >
                <div className="font-medium text-slate-900 hover:text-brand-600">
                  {o.name}
                </div>
                <div className="text-xs text-slate-500">{o.adminEmail}</div>
              </button>
            ),
          },
          {
            key: 'admin',
            header: 'Admin',
            render: (o) => (
              <div className="leading-tight">
                <div className="text-slate-700">{o.adminName ?? '—'}</div>
                {o.adminPhone && (
                  <div className="text-xs text-slate-500">{o.adminPhone}</div>
                )}
              </div>
            ),
          },
          {
            key: 'schools',
            header: 'Schools',
            render: (o) => (
              <Badge tone={isFull(o) ? 'red' : 'blue'}>{usageLabel(o)}</Badge>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (o) => (
              <Badge tone={o.status === 'active' ? 'green' : 'slate'}>
                {o.status}
              </Badge>
            ),
          },
          {
            key: 'created',
            header: 'Created',
            render: (o) => formatDate(o.createdAt),
          },
        ]}
        actions={(o) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => navigate(`/superadmin/organizations/${o.id}`)}
              title="Open — manage schools"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, org: o })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            {o.status === 'active' ? (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                onClick={() => setDeactivateTarget(o)}
                title="Deactivate"
              >
                <PowerOff className="h-4 w-4" />
              </button>
            ) : (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                onClick={() => activate.mutate(o.id)}
                disabled={activate.isPending}
                title="Activate"
              >
                <Power className="h-4 w-4" />
              </button>
            )}
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirmDelete(o)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <OrgFormModal
        open={modal.open}
        org={modal.org}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onClose={() => {
          setModal({ open: false });
          upsert.reset();
        }}
        onSubmit={(v) =>
          upsert.mutate({
            id: modal.org?.id,
            payload: {
              name: v.name,
              adminName: v.adminName || undefined,
              adminEmail: v.adminEmail,
              adminPhone: v.adminPhone || undefined,
              maxSchoolsAllowed: v.maxSchoolsAllowed,
              status: v.status,
              ...(modal.org && v.force ? { force: true } : {}),
              ...(!modal.org && v.adminPassword
                ? { adminPassword: v.adminPassword }
                : {}),
            },
          })
        }
      />

      {deactivateTarget && (
        <DeactivateModal
          org={deactivateTarget}
          onClose={() => setDeactivateTarget(null)}
          onDone={() => {
            invalidate();
            setDeactivateTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
        loading={remove.isPending}
        title="Delete organization?"
        message={`Soft-delete "${confirmDelete?.name}". Its schools are kept but are no longer linked to an organization.`}
        confirmText="Delete organization"
      />
    </>
  );
}

function OrgFormModal({
  open,
  org,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  org?: Organization;
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
    resolver: zodResolver(schema),
    values: {
      name: org?.name ?? '',
      adminName: org?.adminName ?? '',
      adminEmail: org?.adminEmail ?? '',
      adminPhone: org?.adminPhone ?? '',
      maxSchoolsAllowed: org?.maxSchoolsAllowed ?? 5,
      status: org?.status ?? 'active',
      adminPassword: '',
      force: false,
    },
  });

  // Backend rejects lowering the limit below current usage unless forced.
  const needsForce = !!org && /confirmation/i.test(errorMsg ?? '');

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={org ? `Edit ${org.name}` : 'Create organization'}
      description={
        org
          ? 'Update organization details and the school limit.'
          : 'An organization groups schools and caps how many can be created.'
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
            {saving ? 'Saving…' : org ? 'Save changes' : 'Create organization'}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field
          label="Organization name"
          required
          error={errors.name?.message}
          className="sm:col-span-2"
        >
          <Input {...register('name')} placeholder="Sunrise Education Trust" />
        </Field>

        <Field label="Admin name" error={errors.adminName?.message}>
          <Input {...register('adminName')} placeholder="Ramesh Kumar" />
        </Field>

        <Field label="Admin email" required error={errors.adminEmail?.message}>
          <Input type="email" {...register('adminEmail')} placeholder="admin@org.com" />
        </Field>

        <Field label="Admin phone" error={errors.adminPhone?.message}>
          <Input {...register('adminPhone')} placeholder="+91…" />
        </Field>

        <Field
          label="Max schools allowed"
          hint="-1 = unlimited"
          required
          error={errors.maxSchoolsAllowed?.message}
        >
          <Input type="number" {...register('maxSchoolsAllowed')} min={-1} />
        </Field>

        {!org && (
          <Field
            label="Admin password"
            hint="Optional — sets the org admin login (admin email above). Leave blank to add it later."
            error={errors.adminPassword?.message}
            className="sm:col-span-2"
          >
            <Input
              type="password"
              {...register('adminPassword')}
              placeholder="Min 8 chars — enables /org/login"
            />
          </Field>
        )}

        {org && (
          <Field label="Status" error={errors.status?.message}>
            <Select {...register('status')}>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          </Field>
        )}

        {needsForce && (
          <div className="sm:col-span-2">
            <Checkbox
              {...register('force')}
              label="Lower the limit anyway (below the current school count)"
            />
          </div>
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

function DeactivateModal({
  org,
  onClose,
  onDone,
}: {
  org: Organization;
  onClose: () => void;
  onDone: () => void;
}) {
  const [suspendSchools, setSuspendSchools] = useState(false);
  const deactivate = useMutation({
    mutationFn: () => OrganizationsApi.deactivate(org.id, suspendSchools),
    onSuccess: onDone,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Deactivate ${org.name}?`}
      description="Choose how far the deactivation reaches. This is reversible."
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={() => deactivate.mutate()}
            disabled={deactivate.isPending}
          >
            {deactivate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Deactivate
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          The organization admin will be locked out and no new schools can be
          created under it.
        </p>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 p-3 hover:bg-slate-50">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={suspendSchools}
            onChange={(e) => setSuspendSchools(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-medium text-slate-900">
              Also suspend all {org.schoolsUsed} school(s)
            </span>
            <span className="block text-slate-500">
              Blocks every login to those schools. Leave unchecked to let existing
              schools keep running.
            </span>
          </span>
        </label>
        {deactivate.error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errMsg(deactivate.error)}
          </div>
        )}
      </div>
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
