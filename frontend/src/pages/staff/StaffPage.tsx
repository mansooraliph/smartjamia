import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Search, Upload } from 'lucide-react';
import { ExportFormat, RbacApi, Staff, StaffApi } from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { ImportModal } from '@/components/shared/ImportModal';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { formatDate, formatMoney, paiseToRupees, rupeesToPaise } from '@/lib/format';

const ROLES = ['admin', 'manager', 'teacher', 'staff', 'cashier'] as const;
const BUILTIN_ROLES = new Set<string>([...ROLES, 'owner']);
const STATUSES = ['active', 'on_leave', 'resigned', 'terminated'] as const;

const schema = z.object({
  // User
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  role: z.string().min(1, 'Required'), // built-in role name OR custom role key
  password: z.string().optional().or(z.literal('')),
  // Staff
  employeeId: z.string().min(1, 'Required'),
  designation: z.string().min(1, 'Required'),
  department: z.string().optional().or(z.literal('')),
  qualification: z.string().optional().or(z.literal('')),
  joiningDate: z.string().min(1, 'Required'),
  salaryRupees: z.coerce.number().min(0).optional(),
  bankAccount: z.string().optional().or(z.literal('')),
  bankIfsc: z.string().optional().or(z.literal('')),
  pan: z.string().optional().or(z.literal('')),
  aadhar: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  status: z.enum(STATUSES),
});
type FormValues = z.infer<typeof schema>;

const statusTone: Record<Staff['status'], 'green' | 'amber' | 'slate' | 'red'> = {
  active: 'green',
  on_leave: 'amber',
  resigned: 'slate',
  terminated: 'red',
};

const roleTone: Record<string, 'blue' | 'indigo' | 'purple' | 'slate'> = {
  admin: 'purple',
  manager: 'indigo',
  teacher: 'blue',
  staff: 'slate',
  cashier: 'indigo',
};

export function StaffPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; staff?: Staff }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; staff?: Staff }>({
    open: false,
  });
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [search, limit]);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['staff', page, limit, search],
    queryFn: () =>
      StaffApi.list({ page, limit, search: search || undefined }),
    placeholderData: keepPreviousData,
  });
  const staff = pageData?.items ?? [];

  const upsert = useMutation({
    mutationFn: (v: { id?: string; payload: Record<string, unknown> }) =>
      v.id ? StaffApi.update(v.id, v.payload) : StaffApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setModal({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => StaffApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setConfirm({ open: false });
    },
  });

  return (
    <>
      <PageHeader
        title="Staff"
        description="Teaching and non-teaching staff. Each entry creates a login user with the chosen role."
        actions={
          <div className="flex items-center gap-2">
            <ExportButtons
              onExport={(format: ExportFormat) =>
                StaffApi.export(format, { search: search || undefined })
              }
            />
            <button
              className="btn-secondary"
              onClick={() => setImportOpen(true)}
              title="Import staff from Excel"
            >
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </button>
            <button
              className="btn-primary"
              onClick={() => setModal({ open: true })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add staff
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, email, employee ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      <DataTable<Staff>
        rows={staff}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No staff added yet."
        columns={[
          {
            key: 'employeeId',
            header: 'Emp ID',
            render: (s) => (
              <code className="text-xs font-medium text-slate-700">
                {s.employeeId}
              </code>
            ),
          },
          {
            key: 'name',
            header: 'Name',
            render: (s) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">
                  {s.user?.name ?? '—'}
                </div>
                <div className="text-xs text-slate-500">{s.user?.email}</div>
              </div>
            ),
          },
          {
            key: 'role',
            header: 'Role',
            render: (s) => {
              const effective = s.user?.roleKey || s.user?.role;
              return (
                <Badge
                  tone={
                    s.user?.roleKey
                      ? 'green'
                      : roleTone[s.user?.role ?? 'staff'] ?? 'slate'
                  }
                >
                  {effective ?? '—'}
                </Badge>
              );
            },
          },
          {
            key: 'designation',
            header: 'Designation',
            render: (s) => (
              <div className="leading-tight">
                <div className="text-sm text-slate-700">{s.designation}</div>
                {s.department && (
                  <div className="text-xs text-slate-500">{s.department}</div>
                )}
              </div>
            ),
          },
          {
            key: 'joiningDate',
            header: 'Joined',
            render: (s) => formatDate(s.joiningDate),
          },
          {
            key: 'salary',
            header: 'Salary',
            render: (s) => (s.salary ? formatMoney(s.salary) : '—'),
          },
          {
            key: 'status',
            header: 'Status',
            render: (s) => <Badge tone={statusTone[s.status]}>{s.status}</Badge>,
          },
        ]}
        actions={(s) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, staff: s })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, staff: s })}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      {pageData && (
        <Pagination
          page={pageData.page}
          totalPages={pageData.totalPages}
          total={pageData.total}
          limit={pageData.limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ['staff'] });
          qc.invalidateQueries({ queryKey: ['school-stats'] });
        }}
        title="Import staff"
        description="Upload the .xlsx template. Each row creates a staff member and their login user."
        noun="staff member"
        onTemplate={() => StaffApi.importTemplate()}
        onPreview={(f) => StaffApi.importPreview(f)}
        onCommit={(f) => StaffApi.importCommit(f)}
      />

      <StaffFormModal
        open={modal.open}
        staff={modal.staff}
        onClose={() => setModal({ open: false })}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onSubmit={(v) =>
          upsert.mutate({
            id: modal.staff?.id,
            payload: {
              name: v.name,
              email: v.email,
              // Built-in role → set base enum; custom role → base 'staff' + roleKey.
              role: BUILTIN_ROLES.has(v.role) ? v.role : 'staff',
              roleKey: BUILTIN_ROLES.has(v.role) ? null : v.role,
              password: v.password || undefined,
              employeeId: v.employeeId,
              designation: v.designation,
              department: v.department || undefined,
              qualification: v.qualification || undefined,
              joiningDate: v.joiningDate,
              salary: v.salaryRupees ? rupeesToPaise(v.salaryRupees) : 0,
              bankAccount: v.bankAccount || undefined,
              bankIfsc: v.bankIfsc || undefined,
              pan: v.pan || undefined,
              aadhar: v.aadhar || undefined,
              address: v.address || undefined,
              status: v.status,
            },
          })
        }
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.staff && remove.mutate(confirm.staff.id)}
        loading={remove.isPending}
        title="Delete staff?"
        message={`Soft-delete ${confirm.staff?.user?.name ?? 'this staff'}. Their login account is disabled.`}
        confirmText="Delete staff"
      />
    </>
  );
}

