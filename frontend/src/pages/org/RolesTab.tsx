import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Shield, Trash2, RotateCcw } from 'lucide-react';
import { OrgRolesApi } from '@/services/orgRoles.api';
import { RoleView } from '@/services/school.api';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Textarea, Checkbox } from '@/components/ui/Input';
import { toast } from '@/stores/toast.store';

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}

const roleSchema = z.object({
  name: z.string().min(1, 'Required'),
  description: z.string().optional().or(z.literal('')),
});
type RoleForm = z.infer<typeof roleSchema>;

/** A school's roles & permissions, managed on the org admin's behalf — both
 *  custom roles and per-school overrides of built-in role permissions.
 *  Reused from both the per-school detail page and the org-wide Settings page. */
export function RolesTab({ schoolId }: { schoolId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleView | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const isSystemEdit = !!editing?.isSystem;

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
      isSystemEdit
        ? OrgRolesApi.updateSystemRole(schoolId, editing!.key, [...permissions])
        : editing
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

  const resetSystem = useMutation({
    mutationFn: (key: string) => OrgRolesApi.resetSystemRole(schoolId, key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['org-school-roles', schoolId] });
      toast.success('Reverted to default permissions');
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
                    {r.isCustomized && <Badge tone="amber">Customized</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {r.permissions.length} permission(s) · {r.userCount} user(s)
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => openEdit(r)}>
                  {r.isSystem ? 'Edit permissions' : 'Edit'}
                </button>
                {r.isSystem && r.isCustomized && (
                  <button
                    className="rounded-md p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                    onClick={() => resetSystem.mutate(r.key)}
                    disabled={resetSystem.isPending}
                    title="Reset to default permissions"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                {!r.isSystem && (
                  <button
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    onClick={() => remove.mutate(r.id!)}
                    disabled={r.userCount > 0 || remove.isPending}
                    title={r.userCount > 0 ? 'Reassign users before deleting' : 'Delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title={isSystemEdit ? `Edit permissions — ${editing!.name}` : editing ? `Edit — ${editing.name}` : 'Add role'}
        description={isSystemEdit ? 'Built-in role — name is fixed, only permissions can be customized for this school.' : undefined}
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button
              type="button"
              className="btn-primary"
              onClick={isSystemEdit ? () => save.mutate({ name: '', description: '' }) : handleSubmit((v) => save.mutate(v))}
              disabled={save.isPending}
            >
              {save.isPending ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {!isSystemEdit && (
            <>
              <Field label="Role name" required error={errors.name?.message}>
                <Input {...register('name')} placeholder="Exam Coordinator" />
              </Field>
              <Field label="Description" error={errors.description?.message}>
                <Textarea {...register('description')} rows={2} />
              </Field>
            </>
          )}

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
