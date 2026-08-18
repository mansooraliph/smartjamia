import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Plus,
  Trash2,
  School as SchoolIcon,
  Link2,
  Unlink,
  UserCog,
  KeyRound,
} from 'lucide-react';
import {
  CreateOrgAdminPayload,
  CreateSchoolPayload,
  OrgAdmin,
  OrgAdminsApi,
  Organization,
  OrganizationsApi,
  School,
  SchoolsApi,
} from '@/services/superadmin.api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Tabs } from '@/components/ui/Tabs';
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
  School['status'],
  'green' | 'amber' | 'red' | 'slate' | 'blue'
> = {
  trial: 'amber',
  active: 'green',
  grace_period: 'amber',
  suspended: 'red',
  cancelled: 'slate',
};

export function OrganizationDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'schools' | 'admins'>('schools');
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<School | null>(null);
  const [confirmDetach, setConfirmDetach] = useState<School | null>(null);

  const { data: org, isLoading: orgLoading } = useQuery({
    queryKey: ['organization', id],
    queryFn: () => OrganizationsApi.get(id),
    enabled: !!id,
  });

  const { data: schools = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ['org-schools', id],
    queryFn: () => SchoolsApi.listByOrg(id),
    enabled: !!id,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['organization', id] });
    qc.invalidateQueries({ queryKey: ['org-schools', id] });
    qc.invalidateQueries({ queryKey: ['organizations'] });
    qc.invalidateQueries({ queryKey: ['schools'] });
  };

  const create = useMutation({
    mutationFn: (payload: CreateSchoolPayload) => SchoolsApi.create(payload),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
    },
  });

  const remove = useMutation({
    mutationFn: (schoolId: string) => SchoolsApi.remove(schoolId),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
    },
  });

  const attach = useMutation({
    mutationFn: (schoolId: string) => OrganizationsApi.attachSchool(id, schoolId),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ['org-available-schools', id] });
      setAddOpen(false);
    },
  });

  const detach = useMutation({
    mutationFn: (schoolId: string) => OrganizationsApi.detachSchool(id, schoolId),
    onSuccess: () => {
      invalidate();
      setConfirmDetach(null);
    },
  });

  if (orgLoading || !org) {
    return (
      <div className="py-16 text-center text-slate-400">
        {orgLoading ? 'Loading…' : 'Organization not found.'}
      </div>
    );
  }

  const unlimited = org.maxSchoolsAllowed === -1;
  const full = !unlimited && org.schoolsUsed >= org.maxSchoolsAllowed;
  const limitMsg = `School limit reached (${org.schoolsUsed}/${org.maxSchoolsAllowed}). Increase the limit to add more.`;

  return (
    <>
      <button
        onClick={() => navigate('/superadmin/organizations')}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4" /> All organizations
      </button>

      {/* Header card */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">{org.name}</h1>
            <Badge tone={org.status === 'active' ? 'green' : 'slate'}>
              {org.status}
            </Badge>
          </div>
          <div className="mt-1 text-sm text-slate-500">
            {org.adminName ? `${org.adminName} · ` : ''}
            {org.adminEmail}
            {org.adminPhone ? ` · ${org.adminPhone}` : ''}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            Created {formatDate(org.createdAt)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wide text-slate-400">
            Schools
          </div>
          <div
            className={`text-2xl font-semibold ${full ? 'text-red-600' : 'text-slate-900'}`}
          >
            {org.schoolsUsed} / {unlimited ? '∞' : org.maxSchoolsAllowed}
          </div>
        </div>
      </div>

      <Tabs
        items={[
          { key: 'schools', label: 'Schools', icon: SchoolIcon },
          { key: 'admins', label: 'Organization Admins', icon: UserCog },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
      />

      {tab === 'schools' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Schools owned by this organization. Each has its own login code and
              isolated data.
            </p>
            <div className="flex items-center gap-2">
              <span title={full ? limitMsg : undefined}>
                <button
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setAddOpen(true)}
                  disabled={full || org.status !== 'active'}
                >
                  <Link2 className="mr-1.5 h-4 w-4" /> Add existing school
                </button>
              </span>
              <span title={full ? limitMsg : undefined}>
                <button
                  className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => setCreateOpen(true)}
                  disabled={full || org.status !== 'active'}
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Create school
                </button>
              </span>
            </div>
          </div>

          {full && (
            <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
              {limitMsg}
            </div>
          )}
          {org.status !== 'active' && (
            <div className="mb-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-600">
              This organization is inactive — reactivate it to add schools.
            </div>
          )}

          <DataTable<School>
            rows={schools}
            getRowId={(r) => r.id}
            isLoading={schoolsLoading}
            emptyMessage="No schools in this organization yet."
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
                  className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                  onClick={() => setConfirmDetach(s)}
                  title="Remove from organization"
                >
                  <Unlink className="h-4 w-4" />
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
        </>
      )}

      {tab === 'admins' && <OrgAdminsTab organizationId={id} />}

      <CreateSchoolModal
        open={createOpen}
        organization={org}
        saving={create.isPending}
        errorMsg={errMsg(create.error)}
        onClose={() => {
          setCreateOpen(false);
          create.reset();
        }}
        onSubmit={(payload) => create.mutate({ ...payload, organizationId: id })}
      />

      <AddExistingSchoolModal
        open={addOpen}
        organizationId={id}
        organizationName={org.name}
        attaching={attach.isPending}
        errorMsg={errMsg(attach.error)}
        onClose={() => {
          setAddOpen(false);
          attach.reset();
        }}
        onAttach={(schoolId) => attach.mutate(schoolId)}
      />

      <ConfirmDialog
        open={!!confirmDetach}
        onClose={() => setConfirmDetach(null)}
        onConfirm={() => confirmDetach && detach.mutate(confirmDetach.id)}
        loading={detach.isPending}
        destructive={false}
        title="Remove school from organization?"
        message={`"${confirmDetach?.name}" will become platform-direct (no organization) and free a slot. Its data and login are unchanged.`}
        confirmText="Remove from org"
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && remove.mutate(confirmDelete.id)}
        loading={remove.isPending}
        title="Delete school?"
        message={`Soft-delete "${confirmDelete?.name}". Data is retained but the school is hidden and frees a slot.`}
        confirmText="Delete school"
      />
    </>
  );
}

