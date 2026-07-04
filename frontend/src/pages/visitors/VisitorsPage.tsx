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
import { useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Ban, Upload } from 'lucide-react';
import {
  ExportFormat,
  StudentsApi,
  Visitor,
  VisitorGender,
  VisitorsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Pagination } from '@/components/ui/Pagination';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { VisitorImportModal } from './VisitorImportModal';

const GENDERS: VisitorGender[] = ['male', 'female', 'other'];

const schema = z.object({
  studentId: z.string().uuid('Select the student being visited'),
  name: z.string().min(1, 'Required'),
  relation: z.string().optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other']).optional().or(z.literal('')),
  mobile: z.string().min(1, 'Required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  place: z.string().optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  idProofType: z.string().optional().or(z.literal('')),
  idProofNumber: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  isBlacklisted: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function VisitorsPage() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState(
    params.get('student') ?? '',
  );
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  useEffect(() => setPage(1), [search, studentFilter, limit]);

  const { data: studentOptions = [] } = useQuery({
    queryKey: ['students', 'lookup-for-visitors'],
    queryFn: () => StudentsApi.lookup({}),
  });

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['visitors', page, limit, search, studentFilter],
    queryFn: () =>
      VisitorsApi.list({
        page,
        limit,
        search: search || undefined,
        studentId: studentFilter || undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const visitors = pageData?.items ?? [];

  const [modal, setModal] = useState<{ open: boolean; visitor?: Visitor }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; visitor?: Visitor }>({
    open: false,
  });
  const [importOpen, setImportOpen] = useState(false);

  const upsert = useMutation({
    mutationFn: (v: { id?: string; payload: Record<string, unknown> }) =>
      v.id ? VisitorsApi.update(v.id, v.payload) : VisitorsApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitors'] });
      setModal({ open: false });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => VisitorsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['visitors'] });
      setConfirm({ open: false });
    },
  });

  return (
    <>
      <PageHeader
        title="Visitors"
        description="People registered to visit a student — parents, guardians and relatives."
        actions={
          <div className="flex items-center gap-2">
            <ExportButtons
              onExport={(format: ExportFormat) =>
                VisitorsApi.export(format, {
                  search: search || undefined,
                  studentId: studentFilter || undefined,
                })
              }
            />
            <button
              className="btn-secondary"
              onClick={() => setImportOpen(true)}
              disabled={studentOptions.length === 0}
              title="Import visitors from Excel"
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
                  : 'Register a visitor for a student'
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> Register visitor
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search name, mobile, place…"
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
              {s.admissionNumber} · {s.studentName}
            </option>
          ))}
        </Select>
      </div>

      <DataTable<Visitor>
        rows={visitors}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No visitors registered yet."
        columns={[
          {
            key: 'name',
            header: 'Name',
            render: (v) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">
                  {v.name}
                  {v.isBlacklisted && (
                    <Badge tone="red" className="ml-2">
                      <Ban className="-ml-0.5 mr-1 h-3 w-3" /> Blacklisted
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-slate-500 capitalize">
                  {[v.relation, v.gender].filter(Boolean).join(' · ')}
                </div>
              </div>
            ),
          },
          {
            key: 'student',
            header: 'Visiting student',
            render: (v) =>
              v.student ? (
                <div className="leading-tight">
                  <div className="text-sm text-slate-900">
                    {v.student.studentName}
                  </div>
                  <div className="text-xs text-slate-500">
                    {v.student.admissionNumber}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400">—</span>
              ),
          },
          { key: 'mobile', header: 'Mobile', render: (v) => v.mobile },
          {
            key: 'place',
            header: 'Place',
            render: (v) => v.place ?? <span className="text-slate-400">—</span>,
          },
          {
            key: 'idProof',
            header: 'ID Proof',
            render: (v) =>
              v.idProofType ? (
                <span className="text-sm">
                  {v.idProofType}
                  {v.idProofNumber ? ` · ${v.idProofNumber}` : ''}
                </span>
              ) : (
                <span className="text-slate-400">—</span>
              ),
          },
        ]}
        actions={(v) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, visitor: v })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, visitor: v })}
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

      <VisitorFormModal
        open={modal.open}
        visitor={modal.visitor}
        students={studentOptions.map((s) => ({
          id: s.id,
          label: `${s.admissionNumber} · ${s.studentName}`,
        }))}
        defaultStudentId={studentFilter}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onClose={() => setModal({ open: false })}
        onSubmit={(v) =>
          upsert.mutate({
            id: modal.visitor?.id,
            payload: {
              studentId: v.studentId,
              name: v.name,
              relation: v.relation || undefined,
              gender: v.gender || undefined,
              mobile: v.mobile,
              email: v.email || undefined,
              place: v.place || undefined,
              address: v.address || undefined,
              idProofType: v.idProofType || undefined,
              idProofNumber: v.idProofNumber || undefined,
              notes: v.notes || undefined,
              isBlacklisted: v.isBlacklisted,
            },
          })
        }
      />

      <VisitorImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ['visitors'] })}
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.visitor && remove.mutate(confirm.visitor.id)}
        loading={remove.isPending}
        title="Delete visitor?"
        message={`Remove ${confirm.visitor?.name}. Their past visit history will be kept but unlinked.`}
        confirmText="Delete"
      />
    </>
  );
}