function StaffFormModal({
  open,
  staff,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  staff?: Staff;
  onClose: () => void;
  onSubmit: (v: FormValues) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const isEdit = !!staff;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: staff?.user?.name ?? '',
      email: staff?.user?.email ?? '',
      role: staff?.user?.roleKey ?? staff?.user?.role ?? 'teacher',
      password: '',
      employeeId: staff?.employeeId ?? '',
      designation: staff?.designation ?? '',
      department: staff?.department ?? '',
      qualification: staff?.qualification ?? '',
      joiningDate: staff?.joiningDate?.slice(0, 10) ?? '',
      salaryRupees: staff ? paiseToRupees(staff.salary) : 0,
      bankAccount: staff?.bankAccount ?? '',
      bankIfsc: staff?.bankIfsc ?? '',
      pan: staff?.pan ?? '',
      aadhar: staff?.aadhar ?? '',
      address: staff?.address ?? '',
      status: (staff?.status as FormValues['status']) ?? 'active',
    },
  });

  const { data: allRoles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: RbacApi.roles,
  });
  const customRoles = allRoles.filter((r) => !r.isSystem);

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={staff ? `Edit ${staff.user?.name}` : 'New staff member'}
      description={
        isEdit
          ? 'Update staff details. Leave password blank to keep the existing one.'
          : 'Creates a user account with the chosen role and an employee record. Set a password to enable login.'
      }
      size="xl"
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
            {saving ? 'Saving…' : staff ? 'Save changes' : 'Create staff'}
          </button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <h4 className="mb-2 font-medium text-slate-900">Login account</h4>
        </div>

        <Field label="Full name" required error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="Role" required error={errors.role?.message}>
          <Select {...register('role')}>
            <optgroup label="Built-in">
              {ROLES.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </optgroup>
            {customRoles.length > 0 && (
              <optgroup label="Custom">
                {customRoles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>
        <Field
          label={isEdit ? 'Reset login password' : 'Login password'}
          hint={
            isEdit
              ? 'Leave blank to keep current. Set one to (re)enable their login.'
              : 'At least 8 characters. Required for this person to log in.'
          }
          error={errors.password?.message}
          className="sm:col-span-3"
        >
          <Input type="password" {...register('password')} placeholder="········" />
        </Field>

        <div className="sm:col-span-3 mt-2 border-t border-slate-200 pt-4">
          <h4 className="mb-2 font-medium text-slate-900">Employment</h4>
        </div>

        <Field label="Employee ID" required error={errors.employeeId?.message}>
          <Input {...register('employeeId')} placeholder="EMP001" />
        </Field>
        <Field label="Designation" required error={errors.designation?.message}>
          <Input {...register('designation')} placeholder="Senior Teacher" />
        </Field>
        <Field label="Department">
          <Input {...register('department')} placeholder="Science" />
        </Field>

        <Field label="Joining date" required error={errors.joiningDate?.message}>
          <Input type="date" {...register('joiningDate')} />
        </Field>
        <Field label="Monthly salary (₹)">
          <Input
            type="number"
            min={0}
            step="0.01"
            {...register('salaryRupees')}
          />
        </Field>
        <Field label="Status">
          <Select {...register('status')}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Qualification" className="sm:col-span-3">
          <Textarea rows={2} {...register('qualification')} />
        </Field>

        <div className="sm:col-span-3 mt-2 border-t border-slate-200 pt-4">
          <h4 className="mb-2 font-medium text-slate-900">KYC & Bank (optional)</h4>
        </div>

        <Field label="PAN">
          <Input {...register('pan')} placeholder="ABCDE1234F" />
        </Field>
        <Field label="Aadhaar">
          <Input {...register('aadhar')} placeholder="1234 5678 9012" />
        </Field>
        <Field label="Bank IFSC">
          <Input {...register('bankIfsc')} placeholder="HDFC0001234" />
        </Field>
        <Field label="Bank account">
          <Input {...register('bankAccount')} />
        </Field>
        <Field label="Address" className="sm:col-span-2">
          <Input {...register('address')} />
        </Field>

        {errorMsg && (
          <div className="sm:col-span-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
