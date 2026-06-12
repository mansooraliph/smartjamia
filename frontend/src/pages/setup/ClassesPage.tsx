import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Pencil, Trash2, Users, GraduationCap, Layers } from 'lucide-react';
import {
  AcademicYearsApi,
  ClassEntity,
  ClassesApi,
  Course,
  CourseLevel,
  CoursesApi,
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
import { cn } from '@/lib/cn';

const LEVEL_LABEL: Record<CourseLevel, string> = {
  ug: 'Undergraduate (UG)',
  pg: 'Postgraduate (PG)',
  diploma: 'Diploma',
  phd: 'PhD',
  certificate: 'Certificate',
  other: 'Other',
};
const LEVELS: CourseLevel[] = ['ug', 'pg', 'diploma', 'phd', 'certificate', 'other'];

const classSchema = z.object({
  academicYearId: z.string().uuid('Required'),
  courseId: z.string().optional().or(z.literal('')),
  name: z.string().min(1, 'Required'),
  orderIndex: z.coerce.number().int().min(0),
});
type ClassForm = z.infer<typeof classSchema>;

const courseSchema = z.object({
  level: z.enum(['ug', 'pg', 'diploma', 'phd', 'certificate', 'other']),
  name: z.string().min(1, 'Required'),
  code: z.string().optional().or(z.literal('')),
  termSystem: z.enum(['annual', 'semester', 'trimester']),
  durationYears: z.coerce.number().int().min(1).max(10),
  orderIndex: z.coerce.number().int().min(0),
});
type CourseForm = z.infer<typeof courseSchema>;

const sectionSchema = z.object({
  classId: z.string().uuid('Required'),
  name: z.string().min(1, 'Required'),
  capacity: z.coerce.number().int().min(1).max(500),
});
type SectionForm = z.infer<typeof sectionSchema>;

export function ClassesPage() {
  const qc = useQueryClient();
  const term = useTerminology();
  const isCollege = term.institutionType === 'college';
  const [yearFilter, setYearFilter] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');

  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });

  // Auto-select current year on first render
  const effectiveYearId = useMemo(() => {
    if (yearFilter) return yearFilter;
    return years.find((y) => y.isCurrent)?.id ?? years[0]?.id ?? '';
  }, [yearFilter, years]);

  const { data: courses = [] } = useQuery({
    queryKey: ['courses', effectiveYearId],
    queryFn: () => CoursesApi.list(effectiveYearId || undefined),
    enabled: isCollege && years.length > 0,
  });

  const courseFilter = isCollege ? selectedCourseId || undefined : undefined;
  const { data: classes = [], isLoading } = useQuery({
    queryKey: ['classes-with-sections', effectiveYearId, courseFilter ?? 'all'],
    queryFn: () =>
      ClassesApi.listWithSections(effectiveYearId || undefined, courseFilter),
    enabled: years.length > 0,
  });

  const [courseModal, setCourseModal] = useState<{ open: boolean; course?: Course }>({ open: false });
  const [courseConfirm, setCourseConfirm] = useState<{ open: boolean; course?: Course }>({ open: false });

  const upsertCourse = useMutation({
    mutationFn: (v: { id?: string; payload: any }) =>
      v.id ? CoursesApi.update(v.id, v.payload) : CoursesApi.create(v.payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      qc.invalidateQueries({ queryKey: ['classes-with-sections'] });
      qc.invalidateQueries({ queryKey: ['school-stats'] });
      setCourseModal({ open: false });
    },
  });
  const removeCourse = useMutation({
    mutationFn: (id: string) => CoursesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['courses'] });
      setCourseConfirm({ open: false });
    },
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
              disabled={isCollege && courses.length === 0}
              title={
                isCollege && courses.length === 0
                  ? 'Create a course first'
                  : undefined
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> New {term.level.toLowerCase()}
            </button>
          </div>
        }
      />

      {isCollege && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Layers className="h-4 w-4 text-brand-600" /> Courses / Programs
            </div>
            <button
              className="btn-secondary text-sm"
              onClick={() => setCourseModal({ open: true })}
            >
              <Plus className="mr-1.5 h-4 w-4" /> New course
            </button>
          </div>
          {courses.length === 0 ? (
            <p className="text-sm text-slate-500">
              No courses yet. Create a course (e.g. “B.Sc Computer Science”) to
              organize your {term.levelPlural.toLowerCase()} under it.
            </p>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() => setSelectedCourseId('')}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-medium transition',
                  selectedCourseId === ''
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                All courses
              </button>
              {LEVELS.filter((l) => courses.some((c) => c.level === l)).map(
                (level) => (
                  <div key={level}>
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {LEVEL_LABEL[level]}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {courses
                        .filter((c) => c.level === level)
                        .map((c) => (
                          <div
                            key={c.id}
                            className={cn(
                              'group inline-flex items-center gap-1 rounded-full border py-1 pl-3 pr-1.5 text-sm transition',
                              selectedCourseId === c.id
                                ? 'border-brand-400 bg-brand-50 text-brand-700'
                                : 'border-slate-200 text-slate-700 hover:bg-slate-50',
                            )}
                          >
                            <button onClick={() => setSelectedCourseId(c.id)}>
                              {c.name}
                              {c.code ? (
                                <span className="ml-1 text-xs opacity-60">
                                  {c.code}
                                </span>
                              ) : null}
                              <span className="ml-1.5 rounded-full bg-white/70 px-1.5 text-xs text-slate-500">
                                {c.classCount ?? 0}
                              </span>
                            </button>
                            <button
                              onClick={() => setCourseModal({ open: true, course: c })}
                              className="rounded-full p-0.5 text-slate-400 hover:text-brand-600"
                              title="Edit course"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setCourseConfirm({ open: true, course: c })}
                              className="rounded-full p-0.5 text-slate-400 hover:text-red-600"
                              title="Delete course"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      )}

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
        isCollege={isCollege}
        courses={courses}
        defaultCourseId={selectedCourseId || courses[0]?.id || ''}
        onClose={() => setClassModal({ open: false })}
        saving={upsertClass.isPending}
        errorMsg={errMsg(upsertClass.error)}
        onSubmit={(v) =>
          upsertClass.mutate({
            id: classModal.cls?.id,
            payload: { ...v, courseId: v.courseId || undefined },
          })
        }
      />

      {courseModal.open && (
        <CourseModal
          course={courseModal.course}
          yearId={effectiveYearId}
          onClose={() => setCourseModal({ open: false })}
          saving={upsertCourse.isPending}
          errorMsg={errMsg(upsertCourse.error)}
          onSubmit={(v) =>
            upsertCourse.mutate({
              id: courseModal.course?.id,
              payload: courseModal.course
                ? v
                : { academicYearId: effectiveYearId, ...v },
            })
          }
        />
      )}

      <ConfirmDialog
        open={courseConfirm.open}
        onClose={() => {
          setCourseConfirm({ open: false });
          removeCourse.reset();
        }}
        onConfirm={() =>
          courseConfirm.course && removeCourse.mutate(courseConfirm.course.id)
        }
        loading={removeCourse.isPending}
        title="Delete course?"
        message={
          removeCourse.error
            ? errMsg(removeCourse.error)!
            : `Delete "${courseConfirm.course?.name}". Its ${term.levelPlural.toLowerCase()} must be moved or deleted first.`
        }
        confirmText="Delete course"
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
  isCollege,
  courses,
  defaultCourseId,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  open: boolean;
  cls?: ClassEntity;
  years: { id: string; name: string }[];
  defaultYearId: string;
  isCollege: boolean;
  courses: Course[];
  defaultCourseId: string;
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
      courseId: cls?.courseId ?? defaultCourseId ?? '',
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
        {isCollege && (
          <Field label="Course / Program" required error={errors.courseId?.message}>
            <Select {...register('courseId')}>
              {courses.length === 0 && <option value="">No courses — create one first</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {LEVEL_LABEL[c.level].replace(/ \(.*\)/, '')} · {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
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

function CourseModal({
  course,
  onClose,
  onSubmit,
  saving,
  errorMsg,
}: {
  course?: Course;
  yearId: string;
  onClose: () => void;
  onSubmit: (v: CourseForm) => void;
  saving: boolean;
  errorMsg?: string;
}) {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    values: {
      level: (course?.level as CourseLevel) ?? 'ug',
      name: course?.name ?? '',
      code: course?.code ?? '',
      termSystem: course?.termSystem ?? 'annual',
      durationYears: course?.durationYears ?? 1,
      orderIndex: course?.orderIndex ?? 0,
    },
  });

  const termSystem = watch('termSystem');
  const durationYears = Number(watch('durationYears')) || 1;
  const perYear =
    termSystem === 'semester' ? 2 : termSystem === 'trimester' ? 3 : 1;
  const termLabel =
    termSystem === 'semester'
      ? 'Semester'
      : termSystem === 'trimester'
        ? 'Trimester'
        : 'Year';
  const genCount = Math.max(1, durationYears) * perYear;

  return (
    <Modal
      open
      onClose={onClose}
      title={course ? `Edit ${course.name}` : 'New course / program'}
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
            {saving ? 'Saving…' : course ? 'Save changes' : 'Create course'}
          </button>
        </>
      }
    >
      <form className="space-y-4">
        <Field label="Level" required error={errors.level?.message}>
          <Select {...register('level')}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {LEVEL_LABEL[l]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Course name" required error={errors.name?.message}>
          <Input {...register('name')} placeholder="B.Sc Computer Science" />
        </Field>
        <Field label="Code" hint="Optional, e.g. BSCCS" error={errors.code?.message}>
          <Input {...register('code')} placeholder="BSCCS" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Term system" required error={errors.termSystem?.message}>
            <Select {...register('termSystem')}>
              <option value="annual">Annual (Years)</option>
              <option value="semester">Semester</option>
              <option value="trimester">Trimester</option>
            </Select>
          </Field>
          <Field label="Duration (years)" required error={errors.durationYears?.message}>
            <Input type="number" min={1} max={10} {...register('durationYears')} />
          </Field>
        </div>
        {!course && (
          <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
            On create, {genCount} {termLabel.toLowerCase()}
            {genCount === 1 ? '' : 's'} will be auto-generated as classes (
            {termLabel} 1…{genCount}). You can rename or add more afterwards.
          </div>
        )}
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

function errMsg(e: unknown): string | undefined {
  if (!e) return undefined;
  const anyE = e as any;
  return (
    anyE?.response?.data?.error?.message ??
    anyE?.message ??
    'Something went wrong'
  );
}
