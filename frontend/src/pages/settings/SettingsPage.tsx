import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Save,
  Check,
  Plus,
  Pencil,
  Trash2,
  Lock,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  RbacApi,
  RoleView,
  SettingsApi,
  Terminology,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Field, Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/cn';

type Tab = 'general' | 'roles';

export function SettingsPage() {
  const { can } = usePermissions();
  const [tab, setTab] = useState<Tab>('general');
  const canRoles = can('/roles', 'list');

  return (
    <>
      <PageHeader
        title="Settings"
        description="Academic terminology, roles & permissions, and more."
      />

      <div className="mb-5 flex gap-1 border-b border-slate-200">
        <TabBtn active={tab === 'general'} onClick={() => setTab('general')}>
          General
        </TabBtn>
        {canRoles && (
          <TabBtn active={tab === 'roles'} onClick={() => setTab('roles')}>
            Roles &amp; Permissions
          </TabBtn>
        )}
      </div>

      {tab === 'general' && <GeneralTab />}
      {tab === 'roles' && canRoles && <RolesTab />}
    </>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'border-b-2 px-4 py-2 text-sm font-medium transition',
        active
          ? 'border-brand-500 text-brand-600'
          : 'border-transparent text-slate-500 hover:text-slate-700',
      )}
    >
      {children}
    </button>
  );
}

// ───── General (terminology) ────────────────────────────────────────────────
const PRESETS: { label: string; value: Omit<Terminology, 'institutionType'> }[] = [
  { label: 'School (K-12)', value: { level: 'Class', levelPlural: 'Classes', group: 'Section', groupPlural: 'Sections' } },
  { label: 'College (semesters)', value: { level: 'Semester', levelPlural: 'Semesters', group: 'Batch', groupPlural: 'Batches' } },
  { label: 'College (years)', value: { level: 'Year', levelPlural: 'Years', group: 'Section', groupPlural: 'Sections' } },
  { label: 'Grades', value: { level: 'Grade', levelPlural: 'Grades', group: 'Division', groupPlural: 'Divisions' } },
];

