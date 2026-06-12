import { useEffect, useMemo, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Upload, KeyRound } from 'lucide-react';
import {
  ExportFormat,
  Parent,
  ParentRelation,
  ParentsApi,
  StudentsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Input';
import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '@/lib/phone';
import { ImportModal } from '@/components/shared/ImportModal';
import { PortalPinModal } from '@/components/shared/PortalPinModal';

const RELATIONS: ParentRelation[] = ['father', 'mother', 'guardian'];

const relationTone: Record<ParentRelation, 'blue' | 'purple' | 'slate'> = {
  father: 'blue',
  mother: 'purple',
  guardian: 'slate',
};

const schema = z.object({
  studentId: z.string().uuid('Select a student'),
  relation: z.enum(['father', 'mother', 'guardian']),
  name: z.string().min(1, 'Required'),
  phoneCountryCode: z.string(),
  phone: z.string().min(1, 'Required'),
  whatsappSameAsMobile: z.boolean(),
  whatsappCountryCode: z.string(),
  whatsapp: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  occupation: z.string().optional().or(z.literal('')),
  annualIncome: z.coerce.number().min(0).optional(),
  aadharNumber: z.string().optional().or(z.literal('')),
  isPrimary: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function ParentsPage() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState(
    params.get('student') ?? '',
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => {
    setPage(1);
  }, [search, studentFilter, limit]);

  const { data: studentOptions = [] } = useQuery({
    queryKey: ['students', 'lookup-for-parents'],
    queryFn: () => StudentsApi.lookup({}),
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['parents', page, limit, search, studentFilter],
    queryFn: () =>
      ParentsApi.list({
        page,
        limit,
        search: search || undefined,
        studentId: studentFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const parents = pageData?.items ?? [];

  const [modal, setModal] = useState<{ open: boolean; parent?: Parent }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; parent?: Parent }>({
    open: false,
  });
  const [importOpen, setImportOpen] = useState(false);
  const [pinModal, setPinModal] = useState<{ open: boolean; parent?: Parent }>({
    open: false,
  });

  const setPin = useMutation({
    mutationFn: (v: { id: string; pin: string }) =>
      ParentsApi.setPin(v.id, v.pin),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      setPinModal({ open: false });
    },
  });
  const removePin = useMutation({
    mutationFn: (id: string) => ParentsApi.removePin(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      setPinModal({ open: false });
    },
  });

  const upsert = useMutation({
    mutationFn: (v: { id?: string; payload: Record<string, unknown> }) =>
      v.id ? ParentsApi.update(v.id, v.payload) : ParentsApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      setModal({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => ParentsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parents'] });
      setConfirm({ open: false });
    },
  });

  const studentLabel = useMemo(
    () =>
      Object.fromEntries(
        studentOptions.map((s) => [
          s.id,
          `${s.admissionNumber} · ${s.firstName} ${s.lastName}`,
        ]),
      ),
    [studentOptions],
  );

  return (
    <>
      <PageHeader
        title="Parents & Guardians"
        description="Contact records linked to students. One primary guardian per student."
        actions={
          <div className="flex items-center gap-2">
            <ExportButtons
              onExport={(format: ExportFormat) =>
                ParentsApi.export(format, {
                  search: search || undefined,
                  studentId: studentFilter || undefined,
                })
              }
            />
            <button
              className="btn-secondary"
              onClick={() => setImportOpen(true)}
              title="Import parents from Excel"
            >
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </button>
            <button
              className="btn-primary"
              onClick={() => setModal({ open: true })}
              disabled={studentOptions.length === 0}
              title={
                studentOptions.length === 0
                  ? 'Add a student first'
                  : 'Add a parent/guardian'
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> Add parent
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-sm"
          />
        </div>
        <Select
          className="!w-72"
          value={studentFilter}
          onChange={(e) => setStudentFilter(e.target.value)}
        >
          <option value="">All students</option>
          {studentOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.admissionNumber} · {s.firstName} {s.lastName}
            </option>
          ))}
        </Select>
      </div>

      <DataTable<Parent>
        rows={parents}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No parents/guardians added yet."
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (p) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">
                  {p.name}
                  {p.isPrimary && (
                    <Badge tone="green" className="ml-2">
                      Primary
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {p.occupation ?? ''}
                </div>
              </div>
            ),
          },
          {
            key: 'relation',
            header: 'Relation',
            render: (p) => (
              <Badge tone={relationTone[p.relation]}>{p.relation}</Badge>
            ),
          },
          {
            key: 'student',
            header: 'Student',
            render: (p) =>
              p.student ? (
                <div className="leading-tight">
                  <div className="text-sm text-slate-900">
                    {p.student.firstName} {p.student.lastName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.student.admissionNumber}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400">—</span>
              ),
          },
          { key: 'phone', header: 'Phone', render: (p) => p.phone },
          {
            key: 'email',
            header: 'Email',
            render: (p) => p.email ?? <span className="text-slate-400">—</span>,
          },
        ]}
        actions={(p) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, parent: p })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className={`rounded-md p-1.5 hover:bg-slate-100 ${
                p.userId ? 'text-green-600' : 'text-slate-500 hover:text-brand-600'
              }`}
              onClick={() => setPinModal({ open: true, parent: p })}
              title={p.userId ? 'Portal access enabled' : 'Set portal PIN'}
            >
              <KeyRound className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, parent: p })}
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

      <ParentFormModal
        open={modal.open}
        parent={modal.parent}
        students={studentOptions.map((s) => ({
          id: s.id,
          label: `${s.admissionNumber} · ${s.firstName} ${s.lastName}`,
        }))}
        defaultStudentId={studentFilter}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onClose={() => setModal({ open: false })}
        onSubmit={(v) => {
          const payload: Record<string, unknown> = {
            studentId: v.studentId,
            relation: v.relation,
            name: v.name,
            phoneCountryCode: v.phoneCountryCode || undefined,
            phone: v.phone,
            whatsappCountryCode: (
              v.whatsappSameAsMobile ? v.phone : v.whatsapp
            )
              ? v.whatsappSameAsMobile
                ? v.phoneCountryCode
                : v.whatsappCountryCode
              : undefined,
            whatsapp:
              (v.whatsappSameAsMobile ? v.phone : v.whatsapp) || undefined,
            email: v.email || undefined,
            occupation: v.occupation || undefined,
            annualIncome:
              typeof v.annualIncome === 'number' ? v.annualIncome : undefined,
            aadharNumber: v.aadharNumber || undefined,
            isPrimary: v.isPrimary,
          };
          if (modal.parent) delete payload.studentId; // student is fixed on edit
          upsert.mutate({ id: modal.parent?.id, payload });
        }}
      />

      <PortalPinModal
        open={pinModal.open}
        onClose={() => setPinModal({ open: false })}
        subject={pinModal.parent?.name ?? ''}
        loginHint={`Logs in with mobile ${pinModal.parent?.phone ?? ''}`}
        hasAccess={!!pinModal.parent?.userId}
        busy={setPin.isPending || removePin.isPending}
        error={errMsg(setPin.error)}
        onSet={(pin) =>
          pinModal.parent && setPin.mutate({ id: pinModal.parent.id, pin })
        }
        onRevoke={() => pinModal.parent && removePin.mutate(pinModal.parent.id)}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ['parents'] })}
        title="Import parents"
        description="Upload the .xlsx template. Each row links a parent to a student by Admission #."
        noun="parent"
        onTemplate={() => ParentsApi.importTemplate()}
        onPreview={(f) => ParentsApi.importPreview(f)}
        onCommit={(f) => ParentsApi.importCommit(f)}
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.parent && remove.mutate(confirm.parent.id)}
        loading={remove.isPending}
        title="Delete parent record?"
        message={`Remove ${confirm.parent?.name} (${confirm.parent?.relation}) for ${
          confirm.parent?.student
            ? `${confirm.parent.student.firstName} ${confirm.parent.student.lastName}`
            : 'the student'
        }.`}
        confirmText="Delete"
      />
    </>
  );
}

