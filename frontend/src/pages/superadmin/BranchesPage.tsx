import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, MapPin, Star } from 'lucide-react';
import {
  Branch,
  BranchesApi,
  SchoolsApi,
} from '@/services/superadmin.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Checkbox } from '@/components/ui/Input';
import { formatLimit } from '@/lib/format';

const schema = z.object({
  schoolId: z.string().uuid('Required'),
  name: z.string().min(1, 'Required'),
  code: z
    .string()
    .min(1)
    .regex(/^[A-Z0-9-]+$/, 'Uppercase alphanumeric (- allowed)'),
  isPrimary: z.boolean(),
  status: z.enum(['active', 'inactive']),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pincode: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.string().email(), z.literal('')]).optional(),
  principalName: z.string().optional(),
  studentCapacity: z.coerce.number().int().min(0).optional(),
});
type FormValues = z.infer<typeof schema>;

export function BranchesPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>('');
  const [modal, setModal] = useState<{ open: boolean; branch?: Branch }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; branch?: Branch }>({
    open: false,
  });

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: SchoolsApi.list,
  });

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', filter],
    queryFn: () => BranchesApi.list(filter || undefined),
  });

  const upsert = useMutation({
    mutationFn: (vals: { id?: string; payload: Partial<Branch> }) =>
      vals.id
        ? BranchesApi.update(vals.id, vals.payload)
        : BranchesApi.create(vals.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'stats'] });
      setModal({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => BranchesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      qc.invalidateQueries({ queryKey: ['superadmin', 'stats'] });
      setConfirm({ open: false });
    },
  });

  return (
    <>
      <PageHeader
        title="Branches"
        description="Campuses / locations of each school. Schools can have multiple branches sharing one tenant schema."
        actions={
          <div className="flex items-center gap-2">
            <Select
              className="!w-56"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <button
              className="btn-primary"
              onClick={() => setModal({ open: true })}
              disabled={schools.length === 0}
              title={
                schools.length === 0
                  ? 'Create a school first'
                  : 'Add a new branch'
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> New branch
            </button>
          </div>
        }
      />

      <DataTable<Branch>
        rows={branches}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage={
          schools.length === 0
            ? 'Create a school first, then add its branches here.'
            : 'No branches yet.'
        }
        columns={[
          {
            key: 'name',
            header: 'Branch',
            render: (b) => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{b.name}</span>
                {b.isPrimary && (
                  <Badge tone="amber">
                    <Star className="-ml-0.5 mr-1 h-3 w-3 fill-current" /> Primary
                  </Badge>
                )}
              </div>
            ),
          },
          {
            key: 'code',
            header: 'Code',
            render: (b) => (
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium">
                {b.code}
              </code>
            ),
          },
          {
            key: 'school',
            header: 'School',
            render: (b) =>
              b.school ? (
                <Badge tone="blue">{b.school.name}</Badge>
              ) : (
                '—'
              ),
          },
          {
            key: 'location',
            header: 'Location',
            render: (b) =>
              b.city || b.state ? (
                <span className="inline-flex items-center gap-1 text-sm text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {[b.city, b.state].filter(Boolean).join(', ')}
                </span>
              ) : (
                '—'
              ),
          },
          {
            key: 'principal',
            header: 'Principal',
            render: (b) => b.principalName ?? '—',
          },
          {
            key: 'capacity',
            header: 'Capacity',
            render: (b) => formatLimit(b.studentCapacity),
          },
          {
            key: 'status',
            header: 'Status',
            render: (b) =>
              b.status === 'active' ? (
                <Badge tone="green">Active</Badge>
              ) : (
                <Badge tone="slate">Inactive</Badge>
              ),
          },
        ]}
        actions={(b) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, branch: b })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, branch: b })}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <BranchFormModal
        open={modal.open}
        branch={modal.branch}
        schools={schools.map((s) => ({ id: s.id, name: s.name }))}
        onClose={() => setModal({ open: false })}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onSubmit={(v) =>
          upsert.mutate({
            id: modal.branch?.id,
            payload: {
              ...v,
              email: v.email || undefined,
              studentCapacity: v.studentCapacity || undefined,
            } as Partial<Branch>,
          })
        }
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.branch && remove.mutate(confirm.branch.id)}
        loading={remove.isPending}
        title="Delete branch?"
        message={`Soft-delete branch "${confirm.branch?.name}" (${confirm.branch?.code}).`}
        confirmText="Delete branch"
      />
    </>
  );
}

function BranchFormModal({
  open,
  branch,
  schools,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  branch?: Branch;
  schools: { id: string; name: string }[];
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
      schoolId: branch?.schoolId ?? (schools[0]?.id ?? ''),
      name: branch?.name ?? '',
      code: branch?.code ?? '',
      isPrimary: branch?.isPrimary ?? false,
      status: (branch?.status as 'active' | 'inactive') ?? 'active',
      address: branch?.address ?? '',
      city: branch?.city ?? '',
      state: branch?.state ?? '',
      country: branch?.country ?? 'India',
      pincode: branch?.pincode ?? '',
      phone: branch?.phone ?? '',
      email: branch?.email ?? '',
      principalName: branch?.principalName ?? '',
      studentCapacity: branch?.studentCapacity ?? undefined,
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={branch ? `Edit ${branch.name}` : 'New branch'}
      description="A branch is a physical campus/location of a school."
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
            {saving ? 'Saving…' : branch ? 'Save changes' : 'Create branch'}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Field
          label="School"
          required
          error={errors.schoolId?.message}
          className="sm:col-span-2"
        >
          <Select {...register('schoolId')}>
            <option value="">Select school</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Branch name" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="Delhi Campus" />
        </Field>
        <Field
          label="Branch code"
          required
          hint="Unique per school (uppercase)"
          error={errors.code?.message}
        >
          <Input {...register('code')} placeholder="DEL" />
        </Field>

        <Field label="Principal name">
          <Input {...register('principalName')} />
        </Field>
        <Field
          label="Student capacity"
          error={errors.studentCapacity?.message}
        >
          <Input type="number" min={0} {...register('studentCapacity')} />
        </Field>

        <Field label="Phone">
          <Input {...register('phone')} />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>

        <Field label="Address" className="sm:col-span-2">
          <Input {...register('address')} />
        </Field>

        <Field label="City">
          <Input {...register('city')} />
        </Field>
        <Field label="State">
          <Input {...register('state')} />
        </Field>
        <Field label="Country">
          <Input {...register('country')} />
        </Field>
        <Field label="Pincode">
          <Input {...register('pincode')} />
        </Field>

        <Field label="Status">
          <Select {...register('status')}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </Field>
        <div className="flex items-center pt-7">
          <Checkbox
            label="Mark as primary branch (HQ)"
            {...register('isPrimary')}
          />
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
