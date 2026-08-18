import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, KeyRound, History, Trash2, X, Shield } from 'lucide-react';
import { OrgAdmin, OrgUser, OrgUsersApi, CreateOrgAdminPayload, CreateOrgUserPayload } from '@/services/orgUsers.api';
import { OrgPortalApi } from '@/services/org.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { formatDate, formatDateTime } from '@/lib/format';
import { toast } from '@/stores/toast.store';
import { roleLabel } from '@/lib/access';

const ROLES = ['owner', 'admin', 'manager', 'teacher', 'staff', 'cashier', 'student', 'parent'];

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}

type UsersTab = 'orgAdmins' | 'schoolUsers';
const USERS_TABS: TabItem<UsersTab>[] = [
  { key: 'orgAdmins', label: 'Org Admins' },
  { key: 'schoolUsers', label: 'School Users' },
];

export function UsersPage() {
  const [tab, setTab] = useState<UsersTab>('orgAdmins');

  return (
    <>
      <PageHeader
        title="Users"
        description="Every user across your organization &mdash; organization-level admins and school users."
      />

      <Tabs items={USERS_TABS} active={tab} onChange={setTab} />

      {tab === 'orgAdmins' && <OrgAdminsSection />}
      {tab === 'schoolUsers' && <SchoolUsersSection />}
    </>
  );
}

function SchoolUsersSection() {
  const [schoolFilter, setSchoolFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [activityFor, setActivityFor] = useState<OrgUser | null>(null);
  const [manageFor, setManageFor] = useState<OrgUser | null>(null);

  const { data: schools = [] } = useQuery({
    queryKey: ['org-schools'],
    queryFn: OrgPortalApi.listSchools,
  });
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['org-users', schoolFilter, roleFilter, statusFilter, search],
    queryFn: () =>
      OrgUsersApi.list({
        schoolId: schoolFilter || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      }),
  });

  const resetPassword = useMutation({
    mutationFn: (userId: string) => OrgUsersApi.resetPassword(userId),
    onSuccess: (r) => {
      if (r.temporaryPassword) {
        toast.success(`Temporary password: ${r.temporaryPassword}`);
      } else {
        toast.success('Password reset');
      }
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="max-w-xs">
          <option value="">All schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
        <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="max-w-[160px]">
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[160px]">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Create user
        </button>
      </div>

      <DataTable<OrgUser>
        rows={users}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No users match."
        columns={[
          { key: 'name', header: 'User', render: (u) => (
            <div className="leading-tight">
              <div className="font-medium text-slate-900">{u.name}</div>
              <div className="text-xs text-slate-500">{u.email}</div>
            </div>
          ) },
          { key: 'schools', header: 'Schools & roles', render: (u) => (
            <div className="flex flex-wrap gap-1">
              {u.grants.filter((g) => g.status === 'active').map((g) => (
                <Badge key={g.id} tone="indigo">{g.schoolName} · {roleLabel(g.role)}</Badge>
              ))}
            </div>
          ) },
          { key: 'status', header: 'Status', render: (u) => (
            <Badge tone={u.status === 'active' ? 'green' : 'slate'}>{u.status}</Badge>
          ) },
          { key: 'created', header: 'Created', render: (u) => formatDate(u.createdAt) },
        ]}
        actions={(u) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
              title="Manage school access"
              onClick={() => setManageFor(u)}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
              title="Reset password"
              onClick={() => resetPassword.mutate(u.id)}
              disabled={resetPassword.isPending}
            >
              <KeyRound className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
              title="Login activity"
              onClick={() => setActivityFor(u)}
            >
              <History className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <CreateUserModal
        open={createOpen}
        schools={schools}
        onClose={() => setCreateOpen(false)}
      />

      {activityFor && (
        <ActivityModal user={activityFor} onClose={() => setActivityFor(null)} />
      )}

      {manageFor && (
        <ManageAccessModal user={manageFor} schools={schools} onClose={() => setManageFor(null)} />
      )}
    </div>
  );
}

// ── Organization-level admins ─────────────────────────────────────────────────
// Distinct from school users above: these accounts log in at /org/login and
// manage the whole org, not scoped to a single school.
const createOrgAdminSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Min 8 characters'),
});
type CreateOrgAdminForm = z.infer<typeof createOrgAdminSchema>;

