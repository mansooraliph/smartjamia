import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import {
  AcademicYearsApi,
  ClassEntity,
  ClassesApi,
  ExportFormat,
  Section,
  SectionsApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { ExportButtons } from '@/components/ui/ExportButtons';
import { useTerminology } from '@/hooks/useTerminology';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select } from '@/components/ui/Input';

const classSchema = z.object({
  academicYearId: z.string().uuid('Required'),
  name: z.string().min(1, 'Required'),
  orderIndex: z.coerce.number().int().min(0),
});
type ClassForm = z.infer<typeof classSchema>;

const sectionSchema = z.object({
  classId: z.string().uuid('Required'),
  name: z.string().min(1, 'Required'),
  capacity: z.coerce.number().int().min(1).max(500),
});
type SectionForm = z.infer<typeof sectionSchema>;

export function ClassesPage() {
  const qc = useQueryClient();
  const term = useTerminology();
  const [yearFilter, setYearFilter] = useState<string>('');

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });

  // Auto-select current year on first render
  const effectiveYearId = useMemo(() => {
    if (yearFilter) return yearFilter;
    return years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? '';
  }, [yearFilter, years]);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes-with-sections', effectiveYearId],
    queryFn: () => ClassesApi.listWithSections(effectiveYearId || undefined),
    enabled: years.length > 0,
  });

  const [classModal, setClassModal] = useState<{
    open: boolean;
    cls?: ClassEntity;
  }>({ open: false });
  const [classConfirm, setClassConfirm] = useState<{
    open: boolean;
    cls?: ClassEntity;
  }>({ open: false });

  const [sectionModal, setSectionModal] = useState<{
    open: boolean;
    classId?: string;
    section?: Section;
  }>({ open: false });
  const [sectionConfirm, setSectionConfirm] = useState<{
    open: boolean;
    section?: Section;
  }>({ open: false });

  const upsertClass = useMutation({
    mutationFn: (v: { id?: string; payload: Partial<ClassEntity> }) =>
      v.id
        ? ClassesApi.update(v.id, v.payload)
        : ClassesApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes-with-sections'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setClassModal({ open: false });
    },
  });

  const removeClass = useMutation({
    mutationFn: (id: string) => ClassesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes-with-sections'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setClassConfirm({ open: false });
    },
  });

  const upsertSection = useMutation({
    mutationFn: (v: { id?: string; payload: Partial<Section> }) =>
      v.id
        ? SectionsApi.update(v.id, v.payload)
        : SectionsApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes-with-sections'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setSectionModal({ open: false });
    },
  });

  const removeSection = useMutation({
    mutationFn: (id: string) => SectionsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['classes-with-sections'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setSectionConfirm({ open: false });
    },
  });

  if (years.length === 0) {
    return (
      <>
        <PageHeader title={`${term.levelPlural} & ${term.groupPlural}`} />
        <div className="card p-8 text-center">
          <p className="mb-4 text-slate-600">
            Create an academic year first to organize{' '}
            {term.levelPlural.toLowerCase()}.
          </p>
          <a href="/setup/academic-years" className="btn-primary inline-flex">
            Go to Academic Years
          </a>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${term.levelPlural} & ${term.groupPlural}`}
        description={`${term.levelPlural} group students by level. ${term.groupPlural} divide a ${term.level.toLowerCase()} into manageable groups.`}
        actions={
          <div className="flex items-center gap-2">
            <Select
              className="!w-56"
              value={effectiveYearId}
              onChange={(e) => setYearFilter(e.target.value)}
            >
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                  {y.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </Select>
            <ExportButtons
              onExport={(format: ExportFormat) =>
                ClassesApi.export(format, effectiveYearId || undefined)
              }
            />
            <button
              className="btn-primary"
              onClick={() => setClassModal({ open: true })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> New {term.level.toLowerCase()}
            </button>
          </div>
        }
      />

      {isLoading ? (
        <div className="card p-8 text-center text-slate-400">Loading…</div>
      ) : classes.length === 0 ? (
        <div className="card p-8 text-center text-slate-400">
          No {term.levelPlural.toLowerCase()} yet for this academic year.
        </div>
      ) : (
        <div className="space-y-4">
          {classes.map((cls) => (
            <div key={cls.id} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-slate-900">{cls.name}</h3>
                  <Badge tone="slate">
                    {cls.sections?.length ?? 0}{' '}
                    {term.groupPlural.toLowerCase()}
                  </Badge>
                  <span className="text-xs text-slate-500">
                    order #{cls.orderIndex}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="btn bg-slate-200 px-2.5 py-1 text-xs hover:bg-slate-300"
                    onClick={() =>
                      setSectionModal({ open: true, classId: cls.id })
                    }
                  >
                    <Plus className="mr-1 h-3 w-3" /> Add {term.group.toLowerCase()}
                  </button>
                  <button
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-200 hover:text-brand-700"
                    onClick={() => setClassModal({ open: true, cls })}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setClassConfirm({ open: true, cls })}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {cls.sections && cls.sections.length > 0 ? (
                  cls.sections.map((sec) => (
                    <div
                      key={sec.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-50 text-sm font-semibold text-brand-700">
                          {sec.name}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {term.group} {sec.name}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Users className="h-3 w-3" /> capacity {sec.capacity}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                          onClick={() =>
                            setSectionModal({
                              open: true,
                              classId: cls.id,
                              section: sec,
                            })
                          }
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          onClick={() =>
                            setSectionConfirm({ open: true, section: sec })
                          }
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-6 text-center text-sm text-slate-400">
                    No {term.groupPlural.toLowerCase()} — add one with the
                    button above.
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ClassFormModal
        open={classModal.open}
        cls={classModal.cls}
        years={years.map((y) => ({ id: y.id, name: y.name }))}
        defaultYearId={effectiveYearId}
        onClose={() => setClassModal({ open: false })}
        saving={upsertClass.isPending}
        errorMsg={errMsg(upsertClass.error)}
        onSubmit={(v) =>
          upsertClass.mutate({
            id: classModal.cls?.id,
            payload: v,
          })
        }
      />

      <SectionFormModal
        open={sectionModal.open}
        classId={sectionModal.classId}
        section={sectionModal.section}
        classes={classes.map((c) => ({ id: c.id, name: c.name }))}
        onClose={() => setSectionModal({ open: false })}
        saving={upsertSection.isPending}
        errorMsg={errMsg(upsertSection.error)}
        onSubmit={(v) =>
          upsertSection.mutate({
            id: sectionModal.section?.id,
            payload: v,
          })
        }
      />

      <ConfirmDialog
        open={classConfirm.open}
        onClose={() => setClassConfirm({ open: false })}
        onConfirm={() => classConfirm.cls && removeClass.mutate(classConfirm.cls.id)}
        loading={removeClass.isPending}
        title={`Delete ${term.level.toLowerCase()}?`}
        message={`Delete "${classConfirm.cls?.name}". You must delete its ${term.groupPlural.toLowerCase()} first.`}
        confirmText={`Delete ${term.level.toLowerCase()}`}
      />

      <ConfirmDialog
        open={sectionConfirm.open}
        onClose={() => setSectionConfirm({ open: false })}
        onConfirm={() =>
          sectionConfirm.section && removeSection.mutate(sectionConfirm.section.id)
        }
        loading={removeSection.isPending}
        title={`Delete ${term.group.toLowerCase()}?`}
        message={`Delete ${term.group.toLowerCase()} "${sectionConfirm.section?.name}". Existing student enrollments will become orphaned.`}
        confirmText={`Delete ${term.group.toLowerCase()}`}
      />
    </>
  );
}

function ClassFormModal({
  open,
  cls,
  years,
  defaultYearId,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  cls?: ClassEntity;
  years: { id: string; name: string }[];
  defaultYearId: string;
  onClose: () => void;
  onSubmit: (v: ClassForm) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const term = useTerminology();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClassForm>({
    resolver: zodResolver(classSchema),
    values: {
      academicYearId: cls?.academicYearId ?? defaultYearId,
      name: cls?.name ?? '',
      orderIndex: cls?.orderIndex ?? 0,
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={cls ? `Edit ${cls.name}` : `New ${term.level.toLowerCase()}`}
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
            {saving
              ? 'Saving…'
              : cls
                ? 'Save changes'
                : `Create ${term.level.toLowerCase()}`}
          </button>
        </>
      }
    >
      <form className="space-y-4">
        <Field label="Academic year" required error={errors.academicYearId?.message}>
          <Select {...register('academicYearId')} disabled={!!cls}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`${term.level} name`} required error={errors.name?.message}>
          <Input {...register('name')} placeholder={`${term.level} 10`} />
        </Field>
        <Field label="Order index" hint="Lower comes first" error={errors.orderIndex?.message}>
          <Input type="number" {...register('orderIndex')} />
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

function SectionFormModal({
  open,
  classId,
  section,
  classes,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  classId?: string;
  section?: Section;
  classes: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: SectionForm) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const term = useTerminology();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SectionForm>({
    resolver: zodResolver(sectionSchema),
    values: {
      classId: section?.classId ?? classId ?? '',
      name: section?.name ?? '',
      capacity: section?.capacity ?? 40,
    },
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={
        section
          ? `Edit ${term.group} ${section.name}`
          : `New ${term.group.toLowerCase()}`
      }
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
            {saving
              ? 'Saving…'
              : section
                ? 'Save changes'
                : `Create ${term.group.toLowerCase()}`}
          </button>
        </>
      }
    >
      <form className="space-y-4">
        <Field label={term.level} required error={errors.classId?.message}>
          <Select {...register('classId')} disabled={!!section}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`${term.group} name`} required error={errors.name?.message}>
          <Input {...register('name')} placeholder="A" />
        </Field>
        <Field label="Capacity" required error={errors.capacity?.message}>
          <Input type="number" min={1} {...register('capacity')} />
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
