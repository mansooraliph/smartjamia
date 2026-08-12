import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { School, SchoolsApi } from '@/services/superadmin.api';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select } from '@/components/ui/Input';

export const SCHOOL_STATUSES = [
  'trial',
  'active',
  'grace_period',
  'suspended',
  'cancelled',
] as const;

const schema = z
  .object({
    name: z.string().min(1, 'Required'),
    code: z
      .string()
      .regex(/^[A-Z0-9][A-Z0-9-]{0,49}$/, 'UPPERCASE, alphanumeric (- allowed)')
      .optional()
      .or(z.literal('')),
    slug: z
      .string()
      .regex(/^[a-z][a-z0-9-]{0,99}$/, 'lowercase, kebab-case')
      .optional()
      .or(z.literal('')),
    email: z.string().email('Invalid email'),
    phone: z.string().optional().or(z.literal('')),
    planId: z.string().uuid('Required').or(z.literal('')),
    status: z.enum(SCHOOL_STATUSES),
    ownerName: z.string().optional().or(z.literal('')),
    ownerEmail: z.union([z.string().email(), z.literal('')]).optional(),
    ownerPassword: z.string().optional().or(z.literal('')),
  })
  .superRefine((vals, ctx) => {
    const any = vals.ownerName || vals.ownerEmail || vals.ownerPassword;
    if (!any) return;
    if (!vals.ownerName) {
      ctx.addIssue({
        path: ['ownerName'],
        code: z.ZodIssueCode.custom,
        message: 'Required when creating owner',
      });
    }
    if (!vals.ownerEmail) {
      ctx.addIssue({
        path: ['ownerEmail'],
        code: z.ZodIssueCode.custom,
        message: 'Required when creating owner',
      });
    }
    if (!vals.ownerPassword || vals.ownerPassword.length < 8) {
      ctx.addIssue({
        path: ['ownerPassword'],
        code: z.ZodIssueCode.custom,
        message: 'At least 8 characters',
      });
    }
  });
export type SchoolFormValues = z.infer<typeof schema>;

export function SchoolFormModal({
  open,
  school,
  plans,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  school?: School;
  plans: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: SchoolFormValues) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const isEdit = !!school;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SchoolFormValues>({
    resolver: zodResolver(schema),
    values: {
      name: school?.name ?? '',
      code: school?.code ?? '',
      slug: school?.slug ?? '',
      email: school?.email ?? '',
      phone: school?.phone ?? '',
      planId: school?.planId ?? '',
      status: (school?.status as SchoolFormValues['status']) ?? 'trial',
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={school ? `Edit ${school.name}` : 'Onboard new school'}
      description={
        isEdit
          ? 'Update school details. To change the owner, manage users separately.'
          : 'Code and slug are auto-generated from the name when blank. Owner is created in the tenant database.'
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
            {saving ? 'Saving…' : school ? 'Save changes' : 'Create school'}
          </button>
        </>
      }
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
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
          hint="UPPERCASE — what owners type to log in (e.g. SUNRISE). Auto-generated if blank."
          error={errors.code?.message}
        >
          <Input
            {...register('code')}
            placeholder="SUNRISE"
            className="font-mono uppercase"
            style={{ textTransform: 'uppercase' }}
          />
        </Field>

        <Field
          label="URL Slug"
          hint="Lowercase kebab-case. Auto-generated if blank."
          error={errors.slug?.message}
        >
          <Input
            {...register('slug')}
            placeholder="sunrise-public-school"
            className="font-mono"
          />
        </Field>

        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>

        <Field label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} />
        </Field>

        <Field label="Plan" error={errors.planId?.message}>
          <Select {...register('planId')}>
            <option value="">— None —</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
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

        {!isEdit && (
          <>
            <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
              <h4 className="mb-1 font-medium text-slate-900">
                School admin (owner)
              </h4>
              <p className="text-xs text-slate-500">
                Creates a user with role <code>owner</code> in the tenant
                database. They can immediately sign in at <code>/login</code>{' '}
                using the School Code above.
              </p>
            </div>

            <Field label="Owner name" error={errors.ownerName?.message}>
              <Input {...register('ownerName')} placeholder="Principal Name" />
            </Field>
            <Field label="Owner email" error={errors.ownerEmail?.message}>
              <Input
                type="email"
                {...register('ownerEmail')}
                placeholder="owner@school.edu"
              />
            </Field>
            <Field
              label="Owner password"
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
          </>
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

export function OwnerModal({
  school,
  onClose,
  onSaved,
}: {
  school: School;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const { data: owner, isLoading } = useQuery({
    queryKey: ['school-owner', school.id],
    queryFn: () => SchoolsApi.getOwner(school.id),
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const hydrated = useRef(false);
  useEffect(() => {
    if (owner && !hydrated.current) {
      setName(owner.name ?? '');
      setEmail(owner.email ?? '');
      hydrated.current = true;
    }
  }, [owner]);

  const exists = !!owner;
  const save = useMutation({
    mutationFn: () =>
      SchoolsApi.setOwner(school.id, {
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        password: password || undefined,
      }),
    onSuccess: (r) =>
      onSaved(
        `${r.created ? 'Created' : 'Updated'} admin for ${school.name} — ${r.email}${password ? ' · password reset' : ''}.`,
      ),
  });

  const valid = exists
    ? Boolean(name.trim() || email.trim() || password)
    : Boolean(name.trim() && email.trim() && password.length >= 8);

  return (
    <Modal
      open
      onClose={onClose}
      title={`School admin — ${school.name ?? ''}`}
      description={`Login code: ${school.code ?? '—'}`}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-1.5"
            onClick={() => save.mutate()}
            disabled={save.isPending || !valid}
          >
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {exists ? 'Save changes' : 'Create admin'}
          </button>
        </>
      }
    >
      {isLoading ? (
        <div className="py-6 text-center text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {exists
              ? 'Change the admin’s name/email, or set a new password. Leave the password blank to keep the current one.'
              : 'No admin exists for this school yet. Create one — they log in with the School Code above + this email and password.'}
          </p>
          <Field label="Admin name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Principal Name"
            />
          </Field>
          <Field label="Login email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@school.edu"
            />
          </Field>
          <Field
            label={exists ? 'New password (optional)' : 'Password'}
            hint="At least 8 characters"
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={exists ? 'Leave blank to keep current' : 'Min 8 chars'}
            />
          </Field>
          {save.error && (
            <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {errMsg(save.error)}
            </div>
          )}
        </div>
      )}
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
