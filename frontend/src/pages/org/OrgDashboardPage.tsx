import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, LogIn, Eye } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import {
  CreateOrgSchoolPayload,
  OrgAuthApi,
  OrgPortalApi,
  OrgSchool,
} from '@/services/org.api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';
import { toast } from '@/stores/toast.store';

const SCHOOL_STATUSES = [
  'trial',
  'active',
  'grace_period',
  'suspended',
  'cancelled',
] as const;

const statusTone: Record<
  OrgSchool['status'],
  'green' | 'amber' | 'red' | 'slate'
> = {
  trial: 'amber',
  active: 'green',
  grace_period: 'amber',
  suspended: 'red',
  cancelled: 'slate',
};

export function OrgDashboardPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const enterSchoolSession = useAuthStore((s) => s.enterSchoolSession);
  const setOrgSchools = useAuthStore((s) => s.setOrgSchools);
  const orgToken = useAuthStore((s) => s.orgToken);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OrgSchool | null>(null);

  const { data: org } = useQuery({ queryKey: ['org-me'], queryFn: OrgPortalApi.me });
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['org-schools'],
    queryFn: OrgPortalApi.listSchools,
  });

  // Keep the in-school switcher's list current with the org's schools.
  useEffect(() => {
    if (schools.length === 0) return;
    setOrgSchools(
      schools.map((s) => ({
        schoolId: s.id,
        code: s.code,
        slug: s.slug,
        name: s.name,
        role: 'admin',
        status: s.status,
      })),
    );
  }, [schools, setOrgSchools]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['org-me'] });
    qc.invalidateQueries({ queryKey: ['org-schools'] });
  };

  const create = useMutation({
    mutationFn: (payload: CreateOrgSchoolPayload) => OrgPortalApi.createSchool(payload),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast.success('School created');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => OrgPortalApi.removeSchool(id),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
      toast.success('School deleted');
    },
  });

  const enter = useMutation({
    mutationFn: (schoolId: string) =>
      OrgAuthApi.selectSchool(schoolId, orgToken ?? ''),
    onSuccess: (session) => {
      // enterSchoolSession preserves the org origin context, so the school app
      // can offer a switcher + "Back to organization".
      enterSchoolSession({
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
      navigate('/dashboard');
    },
    onError: (e: any) => toast.error(errMsg(e) ?? 'Could not enter school'),
  });

  const unlimited = org?.maxSchoolsAllowed === -1;
  const full =
    !!org && !unlimited && org.schoolsUsed >= org.maxSchoolsAllowed;
  const limitMsg = org
    ? `School limit reached (${org.schoolsUsed}/${org.maxSchoolsAllowed}). Contact Super Admin to increase the limit.`
    : '';

  return (
    <>
      {/* Usage card */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-900">Schools</h1>
              {org && (
                <Badge tone={org.status === 'active' ? 'green' : 'slate'}>
                  {org.status}
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Create and manage the schools in your organization.
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-slate-400">
              Schools used
            </div>
            <div
              className={`text-2xl font-semibold ${full ? 'text-red-600' : 'text-slate-900'}`}
            >
              {org ? `${org.schoolsUsed} / ${unlimited ? '∞' : org.maxSchoolsAllowed}` : '—'}
            </div>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Each school has its own login code and isolated data.
          </p>
          <span title={full ? limitMsg : undefined}>
            <button
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setCreateOpen(true)}
              disabled={full || org?.status !== 'active'}
            >
              <Plus className="mr-1.5 h-4 w-4" /> Create school
            </button>
          </span>
        </div>

        {full && (
          <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {limitMsg}
          </div>
        )}

        <DataTable<OrgSchool>
          rows={schools}
          getRowId={(r) => r.id}
          isLoading={isLoading}
          emptyMessage="No schools yet. Create your first one."
          columns={[
            {
              key: 'name',
              header: 'School',
              render: (s) => (
                <button
                  type="button"
                  className="leading-tight text-left hover:underline"
                  onClick={() => navigate(`/org/schools/${s.id}`)}
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
                <code className="rounded bg-slate-50 px-2 py-0.5 font-mono text-sm font-semibold">
                  {s.code}
                </code>
              ),
            },
            { key: 'email', header: 'Email' },
            {
              key: 'status',
              header: 'Status',
              render: (s) => (
                <Badge tone={statusTone[s.status] ?? 'slate'}>{s.status}</Badge>
              ),
            },
            {
              key: 'created',
              header: 'Created',
              render: (s) => formatDate(s.createdAt),
            },
          ]}
          actions={(s) => (
            <>
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => navigate(`/org/schools/${s.id}`)}
                title="View details"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50"
                onClick={() => enter.mutate(s.id)}
                disabled={enter.isPending}
                title="Enter school (open its dashboard)"
              >
                <LogIn className="h-4 w-4" />
              </button>
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                onClick={() => setConfirmDelete(s)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        />

      <CreateSchoolModal
        open={createOpen}
        saving={create.isPending}
        errorMsg={errMsg(create.error)}
        onClose={() => {
          setCreateOpen(false);
          create.reset();
        }}
        onSubmit={(payload) => create.mutate(payload)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
        loading={remove.isPending}
        title="Delete school?"
        message={`Soft-delete "${confirmDelete?.name}". It frees a slot against your limit.`}
        confirmText="Delete school"
      />
    </>
  );
}

// ── Create school ────────────────────────────────────────────────────────────
const schoolSchema = z
  .object({
    name: z.string().min(1, 'Required'),
    code: z
      .string()
      .regex(/^[A-Z0-9][A-Z0-9-]{0,49}$/, 'UPPERCASE, alphanumeric (- allowed)')
      .optional()
      .or(z.literal('')),
    email: z.string().email('Invalid email'),
    phone: z.string().optional().or(z.literal('')),
    status: z.enum(SCHOOL_STATUSES),
    ownerName: z.string().optional().or(z.literal('')),
    ownerEmail: z.union([z.string().email(), z.literal('')]).optional(),
    ownerPassword: z.string().optional().or(z.literal('')),
  })
  .superRefine((vals, ctx) => {
    if (!(vals.ownerName || vals.ownerEmail || vals.ownerPassword)) return;
    if (!vals.ownerName)
      ctx.addIssue({ path: ['ownerName'], code: z.ZodIssueCode.custom, message: 'Required' });
    if (!vals.ownerEmail)
      ctx.addIssue({ path: ['ownerEmail'], code: z.ZodIssueCode.custom, message: 'Required' });
    if (!vals.ownerPassword || vals.ownerPassword.length < 8)
      ctx.addIssue({
        path: ['ownerPassword'],
        code: z.ZodIssueCode.custom,
        message: 'At least 8 characters',
      });
  });
type SchoolForm = z.infer<typeof schoolSchema>;

function CreateSchoolModal({
  open,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (p: CreateOrgSchoolPayload) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SchoolForm>({
    resolver: zodResolver(schoolSchema),
    values: {
      name: '',
      code: '',
      email: '',
      phone: '',
      status: 'trial',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
    },
  });

  const submit = (v: SchoolForm) =>
    onSubmit({
      name: v.name,
      code: v.code ? v.code.toUpperCase() : undefined,
      email: v.email,
      phone: v.phone || undefined,
      status: v.status,
      ownerName: v.ownerName || undefined,
      ownerEmail: v.ownerEmail || undefined,
      ownerPassword: v.ownerPassword || undefined,
    });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Create school"
      description="The school admin logs in with the School Code + their email/password."
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit(submit)}
            disabled={saving}
          >
            {saving ? 'Creating…' : 'Create school'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="School name" required error={errors.name?.message} className="sm:col-span-2">
          <Input {...register('name')} placeholder="Sunrise Public School" />
        </Field>
        <Field label="School Code" hint="Auto-generated if blank." error={errors.code?.message}>
          <Input {...register('code')} placeholder="SUNRISE" className="font-mono uppercase" style={{ textTransform: 'uppercase' }} />
        </Field>
        <Field label="Contact number" error={errors.phone?.message}>
          <Input {...register('phone')} placeholder="+91…" />
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="Status" error={errors.status?.message}>
          <Select {...register('status')}>
            {SCHOOL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Field>
        <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
          <h4 className="mb-1 font-medium text-slate-900">School admin</h4>
          <p className="text-xs text-slate-500">
            Optional — creates the school’s own login (role <code>owner</code>).
          </p>
        </div>
        <Field label="Admin name" error={errors.ownerName?.message}>
          <Input {...register('ownerName')} placeholder="Principal Name" />
        </Field>
        <Field label="Admin email" error={errors.ownerEmail?.message}>
          <Input type="email" {...register('ownerEmail')} placeholder="admin@school.edu" />
        </Field>
        <Field label="Admin password" hint="At least 8 characters" error={errors.ownerPassword?.message} className="sm:col-span-2">
          <Input type="password" {...register('ownerPassword')} placeholder="Min 8 chars" />
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
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}
