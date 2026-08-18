import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, LayoutGrid, LogIn, Plus, Shield, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import {
  CreateOrgGrantPayload,
  OrgAuthApi,
  OrgGrant,
  OrgPortalApi,
} from '@/services/org.api';
import { OrgUsersApi } from '@/services/orgUsers.api';
import { OrgRolesApi } from '@/services/orgRoles.api';
import { RoleView } from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Tabs } from '@/components/ui/Tabs';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { Field, Input, Select, Textarea, Checkbox } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';
import { toast } from '@/stores/toast.store';

const GRANT_ROLES = ['owner', 'admin', 'manager', 'teacher', 'staff', 'cashier'] as const;

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}

const TABS = [
  { key: 'overview' as const, label: 'Overview', icon: LayoutGrid },
  { key: 'roles' as const, label: 'Roles & Permissions', icon: ShieldCheck },
  { key: 'access' as const, label: 'Access', icon: KeyRound },
];
type Tab = (typeof TABS)[number]['key'];

export function SchoolDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const orgToken = useAuthStore((s) => s.orgToken);
  const enterSchoolSession = useAuthStore((s) => s.enterSchoolSession);
  const [tab, setTab] = useState<Tab>('overview');

  const { data: schools = [] } = useQuery({
    queryKey: ['org-schools'],
    queryFn: OrgPortalApi.listSchools,
  });
  const school = schools.find((s) => s.id === id);

  const { data: users = [] } = useQuery({
    queryKey: ['org-users', id],
    queryFn: () => OrgUsersApi.list({ schoolId: id }),
    enabled: !!id,
  });

  const enter = useMutation({
    mutationFn: () => OrgAuthApi.selectSchool(id, orgToken ?? ''),
    onSuccess: (session) => {
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

  if (!school) {
    return <div className="py-12 text-center text-slate-400">Loading…</div>;
  }

  return (
    <>
      <PageHeader
        title={school.name}
        description={`Login code ${school.code} · ${school.slug}`}
        actions={
          <button className="btn-primary" onClick={() => enter.mutate()} disabled={enter.isPending}>
            <LogIn className="mr-1.5 h-4 w-4" /> Enter school
          </button>
        }
      />

      <Tabs items={TABS} active={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SummaryCard label="Status" value={<Badge tone={school.status === 'active' ? 'green' : 'amber'}>{school.status}</Badge>} />
          <SummaryCard label="Email" value={school.email} />
          <SummaryCard label="Created" value={formatDate(school.createdAt)} />
          <SummaryCard label="Users with access" value={String(users.length)} />
          <SummaryCard label="Login code" value={<code className="font-mono">{school.code}</code>} />
          <SummaryCard label="Slug" value={<code className="text-xs">{school.slug}</code>} />
        </div>
      )}

      {tab === 'roles' && <RolesTab schoolId={id} />}
      {tab === 'access' && <AccessTab schoolId={id} />}
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

// ── Roles & Permissions ──────────────────────────────────────────────────────
const roleSchema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional().or(z.literal('')),
});
type RoleForm = z.infer<typeof roleSchema>;

function RolesTab({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleView | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['org-school-roles', schoolId],
    queryFn: () => OrgRolesApi.list(schoolId),
  });
  const { data: catalog } = useQuery({
    queryKey: ['org-school-role-catalog', schoolId],
    queryFn: () => OrgRolesApi.catalog(schoolId),
    enabled: open,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<RoleForm>({
    resolver: zodResolver(roleSchema),
    values: { name: editing?.name ?? '', description: editing?.description ?? '' },
  });

  const openCreate = () => {
    setEditing(null);
    setPermissions(new Set());
    setOpen(true);
  };
  const openEdit = (r: RoleView) => {
    setEditing(r);
    setPermissions(new Set(r.permissions));
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: (v: RoleForm) =>
      editing
        ? OrgRolesApi.update(schoolId, editing.id!, {
            name: v.name,
            description: v.description || undefined,
            permissions: [...permissions],
          })
        : OrgRolesApi.create(schoolId, {
            name: v.name,
            description: v.description || undefined,
            permissions: [...permissions],
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-school-roles', schoolId] });
      setOpen(false);
      toast.success(editing ? 'Role updated' : 'Role created');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => OrgRolesApi.remove(schoolId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-school-roles', schoolId] });
      toast.success('Role deleted');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const togglePerm = (p: string) =>
    setPermissions((prev) => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Add role
        </button>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.key} className="flex items-center justify-between rounded-md border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-900">
                    {r.name}
                    {r.isSystem && <Badge tone="slate">Built-in</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.permissions.length} permission(s) · {r.userCount} user(s)
                  </div>
                </div>
              </div>
              {!r.isSystem && (
                <div className="flex items-center gap-1">
                  <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => openEdit(r)}>
                    Edit
                  </button>
                  <button
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    onClick={() => remove.mutate(r.id!)}
                    disabled={r.userCount > 0 || remove.isPending}
                    title={r.userCount > 0 ? 'Reassign users before deleting' : 'Delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title={editing ? `Edit — ${editing.name}` : 'Add role'}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => save.mutate(v))} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Role name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="Exam Coordinator" />
          </Field>
          <Field label="Description" error={errors.description?.message}>
            <Textarea {...register('description')} rows={2} />
          </Field>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Permissions</label>
            {!catalog ? (
              <div className="py-4 text-center text-slate-400">Loading catalog…</div>
            ) : (
              <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-slate-200 p-3">
                {catalog.modules.map((m) => (
                  <div key={m.key}>
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {m.label}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {m.actions.map((a) => {
                        const perm = `${m.key}:${a}`;
                        return (
                          <Checkbox
                            key={perm}
                            label={a}
                            checked={permissions.has(perm)}
                            onChange={() => togglePerm(perm)}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Access ───────────────────────────────────────────────────────────────────
function AccessTab({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [addOpen, setAddOpen] = useState(false);

  const { data: grants = [], isLoading } = useQuery({
    queryKey: ['org-grants', schoolId],
    queryFn: () => OrgPortalApi.listGrants(schoolId),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => OrgPortalApi.revokeGrant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-grants', schoolId] });
      toast.success('Access revoked');
    },
  });

  const active = (grants as OrgGrant[]).filter((g) => g.status === 'active');
  const filtered = active.filter((g) => {
    if (roleFilter && g.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = g.userAccount?.name?.toLowerCase() ?? '';
      const email = g.userAccount?.email?.toLowerCase() ?? '';
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const pageRows = filtered.slice((page - 1) * limit, page * limit);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 min-w-[200px] rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <Select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="max-w-[160px]"
        >
          <option value="">All roles</option>
          {GRANT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <button className="btn-primary" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Add user
        </button>
      </div>

      <DataTable<OrgGrant>
        rows={pageRows}
        getRowId={(g) => g.id}
        isLoading={isLoading}
        emptyMessage="No one has been granted access yet."
        columns={[
          { key: 'user', header: 'User', render: (g) => (
            <div className="leading-tight">
              <div className="font-medium text-slate-900">{g.userAccount?.name ?? '—'}</div>
              <div className="text-xs text-slate-500">{g.userAccount?.email}</div>
            </div>
          ) },
          { key: 'role', header: 'Role', render: (g) => <Badge tone="blue">{g.role}</Badge> },
        ]}
        actions={(g) => (
          <button
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
            onClick={() => revoke.mutate(g.id)}
            disabled={revoke.isPending}
          >
            Revoke
          </button>
        )}
      />

      {filtered.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={filtered.length}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => { setLimit(l); setPage(1); }}
        />
      )}

      <AddUserModal schoolId={schoolId} open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}

function AddUserModal({
  schoolId,
  open,
  onClose,
}: {
  schoolId: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateOrgGrantPayload>({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1, 'Required'),
        email: z.string().email('Invalid email'),
        password: z.string().optional().or(z.literal('')),
        role: z.enum(GRANT_ROLES),
      }),
    ),
    values: { name: '', email: '', password: '', role: 'teacher' },
  });

  const add = useMutation({
    mutationFn: (p: CreateOrgGrantPayload) =>
      OrgPortalApi.grant(schoolId, { ...p, password: p.password || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-grants', schoolId] });
      reset();
      onClose();
      toast.success('User added');
    },
    onError: (e: any) => toast.error(errMsg(e) ?? 'Could not add user'),
  });

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Add user"
      description="Grant a person access to this school with a role. They log in via the multi-school account login."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn-primary" onClick={handleSubmit((v) => add.mutate(v))} disabled={add.isPending}>
            {add.isPending ? 'Adding…' : 'Add user'}
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
        <Field label="Role" error={errors.role?.message}>
          <Select {...register('role')}>
            {GRANT_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>
        <Field label="Password" hint="Only needed for a brand-new user" error={errors.password?.message}>
          <Input type="password" {...register('password')} placeholder="Min 8 chars (new users)" />
        </Field>
      </form>
    </Modal>
  );
}
