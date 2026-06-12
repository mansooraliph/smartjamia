import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Upload } from 'lucide-react';
import {
  AcademicYearsApi,
  ClassesApi,
  classLabel,
  ExportFormat,
  Subject,
  SubjectsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { ImportModal } from '@/components/shared/ImportModal';
import { useTerminology } from '@/hooks/useTerminology';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Checkbox } from '@/components/ui/Input';

const schema = z.object({
  classId: z.string().uuid('Required'),
  name: z.string().min(1, 'Required'),
  code: z.string().min(1, 'Required'),
  isOptional: z.boolean(),
  maxMarks: z.coerce.number().int().min(1),
  passMarks: z.coerce.number().int().min(0),
});
type FormValues = z.infer<typeof schema>;

export function SubjectsPage() {
  const qc = useQueryClient();
  const term = useTerminology();
  const [yearFilter, setYearFilter] = useState<string>('');
  const [classFilter, setClassFilter] = useState<string>('');
  const [importOpen, setImportOpen] = useState(false);

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });

  const effectiveYearId = useMemo(() => {
    if (yearFilter) return yearFilter;
    return years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? '';
  }, [yearFilter, years]);

  const { data: classes = [] } = useQuery({
    queryKey: ['classes', effectiveYearId],
    queryFn: () => ClassesApi.list(effectiveYearId || undefined),
    enabled: !!effectiveYearId,
  });

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ['subjects', classFilter],
    queryFn: () => SubjectsApi.list(classFilter || undefined),
  });

  const [modal, setModal] = useState<{ open: boolean; subject?: Subject }>({
    open: false,
  });
  const [confirm, setConfirm] = useState<{ open: boolean; subject?: Subject }>(
    { open: false },
  );

  const upsert = useMutation({
    mutationFn: (v: { id?: string; payload: Partial<Subject> }) =>
      v.id
        ? SubjectsApi.update(v.id, v.payload)
        : SubjectsApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setModal({ open: false });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => SubjectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setConfirm({ open: false });
    },
  });

  const classNameById = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.id, classLabel(c)])),
    [classes],
  );

  return (
    <>
      <PageHeader
        title="Subjects"
        description={`Define subjects per ${term.level.toLowerCase()} with max/pass marks.`}
        actions={
          <div className="flex items-center gap-2">
            <Select
              className="!w-44"
              value={effectiveYearId}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
            <Select
              className="!w-56"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="">All {term.levelPlural.toLowerCase()}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {classLabel(c)}
                </option>
              ))}
            </Select>
            <ExportButtons
              onExport={(format: ExportFormat) =>
                SubjectsApi.export(format, classFilter || undefined)
              }
            />
            <button
              className="btn-secondary"
              onClick={() => setImportOpen(true)}
              disabled={classes.length === 0}
              title="Import subjects from Excel"
            >
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </button>
            <button
              className="btn-primary"
              onClick={() => setModal({ open: true })}
              disabled={classes.length === 0}
              title={
                classes.length === 0
                  ? `Create a ${term.level.toLowerCase()} first`
                  : ''
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> New subject
            </button>
          </div>
        }
      />

      <DataTable<Subject>
        rows={subjects}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage={
          classes.length === 0
            ? `Create a ${term.level.toLowerCase()} first to add subjects.`
            : 'No subjects yet.'
        }
        columns={[
          {
            key: 'name',
            header: 'Subject',
            render: (s) => (
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{s.name}</span>
                {s.isOptional && <Badge tone="amber">Optional</Badge>}
              </div>
            ),
          },
          {
            key: 'code',
            header: 'Code',
            render: (s) => (
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium">
                {s.code}
              </code>
            ),
          },
          {
            key: 'class',
            header: term.level,
            render: (s) => (
              <Badge tone="blue">{classNameById[s.classId] ?? '—'}</Badge>
            ),
          },
          {
            key: 'maxMarks',
            header: 'Max marks',
            render: (s) => s.maxMarks,
          },
          {
            key: 'passMarks',
            header: 'Pass marks',
            render: (s) => s.passMarks,
          },
        ]}
        actions={(s) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
              onClick={() => setModal({ open: true, subject: s })}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              onClick={() => setConfirm({ open: true, subject: s })}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ['subjects'] })}
        title="Import subjects"
        description={`Upload the .xlsx template. Each row links a subject to a ${term.level.toLowerCase()} by name within the selected year.`}
        noun="subject"
        onTemplate={() => SubjectsApi.importTemplate()}
        onPreview={(f) => SubjectsApi.importPreview(f, effectiveYearId)}
        onCommit={(f) => SubjectsApi.importCommit(f, effectiveYearId)}
      />

      <SubjectFormModal
        open={modal.open}
        subject={modal.subject}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        defaultClassId={classFilter}
        onClose={() => setModal({ open: false })}
        saving={upsert.isPending}
        errorMsg={errMsg(upsert.error)}
        onSubmit={(v) =>
          upsert.mutate({
            id: modal.subject?.id,
            payload: v,
          })
        }
      />

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.subject && remove.mutate(confirm.subject.id)}
        loading={remove.isPending}
        title="Delete subject?"
        message={`Delete "${confirm.subject?.name}". Existing exam marks for this subject will become orphaned.`}
        confirmText="Delete"
      />
    </>
  );
}

function SubjectFormModal({
  open,
  subject,
  classes,
  defaultClassId,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  subject?: Subject;
  classes: { id: string; name: string }[];
  defaultClassId?: string;
  onClose: () => void;
  onSubmit: (v: FormValues) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const term = useTerminology();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      classId: subject?.classId ?? defaultClassId ?? classes[0]?.id ?? '',
      name: subject?.name ?? '',
      code: subject?.code ?? '',
      isOptional: subject?.isOptional ?? false,
      maxMarks: subject?.maxMarks ?? 100,
      passMarks: subject?.passMarks ?? 35,
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={subject ? `Edit ${subject.name}` : 'New subject'}
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
            {saving ? 'Saving…' : subject ? 'Save changes' : 'Create subject'}
          </button>
        </>
      }
    >
      <form className="space-y-4">
        <Field label={term.level} required error={errors.classId?.message}>
          <Select {...register('classId')} disabled={!!subject}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {classLabel(c)}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Subject name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="Mathematics" />
          </Field>
          <Field label="Code" required error={errors.code?.message}>
            <Input {...register('code')} placeholder="MATH" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Max marks" required error={errors.maxMarks?.message}>
            <Input type="number" {...register('maxMarks')} />
          </Field>
          <Field label="Pass marks" required error={errors.passMarks?.message}>
            <Input type="number" {...register('passMarks')} />
          </Field>
        </div>
        <Checkbox label="Optional subject" {...register('isOptional')} />
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