function OrgAdminsSection() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<OrgAdmin | null>(null);

  const { data: orgAdmins = [], isLoading } = useQuery({
    queryKey: ['org-admins'],
    queryFn: OrgUsersApi.listOrgAdmins,
  });

  const create = useMutation({
    mutationFn: (p: CreateOrgAdminPayload) => OrgUsersApi.createOrgAdmin(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-admins'] });
      setCreateOpen(false);
      toast.success('Organization admin created');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => OrgUsersApi.removeOrgAdmin(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-admins'] });
      setDeleting(null);
      toast.success('Organization admin removed');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateOrgAdminForm>({
    resolver: zodResolver(createOrgAdminSchema),
    values: { name: '', email: '', password: '' },
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-slate-900">
          <Shield className="h-4 w-4 text-brand-600" /> Organization admins
        </h2>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Create org admin
        </button>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Org-level accounts sign in at the organization login and manage every school &mdash; not scoped to one school.
      </p>
      <DataTable<OrgAdmin>
        rows={orgAdmins}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No organization admins yet."
        columns={[
          { key: 'name', header: 'Name', render: (a) => (
            <div className="leading-tight">
              <div className="font-medium text-slate-900">{a.name}</div>
              <div className="text-xs text-slate-500">{a.email}</div>
            </div>
          ) },
          { key: 'status', header: 'Status', render: (a) => (
            <Badge tone={a.status === 'active' ? 'green' : 'slate'}>{a.status}</Badge>
          ) },
          { key: 'created', header: 'Created', render: (a) => formatDate(a.createdAt) },
        ]}
        actions={(a) => (
          <button
            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
            title="Remove"
            onClick={() => setDeleting(a)}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Remove organization admin?"
        message={`Remove "${deleting?.name}". They will no longer be able to sign in.`}
        confirmText="Remove"
      />

      <Modal
        open={createOpen}
        onClose={() => { reset(); setCreateOpen(false); }}
        title="Create organization admin"
        description="This account gets full access to the organization portal, across every school."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => create.mutate(v))} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create org admin'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4">
          <Field label="Name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="Ramesh Kumar" />
          </Field>
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" {...register('email')} placeholder="ramesh@org.test" />
          </Field>
          <Field label="Password" required error={errors.password?.message}>
            <Input type="password" {...register('password')} placeholder="Min 8 characters" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

// ── Create user ──────────────────────────────────────────────────────────────
const grantSchema = z.object({ schoolId: z.string().min(1), role: z.string().min(1) });
const createUserSchema = z.object({
  name: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email'),
  password: z.string().optional().or(z.literal('')),
  grants: z.array(grantSchema).min(1, 'At least one school'),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

function CreateUserModal({
  open,
  schools,
  onClose,
}: {
  open: boolean;
  schools: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    values: { name: '', email: '', password: '', grants: [{ schoolId: '', role: 'teacher' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'grants' });

  const create = useMutation({
    mutationFn: (p: CreateOrgUserPayload) => OrgUsersApi.create(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-users'] });
      onClose();
      reset();
      toast.success('User created');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const submit = (v: CreateUserForm) =>
    create.mutate({ ...v, password: v.password || undefined });

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Create user"
      description="Assign this user to one or more schools with a role in each."
      size="lg"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit(submit)} disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create user'}
          </button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4">
        <Field label="Name" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="Anita Sharma" />
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" {...register('email')} placeholder="anita@user.test" />
        </Field>
        <Field label="Password" hint="Only needed if this email has no existing account" error={errors.password?.message}>
          <Input type="password" {...register('password')} placeholder="Min 8 chars (new users)" />
        </Field>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">School access</label>
            <button
              type="button"
              className="text-xs font-medium text-brand-600 hover:underline"
              onClick={() => append({ schoolId: '', role: 'teacher' })}
            >
              + Add school
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="flex items-center gap-2">
                <Select {...register(`grants.${i}.schoolId` as const)} className="flex-1">
                  <option value="">Select school…</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Select {...register(`grants.${i}.role` as const)} className="w-32">
                  {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </Select>
                {fields.length > 1 && (
                  <button type="button" className="p-1.5 text-slate-400 hover:text-red-600" onClick={() => remove(i)}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {errors.grants && <p className="mt-1 text-xs text-red-600">{errors.grants.message}</p>}
        </div>
      </form>
    </Modal>
  );
}

// ── Login activity ────────────────────────────────────────────────────────────
function ActivityModal({ user, onClose }: { user: OrgUser; onClose: () => void }) {
  const { data: activity = [], isLoading } = useQuery({
    queryKey: ['org-user-activity', user.id],
    queryFn: () => OrgUsersApi.activity(user.id),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Login activity — ${user.name}`}
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}
    >
      {isLoading ? (
        <div className="py-4 text-center text-slate-400">Loading…</div>
      ) : activity.length === 0 ? (
        <p className="text-sm text-slate-400">No login activity recorded yet.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5">Event</th>
              <th className="py-1.5">When</th>
              <th className="py-1.5">IP</th>
            </tr>
          </thead>
          <tbody>
            {activity.map((a) => (
              <tr key={a.id} className="border-t border-slate-100">
                <td className="py-2 capitalize">{a.event.replace('_', ' ')}</td>
                <td className="py-2 text-slate-500">{formatDateTime(a.createdAt)}</td>
                <td className="py-2 text-slate-500">{a.ipAddress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

// ── Manage school access ────────────────────────────────────────────────────────
function ManageAccessModal({
  user,
  schools,
  onClose,
}: {
  user: OrgUser;
  schools: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [schoolId, setSchoolId] = useState('');
  const [role, setRole] = useState('teacher');

  const invalidate = () => qc.invalidateQueries({ queryKey: ['org-users'] });

  const addGrant = useMutation({
    mutationFn: () => OrgUsersApi.addGrant(user.id, schoolId, role),
    onSuccess: () => {
      invalidate();
      setSchoolId('');
      toast.success('Access granted');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const revoke = useMutation({
    mutationFn: (grantId: string) => OrgUsersApi.revokeGrant(grantId),
    onSuccess: () => {
      invalidate();
      toast.success('Access revoked');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const active = user.grants.filter((g) => g.status === 'active');
  const availableSchools = schools.filter((s) => !active.some((g) => g.schoolId === s.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={`Manage access — ${user.name}`}
      size="lg"
      footer={<button className="btn-secondary" onClick={onClose}>Close</button>}
    >
      <div className="space-y-5">
        <div className="flex items-end gap-2 rounded-md border border-slate-200 p-3">
          <Field label="Add access to school" className="flex-1">
            <Select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">Select school…</option>
              {availableSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Role">
            <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-32">
              {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </Select>
          </Field>
          <button
            className="btn-primary"
            disabled={!schoolId || addGrant.isPending}
            onClick={() => addGrant.mutate()}
          >
            Grant
          </button>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5">School</th>
              <th className="py-1.5">Role</th>
              <th className="py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {active.map((g) => (
              <tr key={g.id} className="border-t border-slate-100">
                <td className="py-2">{g.schoolName}</td>
                <td className="py-2"><Badge tone="blue">{roleLabel(g.role)}</Badge></td>
                <td className="py-2 text-right">
                  <button
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => revoke.mutate(g.id)}
                    disabled={revoke.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