function AddExistingSchoolModal({
  open,
  organizationId,
  organizationName,
  onClose,
  onAttach,
  attaching,
  errorMsg,
}: {
  open: boolean;
  organizationId: string;
  organizationName: string;
  onClose: () => void;
  onAttach: (schoolId: string) => void;
  attaching: boolean;
  errorMsg?: string;
}) {
  const [search, setSearch] = useState('');
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['org-available-schools', organizationId],
    queryFn: () => OrganizationsApi.availableSchools(organizationId),
    enabled: open,
  });

  const filtered = schools.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Add existing school to ${organizationName}`}
      description="Only schools not already in an organization are listed. Adding one counts against this org's limit."
      size="lg"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="space-y-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code…"
          className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm"
        />
        {errorMsg && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}
        <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">
              No unassigned schools available.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="leading-tight">
                    <div className="text-sm font-medium text-slate-900">
                      {s.name}
                    </div>
                    <code className="text-xs text-slate-500">
                      {s.code} · {s.slug}
                    </code>
                  </div>
                  <button
                    className="btn-secondary !py-1 text-xs disabled:opacity-50"
                    onClick={() => onAttach(s.id)}
                    disabled={attaching}
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

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
    const any = vals.ownerName || vals.ownerEmail || vals.ownerPassword;
    if (!any) return;
    if (!vals.ownerName)
      ctx.addIssue({
        path: ['ownerName'],
        code: z.ZodIssueCode.custom,
        message: 'Required when creating admin',
      });
    if (!vals.ownerEmail)
      ctx.addIssue({
        path: ['ownerEmail'],
        code: z.ZodIssueCode.custom,
        message: 'Required when creating admin',
      });
    if (!vals.ownerPassword || vals.ownerPassword.length < 8)
      ctx.addIssue({
        path: ['ownerPassword'],
        code: z.ZodIssueCode.custom,
        message: 'At least 8 characters',
      });
  });
type SchoolFormValues = z.infer<typeof schoolSchema>;

function CreateSchoolModal({
  open,
  organization,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  organization: Organization;
  onClose: () => void;
  onSubmit: (payload: CreateSchoolPayload) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SchoolFormValues>({
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

  const submit = (v: SchoolFormValues) =>
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
      title={`Create school in ${organization.name}`}
      description="Code and slug auto-generate from the name when blank. The school admin logs in with the School Code + their email/password."
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
      <form
        onSubmit={handleSubmit(submit)}
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
          hint="UPPERCASE login code. Auto-generated if blank."
          error={errors.code?.message}
        >
          <Input
            {...register('code')}
            placeholder="SUNRISE"
            className="font-mono uppercase"
            style={{ textTransform: 'uppercase' }}
          />
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
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
          <h4 className="mb-1 font-medium text-slate-900">School admin</h4>
          <p className="text-xs text-slate-500">
            Creates the school’s own login (role <code>owner</code>) in its
            tenant database — separate from the organization admin.
          </p>
        </div>

        <Field label="Admin name" error={errors.ownerName?.message}>
          <Input {...register('ownerName')} placeholder="Principal Name" />
        </Field>
        <Field label="Admin email" error={errors.ownerEmail?.message}>
          <Input type="email" {...register('ownerEmail')} placeholder="admin@school.edu" />
        </Field>
        <Field
          label="Admin password"
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

        {errorMsg && (
          <div className="sm:col-span-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ── Organization Admins ────────────────────────────────────────────────────
function OrgAdminsTab({ organizationId }: { organizationId: string }) {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<OrgAdmin | null>(null);
  const [resettingFor, setResettingFor] = useState<OrgAdmin | null>(null);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['org-admins', organizationId],
    queryFn: () => OrgAdminsApi.list(organizationId),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['org-admins', organizationId] });

  const create = useMutation({
    mutationFn: (data: CreateOrgAdminPayload) => OrgAdminsApi.create(organizationId, data),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      toast.success('Organization admin created');
    },
  });

  const remove = useMutation({
    mutationFn: (adminId: string) => OrgAdminsApi.remove(adminId),
    onSuccess: () => {
      invalidate();
      setConfirmDelete(null);
      toast.success('Organization admin deleted');
    },
  });

  const resetPassword = useMutation({
    mutationFn: (adminId: string) => OrgAdminsApi.resetPassword(adminId),
    onSuccess: (r) => {
      setResettingFor(null);
      if (r.temporaryPassword) {
        toast.success(`Temporary password: ${r.temporaryPassword}`);
      } else {
        toast.success('Password reset');
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Admin logins for this organization. Any of them can sign in at the
          organization portal and manage all of this org's schools.
        </p>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Create admin
        </button>
      </div>

      <DataTable<OrgAdmin>
        rows={admins}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No organization admins yet."
        columns={[
          {
            key: 'name',
            header: 'Admin',
            render: (a) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">{a.name}</div>
                <div className="text-xs text-slate-500">{a.email}</div>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (a) => (
              <Badge tone={a.status === 'active' ? 'green' : 'slate'}>{a.status}</Badge>
            ),
          },
          { key: 'created', header: 'Created', render: (a) => formatDate(a.createdAt) },
        ]}
        actions={(a) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
              onClick={() => setResettingFor(a)}
              title="Reset password"
            >
              <KeyRound className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirmDelete(a)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <CreateOrgAdminModal
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
        title="Delete organization admin?"
        message={`"${confirmDelete?.name}" (${confirmDelete?.email}) will no longer be able to sign in to the organization portal.`}
        confirmText="Delete admin"
      />

      <ConfirmDialog
        open={!!resettingFor}
        onClose={() => setResettingFor(null)}
        onConfirm={() => resettingFor && resetPassword.mutate(resettingFor.id)}
        loading={resetPassword.isPending}
        destructive={false}
        title="Reset password?"
        message={`A new temporary password will be generated for "${resettingFor?.name}" (${resettingFor?.email}). Share it with them securely.`}
        confirmText="Reset password"
      />
    </>
  );
}

const orgAdminSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'At least 8 characters'),
});
type OrgAdminFormValues = z.infer<typeof orgAdminSchema>;

function CreateOrgAdminModal({
  open,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateOrgAdminPayload) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OrgAdminFormValues>({
    resolver: zodResolver(orgAdminSchema),
    values: { name: '', email: '', password: '' },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Create organization admin"
      description="This login can sign in at the organization portal and manage every school in this org."
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
            {saving ? 'Creating…' : 'Create admin'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4">
        <Field label="Name" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="Ramesh Kumar" />
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="ramesh@trust.org" />
        </Field>
        <Field label="Password" hint="At least 8 characters" required error={errors.password?.message}>
          <Input type="password" {...register('password')} placeholder="Min 8 chars" />
        </Field>

        {errorMsg && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
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
