import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, CheckCircle2, Lock, Unlock } from 'lucide-react';
import { AcademicYear, AcademicYearsApi } from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Checkbox } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
  isCurrent: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function AcademicYearsPage() {
  const qc = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; year?: AcademicYear }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{
    open: boolean;
    year?: AcademicYear;
  }>({ open: false });

  const { data: years = [], isLoading } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });

  const upsert = useMutation({
    mutationFn: (v: { id?: string; payload: Partial<AcademicYear> }) =>
      v.id
        ? AcademicYearsApi.update(v.id, v.payload)
        : AcademicYearsApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setModal({ open: false });
    },
  });

  const setCurrent = useMutation({
    mutationFn: (id: string) => AcademicYearsApi.setCurrent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic-years'] }),
  });

  const toggleLock = useMutation({
    mutationFn: (y: AcademicYear) =>
      y.isLocked ? AcademicYearsApi.unlock(y.id) : AcademicYearsApi.lock(y.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['academic-years'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => AcademicYearsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic-years'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setConfirm({ open: false });
    },
  });

  return (
    <>
      <PageHeader
        title="Academic Years"
        description="Define your academic calendar. Exactly one year is current at a time."
        actions={
          <button className="btn-primary" onClick={() => setModal({ open: true })}>
            <Plus className="mr-1.5 h-4 w-4" /> New academic year
          </button>
        }
      />

      <DataTable<AcademicYear>
        rows={years}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="Create your first academic year to get started."
        columns={[
          {
            key: 'name',
            header: 'Year',
            render: (y) => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{y.name}</span>
                {y.isCurrent && (
                  <Badge tone="green">
                    <CheckCircle2 className="-ml-0.5 mr-1 h-3 w-3" /> Current
                  </Badge>
                )}
                {y.isLocked && (
                  <Badge tone="slate">
                    <Lock className="-ml-0.5 mr-1 h-3 w-3" /> Locked
                  </Badge>
                )}
              </div>
            ),
          },
          {
            key: 'startDate',
            header: 'Start',
            render: (y) => formatDate(y.startDate),
          },
          {
            key: 'endDate',
            header: 'End',
            render: (y) => formatDate(y.endDate),
          },
          {
            key: 'created',
            header: 'Created',
            render: (y) => formatDate(y.createdAt),
          },
        ]}
        actions={(y) => (
          <>
            {!y.isCurrent && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-green-50 hover:text-green-700"
                onClick={() => setCurrent.mutate(y.id)}
                title="Make current"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, year: y })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
              onClick={() => toggleLock.mutate(y)}
              title={y.isLocked ? 'Unlock year' : 'Lock year (after promotion)'}
            >
              {y.isLocked ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
              onClick={() => setConfirm({ open: true, year: y })}
              disabled={y.isLocked}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <YearFormModal
        open={modal.open}
        year={modal.year}
        onClose={() => setModal({ open: false })}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onSubmit={(v) =>
          upsert.mutate({
            id: modal.year?.id,
            payload: {
              name: v.name,
              startDate: v.startDate,
              endDate: v.endDate,
              isCurrent: v.isCurrent,
            },
          })
        }
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.year && remove.mutate(confirm.year.id)}
        loading={remove.isPending}
        title="Delete academic year?"
        message={`This permanently deletes ${confirm.year?.name}. All classes/enrollments under it must already be removed.`}
        confirmText="Delete"
      />
    </>
  );
}

function YearFormModal({
  open,
  year,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  year?: AcademicYear;
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
      name: year?.name ?? '',
      startDate: year?.startDate?.slice(0, 10) ?? '',
      endDate: year?.endDate?.slice(0, 10) ?? '',
      isCurrent: year?.isCurrent ?? false,
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={year ? `Edit ${year.name}` : 'New academic year'}
      size="md"
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
            {saving ? 'Saving…' : year ? 'Save changes' : 'Create'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field label="Name" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="2026-27" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" required error={errors.startDate?.message}>
            <Input type="date" {...register('startDate')} />
          </Field>
          <Field label="End date" required error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} />
          </Field>
        </div>
        <Checkbox
          label="Set as current academic year"
          {...register('isCurrent')}
        />
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