function VisitorFormModal({
  open,
  visitor,
  students,
  defaultStudentId,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  visitor?: Visitor;
  students: { id: string; label: string }[];
  defaultStudentId: string;
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
      studentId: visitor?.studentId ?? defaultStudentId ?? '',
      name: visitor?.name ?? '',
      relation: visitor?.relation ?? '',
      gender: (visitor?.gender as FormValues['gender']) ?? '',
      mobile: visitor?.mobile ?? '',
      email: visitor?.email ?? '',
      place: visitor?.place ?? '',
      address: visitor?.address ?? '',
      idProofType: visitor?.idProofType ?? '',
      idProofNumber: visitor?.idProofNumber ?? '',
      notes: visitor?.notes ?? '',
      isBlacklisted: visitor?.isBlacklisted ?? false,
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={visitor ? `Edit ${visitor.name}` : 'Register visitor'}
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
            {saving ? 'Saving…' : visitor ? 'Save changes' : 'Register'}
          </button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label="Visiting student"
          required
          error={errors.studentId?.message}
          className="sm:col-span-3"
        >
          <Select {...register('studentId')} disabled={!!visitor}>
            <option value="">— Select the student being visited —</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Full name" required error={errors.name?.message}>
          <Input {...register('name')} />
        </Field>
        <Field label="Relation to student">
          <Input {...register('relation')} placeholder="Father, Mother, Guardian…" />
        </Field>
        <Field label="Gender">
          <Select {...register('gender')}>
            <option value="">—</option>
            {GENDERS.map((g) => (
              <option key={g} value={g} className="capitalize">
                {g}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Mobile" required error={errors.mobile?.message}>
          <Input {...register('mobile')} placeholder="9876543210" />
        </Field>
        <Field label="Email" error={errors.email?.message}>
          <Input type="email" {...register('email')} />
        </Field>
        <Field label="Place">
          <Input {...register('place')} />
        </Field>

        <Field label="Address" className="sm:col-span-3">
          <Textarea rows={2} {...register('address')} />
        </Field>

        <Field label="ID proof type">
          <Input {...register('idProofType')} placeholder="Aadhar / License" />
        </Field>
        <Field label="ID proof number">
          <Input {...register('idProofNumber')} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input type="checkbox" {...register('isBlacklisted')} />
          Blacklist (block future visits)
        </label>

        <Field label="Notes" className="sm:col-span-3">
          <Textarea rows={2} {...register('notes')} />
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
    anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong'
  );
}