function ParentFormModal({
    open,
    parent,
    students,
    defaultStudentId,
    onClose,
    onSubmit,
    saving,
    errorMsg,
  }: {
    open: boolean;
    parent?: Parent;
    students: { id: string; label: string }[];
    defaultStudentId: string;
    onClose: () => void;
    onSubmit: (v: FormValues) => void;
    saving: boolean;
    errorMsg?: string;
  }) {
    const isEdit = !!parent;
    const {
      register,
      handleSubmit,
      reset,
      watch,
      formState: { errors },
    } = useForm<FormValues>({
      resolver: zodResolver(schema),
      values: {
        studentId: parent?.studentId ?? defaultStudentId ?? '',
        relation: (parent?.relation as ParentRelation) ?? 'father',
        name: parent?.name ?? '',
        phoneCountryCode: parent?.phoneCountryCode ?? DEFAULT_COUNTRY_CODE,
        phone: parent?.phone ?? '',
        whatsappSameAsMobile: !parent?.whatsapp
          ? true
          : parent.whatsapp === (parent.phone ?? '') &&
            (parent.whatsappCountryCode ?? DEFAULT_COUNTRY_CODE) ===
              (parent.phoneCountryCode ?? DEFAULT_COUNTRY_CODE),
        whatsappCountryCode:
          parent?.whatsappCountryCode ?? DEFAULT_COUNTRY_CODE,
        whatsapp: parent?.whatsapp ?? '',
        email: parent?.email ?? '',
        occupation: parent?.occupation ?? '',
        annualIncome: parent?.annualIncome ?? undefined,
        aadharNumber: parent?.aadharNumber ?? '',
        isPrimary: parent?.isPrimary ?? false,
      },
    });

    return (
      <Modal
        open={open}
        onClose={() => {
          reset();
          onClose();
        }}
        title={parent ? `Edit ${parent.name}` : 'Add parent / guardian'}
        description="Link a contact to a student. Marking primary unsets any other primary for that student."
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
              {saving ? 'Saving…' : parent ? 'Save changes' : 'Add parent'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Student"
            required
            error={errors.studentId?.message}
            className="sm:col-span-2"
          >
            <Select {...register('studentId')} disabled={isEdit}>
              <option value="">— Select a student —</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Relation" required error={errors.relation?.message}>
            <Select {...register('relation')}>
              {RELATIONS.map((r) => (
                <option key={r} value={r} className="capitalize">
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Full name" required error={errors.name?.message}>
            <Input {...register('name')} />
          </Field>

          <Field label="Mobile" required error={errors.phone?.message}>
            <div className="flex gap-2">
              <Select {...register('phoneCountryCode')} className="!w-24 shrink-0">
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </Select>
              <Input
                {...register('phone')}
                placeholder="9876543210"
                className="flex-1"
              />
            </div>
          </Field>
          <Field label="WhatsApp">
            <label className="mb-1.5 flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
                {...register('whatsappSameAsMobile')}
              />
              Same as mobile
            </label>
            {!watch('whatsappSameAsMobile') && (
              <div className="flex gap-2">
                <Select
                  {...register('whatsappCountryCode')}
                  className="!w-24 shrink-0"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code}
                    </option>
                  ))}
                </Select>
                <Input
                  {...register('whatsapp')}
                  placeholder="WhatsApp number"
                  className="flex-1"
                />
              </div>
            )}
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <Input type="email" {...register('email')} />
          </Field>

          <Field label="Occupation">
            <Input {...register('occupation')} />
          </Field>
          <Field label="Annual income (₹)">
            <Input type="number" {...register('annualIncome')} />
          </Field>

          <Field label="Aadhar number">
            <Input {...register('aadharNumber')} maxLength={12} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input type="checkbox" {...register('isPrimary')} />
            Primary guardian
          </label>

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
    anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong'
  );
}