function GeneralTab() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['terminology'], queryFn: SettingsApi.getTerminology });
  const [form, setForm] = useState<Terminology>({ level: '', levelPlural: '', group: '', groupPlural: '', institutionType: 'school' });
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: () => SettingsApi.setTerminology(form),
    onSuccess: (t) => {
      qc.setQueryData(['terminology'], t);
      qc.invalidateQueries({ queryKey: ['terminology'] });
    },
  });
  const set = (k: keyof Terminology, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <div className="mb-1 text-sm font-semibold text-slate-900">
          Institution type
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Colleges get an extra <b>Course / Program</b> layer above classes
          (grouped by UG/PG). Schools stay flat — classes directly under the
          academic year.
        </p>
        <div className="flex gap-2">
          {(['school', 'college'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set('institutionType', t)}
              className={
                'flex-1 rounded-lg border px-4 py-3 text-left transition ' +
                (form.institutionType === t
                  ? 'border-brand-400 bg-brand-50/50 ring-1 ring-brand-200'
                  : 'border-slate-200 hover:bg-slate-50')
              }
            >
              <div className="font-medium capitalize text-slate-900">{t}</div>
              <div className="text-xs text-slate-500">
                {t === 'school'
                  ? 'Class → Section'
                  : 'Course (UG/PG) → Class → Section'}
              </div>
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
          {save.isSuccess && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-1 text-sm font-semibold text-slate-900">Academic terminology</div>
      <p className="mb-4 text-sm text-slate-500">
        Tailor labels — schools use “Class / Section”, colleges may prefer
        “Semester / Batch”. Applied across navigation, tables and promotion.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50" onClick={() => setForm((f) => ({ ...p.value, institutionType: f.institutionType }))}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Level — singular" hint="e.g. Class, Semester, Grade">
          <Input value={form.level} onChange={(e) => set('level', e.target.value)} />
        </Field>
        <Field label="Level — plural">
          <Input value={form.levelPlural} onChange={(e) => set('levelPlural', e.target.value)} />
        </Field>
        <Field label="Group — singular" hint="e.g. Section, Batch, Division">
          <Input value={form.group} onChange={(e) => set('group', e.target.value)} />
        </Field>
        <Field label="Group — plural">
          <Input value={form.groupPlural} onChange={(e) => set('groupPlural', e.target.value)} />
        </Field>
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {save.isPending ? 'Saving…' : 'Save terminology'}
        </button>
        {save.isSuccess && (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <Check className="h-4 w-4" /> Saved
          </span>
        )}
      </div>
      </div>
    </div>
  );
}

// ───── Roles & Permissions ──────────────────────────────────────────────────
function RolesTab() {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const { data: roles = [], isLoading } = useQuery({ queryKey: ['roles'], queryFn: RbacApi.roles });
  const [editing, setEditing] = useState<RoleView | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<RoleView | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => RbacApi.deleteRole(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setToDelete(null);
    },
  });

  const canCreate = can('/roles', 'create');
  const canDelete = can('/roles', 'delete');

  return (
    <div className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Built-in roles are fixed. Create custom roles with their own permissions
          and assign them to staff.
        </p>
        {canCreate && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> New role
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-2">
          {roles.map((r) => (
            <div
              key={r.key}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', r.isSystem ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-600')}>
                  {r.isSystem ? <Lock className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{r.name}</span>
                    {r.isSystem ? (
                      <Badge tone="slate">Built-in</Badge>
                    ) : (
                      <Badge tone="blue">Custom</Badge>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}
                    <span className="mx-1.5 text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {r.userCount} user{r.userCount === 1 ? '' : 's'}
                    </span>
                    {r.description ? <> <span className="mx-1.5 text-slate-300">·</span>{r.description}</> : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(r)}
                  className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title={r.isSystem ? 'View permissions' : 'Edit role'}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                {!r.isSystem && canDelete && (
                  <button
                    onClick={() => setToDelete(r)}
                    className="rounded-md p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Delete role"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <RoleEditorModal
          role={editing}
          readOnly={!!editing?.isSystem || (editing ? !canCreate : false)}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`Delete role “${toDelete?.name}”?`}
        message={
          del.error
            ? errMsg(del.error)!
            : 'Users with this role must be reassigned first. This cannot be undone.'
        }
        confirmText="Delete"
        loading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id!)}
        onClose={() => {
          setToDelete(null);
          del.reset();
        }}
      />
    </div>
  );
}

function RoleEditorModal({
  role,
  readOnly,
  onClose,
}: {
  role: RoleView | null;
  readOnly: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: catalog } = useQuery({ queryKey: ['perm-catalog'], queryFn: RbacApi.catalog });
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions ?? []));

  const save = useMutation({
    mutationFn: () => {
      const payload = { name, description, permissions: [...perms] };
      return role?.id
        ? RbacApi.updateRole(role.id, payload)
        : RbacApi.createRole(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      onClose();
    },
  });

  const toggle = (key: string) =>
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const groups = useMemo(() => {
    const order: string[] = [];
    const byGroup: Record<string, NonNullable<typeof catalog>['modules']> = {};
    for (const m of catalog?.modules ?? []) {
      if (!byGroup[m.group]) { byGroup[m.group] = []; order.push(m.group); }
      byGroup[m.group].push(m);
    }
    return order.map((g) => ({ group: g, modules: byGroup[g] }));
  }, [catalog]);

  const title = role
    ? readOnly
      ? `${role.name} — permissions`
      : `Edit role — ${role.name}`
    : 'New role';

  return (
    <Modal open onClose={onClose} title={title} size="xl">
      <div className="space-y-4">
        {!readOnly && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Role name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front Desk" />
            </Field>
            <Field label="Description (optional)">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Reception & visitors" />
            </Field>
          </div>
        )}
        {readOnly && role?.description && (
          <p className="text-sm text-slate-500">{role.description}</p>
        )}

        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Module</th>
                {(['list', 'create', 'delete'] as const).map((a) => (
                  <th key={a} className="px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">{a}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {groups.map(({ group, modules }) => (
                <FragGroup key={group} group={group} modules={modules} perms={perms} readOnly={readOnly} onToggle={toggle} />
              ))}
            </tbody>
          </table>
        </div>

        {save.error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errMsg(save.error)}</div>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>{readOnly ? 'Close' : 'Cancel'}</button>
        {!readOnly && (
          <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            <Save className="mr-1.5 h-4 w-4" />
            {save.isPending ? 'Saving…' : role ? 'Save changes' : 'Create role'}
          </button>
        )}
      </div>
    </Modal>
  );
}

function FragGroup({
  group,
  modules,
  perms,
  readOnly,
  onToggle,
}: {
  group: string;
  modules: NonNullable<Awaited<ReturnType<typeof RbacApi.catalog>>>['modules'];
  perms: Set<string>;
  readOnly: boolean;
  onToggle: (key: string) => void;
}) {
  return (
    <>
      <tr className="bg-slate-50/60">
        <td colSpan={4} className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group}</td>
      </tr>
      {modules.map((m) => (
        <tr key={m.key} className="hover:bg-slate-50">
          <td className="px-4 py-2 text-slate-700">{m.label}</td>
          {(['list', 'create', 'delete'] as const).map((action) => {
            const supported = m.actions.includes(action);
            const key = `${m.key}:${action}`;
            return (
              <td key={action} className="px-4 py-2 text-center">
                {supported ? (
                  <input
                    type="checkbox"
                    checked={perms.has(key)}
                    disabled={readOnly}
                    onChange={() => onToggle(key)}
                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-400 disabled:opacity-50"
                  />
                ) : (
                  <span className="text-slate-200">—</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}
