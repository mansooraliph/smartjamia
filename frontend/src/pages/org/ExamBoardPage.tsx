import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Copy, Pencil, Plus, Printer, Search, Settings2, Star, Trash2, Upload } from 'lucide-react';
import {
  CourseTerm,
  CreateBatchExamPayload,
  CreateExamBoardAcademicYearPayload,
  CreateExamBoardBatchPayload,
  CreateExamBoardCoursePayload,
  CreateExamBoardSchemePayload,
  CreateExamBoardSubjectPayload,
  ExamBoardAcademicYear,
  ExamBoardApi,
  ExamBoardBatch,
  ExamBoardCourse,
  ExamBoardEnrollment,
  ExamBoardExam,
  ExamBoardExamSubject,
  ExamBoardInstitution,
  ExamBoardScheme,
  ExamBoardSubject,
} from '@/services/examBoard.api';
import { DataTable } from '@/components/ui/DataTable';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Checkbox } from '@/components/ui/Input';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Tabs, TabItem } from '@/components/ui/Tabs';
import { Pagination } from '@/components/ui/Pagination';
import { PageHeader } from '@/components/ui/PageHeader';
import { ImportModal } from '@/components/shared/ImportModal';
import { formatDate } from '@/lib/format';
import { printExamSchedule } from '@/lib/printExamSchedule';
import { toast } from '@/stores/toast.store';

export function InstitutionsPage() {
  return (
    <>
      <PageHeader
        title="Institutions"
        description="Copy a school from your organization into the Examination Board wing."
      />
      <InstitutionsTab />
    </>
  );
}

export function CoursesPage() {
  return (
    <>
      <PageHeader
        title="Examination Board Courses"
        description="The course master your institutions can enable."
      />
      <CoursesTab />
    </>
  );
}

export function AcademicYearsPage() {
  return (
    <>
      <PageHeader
        title="Examination Board Academic Years"
        description="The academic year master your institutions can enable."
      />
      <AcademicYearsTab />
    </>
  );
}

export function SchemesPage() {
  return (
    <>
      <PageHeader
        title="Schemes"
        description="Curriculum regulations under each course, selected when creating a batch."
      />
      <SchemesTab />
    </>
  );
}

export function SubjectsPage() {
  return (
    <>
      <PageHeader
        title="Subjects"
        description="The subject catalog per course + Year/Semester, assigned into batches."
      />
      <SubjectsTab />
    </>
  );
}

export function BatchesPage() {
  return (
    <>
      <PageHeader
        title="Batches"
        description="Batches per institution, course and academic year."
      />
      <BatchesTab />
    </>
  );
}

export function ExamsPage() {
  return (
    <>
      <PageHeader
        title="Exams"
        description="Schedule exams for a batch, set subject-wise dates & times, and print the schedule."
      />
      <ExamsTab />
    </>
  );
}

/** Empty-string-safe optional number — z.coerce.number() turns "" into 0, which then fails .min(). */
const optionalNumber = (min: number) =>
  z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : Number(v)),
    z.number().min(min).optional(),
  );

function errMsg(e: unknown): string | undefined {
  const anyE = e as any;
  return anyE?.response?.data?.error?.message ?? anyE?.message ?? 'Something went wrong';
}

// ── Institutions ──────────────────────────────────────────────────────────────
function InstitutionsTab() {
  const qc = useQueryClient();
  const [manage, setManage] = useState<ExamBoardInstitution | null>(null);
  const { data: institutions = [], isLoading } = useQuery({
    queryKey: ['eb-institutions'],
    queryFn: ExamBoardApi.listInstitutions,
  });

  const toggle = useMutation({
    mutationFn: ({ schoolId, isEnabled }: { schoolId: string; isEnabled: boolean }) =>
      ExamBoardApi.setInstitutionEnabled(schoolId, isEnabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-institutions'] });
      toast.success('Updated');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500">
        Once copied, enable its courses and academic years below.
      </p>
      <DataTable<ExamBoardInstitution>
        rows={institutions}
        getRowId={(r) => r.school.id}
        isLoading={isLoading}
        emptyMessage="No schools in this organization yet."
        columns={[
          {
            key: 'name',
            header: 'School',
            render: (r) => (
              <div className="leading-tight">
                <div className="font-medium text-slate-900">{r.school.name}</div>
                <code className="text-xs text-slate-500">{r.school.code}</code>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <Badge tone="slate">{r.school.status}</Badge>,
          },
          {
            key: 'enabled',
            header: 'Exam Board',
            render: (r) => (
              <Badge tone={r.isEnabled ? 'green' : 'slate'}>
                {r.isEnabled ? 'Copied in' : 'Not copied'}
              </Badge>
            ),
          },
        ]}
        actions={(r) => (
          <>
            {r.isEnabled && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
                title="Manage courses/years"
                onClick={() => setManage(r)}
              >
                <Settings2 className="h-4 w-4" />
              </button>
            )}
            <button
              className={`btn-secondary !py-1 !px-2.5 text-xs ${r.isEnabled ? 'text-red-600' : ''}`}
              disabled={toggle.isPending}
              onClick={() =>
                toggle.mutate({ schoolId: r.school.id, isEnabled: !r.isEnabled })
              }
            >
              {r.isEnabled ? 'Remove' : 'Copy in'}
            </button>
          </>
        )}
      />

      {manage && (
        <ManageInstitutionModal
          institution={manage}
          onClose={() => setManage(null)}
        />
      )}
    </div>
  );
}

function ManageInstitutionModal({
  institution,
  onClose,
}: {
  institution: ExamBoardInstitution;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const schoolId = institution.school.id;

  const { data: courses = [] } = useQuery({
    queryKey: ['eb-institution-courses', schoolId],
    queryFn: () => ExamBoardApi.listInstitutionCourses(schoolId),
  });
  const { data: years = [] } = useQuery({
    queryKey: ['eb-institution-years', schoolId],
    queryFn: () => ExamBoardApi.listInstitutionAcademicYears(schoolId),
  });

  const toggleCourse = useMutation({
    mutationFn: ({ courseId, isEnabled }: { courseId: string; isEnabled: boolean }) =>
      ExamBoardApi.setInstitutionCourse(schoolId, courseId, isEnabled),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['eb-institution-courses', schoolId] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  const toggleYear = useMutation({
    mutationFn: ({ yearId, isEnabled }: { yearId: string; isEnabled: boolean }) =>
      ExamBoardApi.setInstitutionAcademicYear(schoolId, yearId, isEnabled),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['eb-institution-years', schoolId] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Manage — ${institution.school.name}`}
      description="Enable the courses and academic years this college can use."
      size="lg"
      footer={
        <button type="button" className="btn-secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="space-y-6">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">Academic Years</h4>
          {years.length === 0 ? (
            <p className="text-sm text-slate-400">
              No academic years defined yet. Add one in the Academic Years tab first.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {years.map(({ academicYear, isEnabled }) => (
                <label
                  key={academicYear.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>
                    {academicYear.name}
                    <span className="ml-2 text-xs text-slate-400">
                      {formatDate(academicYear.startDate)} – {formatDate(academicYear.endDate)}
                    </span>
                  </span>
                  <Checkbox
                    label=""
                    checked={isEnabled}
                    disabled={toggleYear.isPending}
                    onChange={(e) =>
                      toggleYear.mutate({
                        yearId: academicYear.id,
                        isEnabled: e.target.checked,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">Courses</h4>
          {courses.length === 0 ? (
            <p className="text-sm text-slate-400">
              No courses defined yet. Add one in the Courses tab first.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {courses.map(({ course, isEnabled }) => (
                <label
                  key={course.id}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span>
                    {course.name}
                    {course.code && (
                      <code className="ml-2 text-xs text-slate-400">{course.code}</code>
                    )}
                  </span>
                  <Checkbox
                    label=""
                    checked={isEnabled}
                    disabled={toggleCourse.isPending}
                    onChange={(e) =>
                      toggleCourse.mutate({
                        courseId: course.id,
                        isEnabled: e.target.checked,
                      })
                    }
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Courses ────────────────────────────────────────────────────────────────────
const LEVELS = ['ug', 'pg', 'diploma', 'phd', 'certificate', 'other'] as const;
const TERM_SYSTEMS = ['annual', 'semester', 'trimester'] as const;

const courseSchema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().optional().or(z.literal('')),
  level: z.enum(LEVELS),
  termSystem: z.enum(TERM_SYSTEMS),
  durationYears: z.coerce.number().min(1).max(10),
});
type CourseForm = z.infer<typeof courseSchema>;

function CoursesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExamBoardCourse | null>(null);
  const [deleting, setDeleting] = useState<ExamBoardCourse | null>(null);
  const { data: courses = [], isLoading } = useQuery({
    queryKey: ['eb-courses'],
    queryFn: ExamBoardApi.listCourses,
  });

  const remove = useMutation({
    mutationFn: (id: string) => ExamBoardApi.deleteCourse(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-courses'] });
      setDeleting(null);
      toast.success('Course deleted');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const save = useMutation({
    mutationFn: (p: CreateExamBoardCoursePayload) =>
      editing ? ExamBoardApi.updateCourse(editing.id, p) : ExamBoardApi.createCourse(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-courses'] });
      setOpen(false);
      toast.success(editing ? 'Course updated' : 'Course created');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CourseForm>({
    resolver: zodResolver(courseSchema),
    values: editing
      ? {
          name: editing.name,
          code: editing.code ?? '',
          level: editing.level,
          termSystem: editing.termSystem,
          durationYears: editing.durationYears,
        }
      : { name: '', code: '', level: 'ug', termSystem: 'annual', durationYears: 3 },
  });

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: ExamBoardCourse) => { setEditing(c); setOpen(true); };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Add course
        </button>
      </div>
      <DataTable<ExamBoardCourse>
        rows={courses}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No courses yet."
        columns={[
          { key: 'name', header: 'Course', render: (c) => (
            <div className="leading-tight">
              <div className="font-medium text-slate-900">{c.name}</div>
              {c.code && <code className="text-xs text-slate-500">{c.code}</code>}
            </div>
          ) },
          { key: 'level', header: 'Level', render: (c) => <Badge tone="indigo">{c.level.toUpperCase()}</Badge> },
          { key: 'termSystem', header: 'Term system' },
          { key: 'durationYears', header: 'Duration (yrs)' },
          { key: 'isActive', header: 'Status', render: (c) => (
            <Badge tone={c.isActive ? 'green' : 'slate'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
          ) },
        ]}
        actions={(c) => (
          <>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" title="Edit" onClick={() => openEdit(c)}>
              <Pencil className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => setDeleting(c)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete course?"
        message={`Delete "${deleting?.name}". This fails if any batch still uses it.`}
        confirmText="Delete course"
      />

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title={editing ? `Edit — ${editing.name}` : 'Add course'}
        description="This becomes available for institutions to enable."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => save.mutate({
              ...v, code: v.code || undefined,
            }))} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add course'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Course name" required error={errors.name?.message} className="sm:col-span-2">
            <Input {...register('name')} placeholder="B.Sc Computer Science" />
          </Field>
          <Field label="Code" error={errors.code?.message}>
            <Input {...register('code')} placeholder="BSC-CS" />
          </Field>
          <Field label="Level" error={errors.level?.message}>
            <Select {...register('level')}>
              {LEVELS.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
            </Select>
          </Field>
          <Field label="Term system" error={errors.termSystem?.message}>
            <Select {...register('termSystem')}>
              {TERM_SYSTEMS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Duration (years)" error={errors.durationYears?.message}>
            <Input type="number" min={1} max={10} {...register('durationYears')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

// ── Schemes ──────────────────────────────────────────────────────────────────
const schemeSchema = z.object({
  examBoardCourseId: z.string().min(1, 'Required'),
  startingAcademicYearId: z.string().optional().or(z.literal('')),
  name: z.string().min(1, 'Required'),
  code: z.string().optional().or(z.literal('')),
});
type SchemeForm = z.infer<typeof schemeSchema>;

function SchemesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExamBoardScheme | null>(null);
  const [deleting, setDeleting] = useState<ExamBoardScheme | null>(null);
  const [managing, setManaging] = useState<ExamBoardScheme | null>(null);
  const [courseFilter, setCourseFilter] = useState('');
  const { data: courses = [] } = useQuery({ queryKey: ['eb-courses'], queryFn: ExamBoardApi.listCourses });
  const { data: schemes = [], isLoading } = useQuery({
    queryKey: ['eb-schemes', courseFilter],
    queryFn: () => ExamBoardApi.listSchemes(courseFilter || undefined),
  });
  const { data: years = [] } = useQuery({ queryKey: ['eb-academic-years'], queryFn: ExamBoardApi.listAcademicYears });
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? id;
  const yearName = (id: string | null) => (id ? years.find((y) => y.id === id)?.name ?? id : '—');

  const save = useMutation({
    mutationFn: (p: CreateExamBoardSchemePayload) =>
      editing
        ? ExamBoardApi.updateScheme(editing.id, {
            name: p.name,
            code: p.code,
            startingAcademicYearId: p.startingAcademicYearId || undefined,
          })
        : ExamBoardApi.createScheme(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-schemes'] });
      setOpen(false);
      toast.success(editing ? 'Scheme updated' : 'Scheme created');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SchemeForm>({
    resolver: zodResolver(schemeSchema),
    values: editing
      ? {
          examBoardCourseId: editing.examBoardCourseId,
          startingAcademicYearId: editing.startingAcademicYearId ?? '',
          name: editing.name,
          code: editing.code ?? '',
        }
      : { examBoardCourseId: courseFilter, startingAcademicYearId: '', name: '', code: '' },
  });

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (s: ExamBoardScheme) => { setEditing(s); setOpen(true); };

  const remove = useMutation({
    mutationFn: (id: string) => ExamBoardApi.deleteScheme(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-schemes'] });
      setDeleting(null);
      toast.success('Scheme deleted');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <button className="btn-primary" onClick={openCreate} disabled={courses.length === 0}>
          <Plus className="mr-1.5 h-4 w-4" /> Add scheme
        </button>
      </div>
      {courses.length === 0 && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Add a course first (Courses tab) — schemes belong to a course.
        </div>
      )}
      <DataTable<ExamBoardScheme>
        rows={schemes}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No schemes yet."
        columns={[
          { key: 'name', header: 'Scheme', render: (s) => (
            <div className="leading-tight">
              <div className="font-medium text-slate-900">{s.name}</div>
              {s.code && <code className="text-xs text-slate-500">{s.code}</code>}
            </div>
          ) },
          { key: 'course', header: 'Course', render: (s) => courseName(s.examBoardCourseId) },
          { key: 'startingYear', header: 'Starting Year', render: (s) => yearName(s.startingAcademicYearId) },
          { key: 'isActive', header: 'Status', render: (s) => (
            <Badge tone={s.isActive ? 'green' : 'slate'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
          ) },
        ]}
        actions={(s) => (
          <>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" title="Manage subjects" onClick={() => setManaging(s)}>
              <Settings2 className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" title="Edit" onClick={() => openEdit(s)}>
              <Pencil className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => setDeleting(s)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete scheme?"
        message={`Delete "${deleting?.name}". This fails if any batch still uses it.`}
        confirmText="Delete scheme"
      />

      {managing && (
        <ManageSchemeModal scheme={managing} allSchemes={schemes} onClose={() => setManaging(null)} />
      )}

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title={editing ? `Edit — ${editing.name}` : 'Add scheme'}
        description="A curriculum regulation under a course (e.g. '2026 Scheme')."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => save.mutate({
              ...v, code: v.code || undefined, startingAcademicYearId: v.startingAcademicYearId || undefined,
            }))} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add scheme'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4">
          <Field label="Course" required error={errors.examBoardCourseId?.message}>
            <Select {...register('examBoardCourseId')} disabled={!!editing}>
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Starting academic year" error={errors.startingAcademicYearId?.message}>
            <Select {...register('startingAcademicYearId')}>
              <option value="">None</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Scheme name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="2026 Scheme" />
          </Field>
          <Field label="Code" error={errors.code?.message}>
            <Input {...register('code')} placeholder="SCH-2026" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

function ManageSchemeModal({
  scheme,
  allSchemes,
  onClose,
}: {
  scheme: ExamBoardScheme;
  allSchemes: ExamBoardScheme[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [activeTerm, setActiveTerm] = useState<number | null>(null);
  const [copySource, setCopySource] = useState('');
  const { data: terms = [] } = useQuery<CourseTerm[]>({
    queryKey: ['eb-course-terms', scheme.examBoardCourseId],
    queryFn: () => ExamBoardApi.listCourseTerms(scheme.examBoardCourseId),
  });

  const copyConfig = useMutation({
    mutationFn: () => ExamBoardApi.copySchemeConfig(scheme.id, copySource),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['eb-scheme-term-subjects'] });
      toast.success(`Copied ${r.copiedSubjects} subject assignment(s)`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const otherSchemesSameCourse = allSchemes.filter(
    (s) => s.id !== scheme.id && s.examBoardCourseId === scheme.examBoardCourseId,
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Manage — ${scheme.name}`}
      description="Assign subjects for each Year/Semester. Every batch on this scheme shares this curriculum."
      size="xl"
      footer={<button type="button" className="btn-secondary" onClick={onClose}>Close</button>}
    >
      {otherSchemesSameCourse.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-slate-200 p-3">
          <Field label="Copy config from another scheme" className="flex-1 min-w-[200px]">
            <Select value={copySource} onChange={(e) => setCopySource(e.target.value)}>
              <option value="">Select scheme…</option>
              {otherSchemesSameCourse.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <button
            className="btn-secondary"
            disabled={!copySource || copyConfig.isPending}
            onClick={() => copyConfig.mutate()}
          >
            <Copy className="mr-1.5 h-4 w-4 inline" /> Copy
          </button>
        </div>
      )}
      <div className="mb-4 border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-1">
          {terms.map((t) => {
            const isActive = (activeTerm ?? terms[0]?.number) === t.number;
            return (
              <button
                key={t.number}
                onClick={() => setActiveTerm(t.number)}
                className={`border-b-2 px-3 pb-2.5 text-sm font-medium ${
                  isActive
                    ? 'border-brand-500 text-brand-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
      </div>
      {terms.length > 0 && (
        <>
          <SchemeTermSyllabus
            schemeId={scheme.id}
            termNumber={activeTerm ?? terms[0].number}
          />
          <SchemeTermSubjects
            schemeId={scheme.id}
            termNumber={activeTerm ?? terms[0].number}
          />
        </>
      )}
    </Modal>
  );
}

function SchemeTermSyllabus({ schemeId, termNumber }: { schemeId: string; termNumber: number }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { data: syllabi = [] } = useQuery({
    queryKey: ['eb-scheme-syllabi', schemeId],
    queryFn: () => ExamBoardApi.listSchemeSyllabi(schemeId),
  });
  const syllabus = syllabi.find((s) => s.termNumber === termNumber) ?? null;

  const upload = useMutation({
    mutationFn: (file: File) => ExamBoardApi.uploadSchemeSyllabus(schemeId, termNumber, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-scheme-syllabi', schemeId] });
      toast.success('Syllabus uploaded');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const remove = useMutation({
    mutationFn: () => ExamBoardApi.deleteSchemeSyllabus(schemeId, termNumber),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-scheme-syllabi', schemeId] });
      toast.success('Syllabus removed');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-slate-200 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-700">Syllabus PDF</div>
        {syllabus ? (
          <a
            href={syllabus.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm text-brand-600 hover:underline"
          >
            {syllabus.fileName}
          </a>
        ) : (
          <p className="text-sm text-slate-400">No syllabus uploaded for this term yet.</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate(file);
            e.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn-secondary !py-1 !px-2.5 text-xs"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? 'Uploading…' : syllabus ? 'Replace' : 'Upload PDF'}
        </button>
        {syllabus && (
          <button
            type="button"
            className="btn-secondary !py-1 !px-2.5 text-xs text-red-600"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function SchemeTermSubjects({ schemeId, termNumber }: { schemeId: string; termNumber: number }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['eb-scheme-term-subjects', schemeId, termNumber],
    queryFn: () => ExamBoardApi.listSchemeTermSubjects(schemeId, termNumber),
  });

  const setSubjects = useMutation({
    mutationFn: (examBoardSubjectIds: string[]) =>
      ExamBoardApi.setSchemeTermSubjects(schemeId, termNumber, examBoardSubjectIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-scheme-term-subjects', schemeId, termNumber] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const toggle = (subjectId: string, checked: boolean) => {
    const current = rows.filter((r) => r.isAssigned).map((r) => r.subject.id);
    const next = checked ? [...current, subjectId] : current.filter((id) => id !== subjectId);
    setSubjects.mutate(next);
  };

  if (isLoading) return <div className="py-4 text-center text-slate-400">Loading…</div>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No subjects defined for this course/term yet. Add them in the Subjects section.
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
      {rows.map(({ subject, isAssigned }) => (
        <label key={subject.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span>
              {subject.name}
              {subject.code && <code className="ml-2 text-xs text-slate-400">{subject.code}</code>}
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Max/Pass: {subject.maxMarks}/{subject.passMarks}
              {(subject.ceMaxMarks != null || subject.cePassMarks != null) && (
                <> &nbsp;·&nbsp; CE: {subject.ceMaxMarks ?? '—'}/{subject.cePassMarks ?? '—'}</>
              )}
            </span>
          </span>
          <Checkbox
            label=""
            checked={isAssigned}
            disabled={setSubjects.isPending}
            onChange={(e) => toggle(subject.id, e.target.checked)}
          />
        </label>
      ))}
    </div>
  );
}

// ── Subjects ─────────────────────────────────────────────────────────────────
const subjectSchema = z.object({
  examBoardCourseId: z.string().min(1, 'Required'),
  termNumber: z.coerce.number().min(1),
  name: z.string().min(1, 'Required'),
  nameArabic: z.string().optional().or(z.literal('')),
  code: z.string().optional().or(z.literal('')),
  maxMarks: z.coerce.number().min(1),
  passMarks: z.coerce.number().min(0),
  ceMaxMarks: optionalNumber(0),
  cePassMarks: optionalNumber(0),
});
type SubjectForm = z.infer<typeof subjectSchema>;

function SubjectsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExamBoardSubject | null>(null);
  const [deleting, setDeleting] = useState<ExamBoardSubject | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    setPage(1);
  }, [courseFilter, search, limit]);

  const { data: courses = [] } = useQuery({ queryKey: ['eb-courses'], queryFn: ExamBoardApi.listCourses });
  const { data: subjectsPage, isLoading } = useQuery({
    queryKey: ['eb-subjects', courseFilter, search, page, limit],
    queryFn: () =>
      ExamBoardApi.listSubjects({
        examBoardCourseId: courseFilter || undefined,
        search: search || undefined,
        page,
        limit,
      }),
    placeholderData: keepPreviousData,
  });
  const subjects = subjectsPage?.items ?? [];
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? id;

  const save = useMutation({
    mutationFn: (p: CreateExamBoardSubjectPayload) =>
      editing
        ? ExamBoardApi.updateSubject(editing.id, {
            termNumber: p.termNumber,
            name: p.name,
            nameArabic: p.nameArabic,
            code: p.code,
            maxMarks: p.maxMarks,
            passMarks: p.passMarks,
            ceMaxMarks: p.ceMaxMarks,
            cePassMarks: p.cePassMarks,
          })
        : ExamBoardApi.createSubject(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-subjects'] });
      setOpen(false);
      toast.success(editing ? 'Subject updated' : 'Subject created');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    values: editing
      ? {
          examBoardCourseId: editing.examBoardCourseId,
          termNumber: editing.termNumber,
          name: editing.name,
          nameArabic: editing.nameArabic ?? '',
          code: editing.code ?? '',
          maxMarks: editing.maxMarks,
          passMarks: editing.passMarks,
          ceMaxMarks: editing.ceMaxMarks ?? undefined,
          cePassMarks: editing.cePassMarks ?? undefined,
        }
      : {
          examBoardCourseId: courseFilter,
          termNumber: 1,
          name: '',
          nameArabic: '',
          code: '',
          maxMarks: 100,
          passMarks: 35,
          ceMaxMarks: undefined,
          cePassMarks: undefined,
        },
  });
  const formCourseId = watch('examBoardCourseId');
  const { data: terms = [] } = useQuery<CourseTerm[]>({
    queryKey: ['eb-course-terms', formCourseId],
    queryFn: () => ExamBoardApi.listCourseTerms(formCourseId),
    enabled: open && !!formCourseId,
  });

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (s: ExamBoardSubject) => { setEditing(s); setOpen(true); };

  const remove = useMutation({
    mutationFn: (id: string) => ExamBoardApi.deleteSubject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-subjects'] });
      setDeleting(null);
      toast.success('Subject deleted');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-200 py-1.5 pl-9 pr-3 text-sm"
            />
          </div>
          <Select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="max-w-xs"
          >
            <option value="">All courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-secondary"
            onClick={() => setImportOpen(true)}
            disabled={!courseFilter}
            title={!courseFilter ? 'Select a course above to import into' : 'Import subjects from Excel'}
          >
            <Upload className="mr-1.5 h-4 w-4" /> Import
          </button>
          <button className="btn-primary" onClick={openCreate} disabled={courses.length === 0}>
            <Plus className="mr-1.5 h-4 w-4" /> Add subject
          </button>
        </div>
      </div>
      {courses.length === 0 && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Add a course first (Courses tab) — subjects belong to a course.
        </div>
      )}
      {courses.length > 0 && !courseFilter && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Select a course above to enable importing subjects from Excel.
        </div>
      )}
      <DataTable<ExamBoardSubject>
        rows={subjects}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No subjects yet."
        columns={[
          { key: 'sno', header: 'S.No', render: (s) => (page - 1) * limit + subjects.findIndex((r) => r.id === s.id) + 1 },
          { key: 'name', header: 'Subject', render: (s) => (
            <div className="leading-tight">
              <div className="font-medium text-slate-900">{s.name}</div>
              {s.code && <code className="text-xs text-slate-500">{s.code}</code>}
            </div>
          ) },
          { key: 'nameArabic', header: 'Arabic Name', render: (s) => (
            <span dir="rtl" className="font-medium text-slate-900">{s.nameArabic || '—'}</span>
          ) },
          { key: 'course', header: 'Course', render: (s) => courseName(s.examBoardCourseId) },
          { key: 'term', header: 'Year/Semester', render: (s) => `Term ${s.termNumber}` },
          { key: 'marks', header: 'Max / Pass', render: (s) => `${s.maxMarks} / ${s.passMarks}` },
          { key: 'ceMarks', header: 'CE Max / Pass', render: (s) => (
            s.ceMaxMarks != null || s.cePassMarks != null
              ? `${s.ceMaxMarks ?? '—'} / ${s.cePassMarks ?? '—'}`
              : '—'
          ) },
          { key: 'isActive', header: 'Status', render: (s) => (
            <Badge tone={s.isActive ? 'green' : 'slate'}>{s.isActive ? 'Active' : 'Inactive'}</Badge>
          ) },
        ]}
        actions={(s) => (
          <>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" title="Edit" onClick={() => openEdit(s)}>
              <Pencil className="h-4 w-4" />
            </button>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => setDeleting(s)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      {subjectsPage && (
        <Pagination
          page={subjectsPage.page}
          totalPages={subjectsPage.totalPages}
          total={subjectsPage.total}
          limit={subjectsPage.limit}
          onPageChange={setPage}
          onLimitChange={setLimit}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete subject?"
        message={`Delete "${deleting?.name}". Any batch assignments for it are removed too.`}
        confirmText="Delete subject"
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ['eb-subjects'] })}
        title="Import subjects"
        description={`Upload the .xlsx template. Each row is imported into "${courseName(courseFilter)}" for the Year/Semester given.`}
        noun="subject"
        onTemplate={() => ExamBoardApi.importSubjectsTemplate()}
        onPreview={(f) => ExamBoardApi.importSubjectsPreview(f, courseFilter)}
        onCommit={(f) => ExamBoardApi.importSubjectsCommit(f, courseFilter)}
      />

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title={editing ? `Edit — ${editing.name}` : 'Add subject'}
        description="Belongs to a course + Year/Semester; assign it into batches later."
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => save.mutate({
              ...v, code: v.code || undefined, nameArabic: v.nameArabic || undefined,
            }))} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add subject'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Course" required error={errors.examBoardCourseId?.message} className="sm:col-span-2">
            <Select {...register('examBoardCourseId')} disabled={!!editing}>
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Year/Semester" required error={errors.termNumber?.message}>
            <Select {...register('termNumber')} disabled={!formCourseId}>
              {terms.map((t) => <option key={t.number} value={t.number}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Subject name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="Data Structures" />
          </Field>
          <Field label="Arabic name" error={errors.nameArabic?.message}>
            <Input {...register('nameArabic')} dir="rtl" placeholder="هياكل البيانات" />
          </Field>
          <Field label="Code" error={errors.code?.message}>
            <Input {...register('code')} placeholder="CS101" />
          </Field>
          <Field label="Max marks" error={errors.maxMarks?.message}>
            <Input type="number" {...register('maxMarks')} />
          </Field>
          <Field label="Pass marks" error={errors.passMarks?.message}>
            <Input type="number" {...register('passMarks')} />
          </Field>
          <Field label="CE max marks" error={errors.ceMaxMarks?.message}>
            <Input type="number" {...register('ceMaxMarks')} placeholder="Optional" />
          </Field>
          <Field label="CE pass marks" error={errors.cePassMarks?.message}>
            <Input type="number" {...register('cePassMarks')} placeholder="Optional" />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

// ── Academic Years ─────────────────────────────────────────────────────────────
const yearSchema = z.object({
  name: z.string().min(1, 'Required'),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
});
type YearForm = z.infer<typeof yearSchema>;

function AcademicYearsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExamBoardAcademicYear | null>(null);
  const [deleting, setDeleting] = useState<ExamBoardAcademicYear | null>(null);
  const { data: years = [], isLoading } = useQuery({
    queryKey: ['eb-years'],
    queryFn: ExamBoardApi.listAcademicYears,
  });

  const remove = useMutation({
    mutationFn: (id: string) => ExamBoardApi.deleteAcademicYear(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-years'] });
      setDeleting(null);
      toast.success('Academic year deleted');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const save = useMutation({
    mutationFn: (p: CreateExamBoardAcademicYearPayload) =>
      editing ? ExamBoardApi.updateAcademicYear(editing.id, p) : ExamBoardApi.createAcademicYear(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-years'] });
      setOpen(false);
      toast.success(editing ? 'Academic year updated' : 'Academic year created');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const setCurrent = useMutation({
    mutationFn: (id: string) => ExamBoardApi.setCurrentAcademicYear(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-years'] });
      toast.success('Marked as current');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<YearForm>({
    resolver: zodResolver(yearSchema),
    values: editing
      ? { name: editing.name, startDate: editing.startDate.slice(0, 10), endDate: editing.endDate.slice(0, 10) }
      : { name: '', startDate: '', endDate: '' },
  });

  const openCreate = () => { setEditing(null); setOpen(true); };
  const openEdit = (y: ExamBoardAcademicYear) => { setEditing(y); setOpen(true); };

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button className="btn-primary" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" /> Add academic year
        </button>
      </div>
      <DataTable<ExamBoardAcademicYear>
        rows={years}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No academic years yet."
        columns={[
          { key: 'name', header: 'Name', render: (y) => (
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-900">{y.name}</span>
              {y.isCurrent && <Badge tone="green">Current</Badge>}
            </div>
          ) },
          { key: 'range', header: 'Duration', render: (y) => `${formatDate(y.startDate)} – ${formatDate(y.endDate)}` },
        ]}
        actions={(y) => (
          <>
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" title="Edit" onClick={() => openEdit(y)}>
              <Pencil className="h-4 w-4" />
            </button>
            {!y.isCurrent && (
              <button
                className="rounded-md p-1.5 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                title="Mark as current"
                onClick={() => setCurrent.mutate(y.id)}
                disabled={setCurrent.isPending}
              >
                <Star className="h-4 w-4" />
              </button>
            )}
            <button className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => setDeleting(y)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        loading={remove.isPending}
        title="Delete academic year?"
        message={`Delete "${deleting?.name}". This fails if any batch still uses it.`}
        confirmText="Delete year"
      />

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title={editing ? `Edit — ${editing.name}` : 'Add academic year'}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => save.mutate(v))} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add year'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4">
          <Field label="Name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="2026-27" />
          </Field>
          <Field label="Start date" required error={errors.startDate?.message}>
            <Input type="date" {...register('startDate')} />
          </Field>
          <Field label="End date" required error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

// ── Batches ─────────────────────────────────────────────────────────────────────
const batchSchema = z.object({
  schoolId: z.string().min(1, 'Required'),
  examBoardCourseId: z.string().min(1, 'Required'),
  examBoardAcademicYearId: z.string().min(1, 'Required'),
  examBoardSchemeId: z.string().optional().or(z.literal('')),
  name: z.string().min(1, 'Required'),
  code: z.string().optional().or(z.literal('')),
  capacity: optionalNumber(1),
  copyFromBatchId: z.string().optional().or(z.literal('')),
});
type BatchForm = z.infer<typeof batchSchema>;

const batchEditSchema = z.object({
  examBoardSchemeId: z.string().optional().or(z.literal('')),
  name: z.string().min(1, 'Required'),
  code: z.string().optional().or(z.literal('')),
  capacity: optionalNumber(1),
  status: z.enum(['active', 'closed']),
});
type BatchEditForm = z.infer<typeof batchEditSchema>;

function EditBatchModal({
  batch,
  onClose,
}: {
  batch: ExamBoardBatch;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: schemes = [] } = useQuery({
    queryKey: ['eb-schemes', batch.examBoardCourseId],
    queryFn: () => ExamBoardApi.listSchemes(batch.examBoardCourseId),
  });
  const saveEdit = useMutation({
    mutationFn: (v: BatchEditForm) =>
      ExamBoardApi.updateBatch(batch.id, {
        examBoardSchemeId: v.examBoardSchemeId || undefined,
        name: v.name,
        code: v.code || undefined,
        capacity: v.capacity,
        status: v.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-batches'] });
      qc.invalidateQueries({ queryKey: ['eb-batch', batch.id] });
      toast.success('Batch updated');
      onClose();
    },
    onError: (e) => toast.error(errMsg(e)),
  });
  const editForm = useForm<BatchEditForm>({
    resolver: zodResolver(batchEditSchema),
    values: {
      examBoardSchemeId: batch.examBoardSchemeId ?? '',
      name: batch.name,
      code: batch.code ?? '',
      capacity: batch.capacity ?? undefined,
      status: batch.status,
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit — ${batch.name}`}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn-primary"
            onClick={editForm.handleSubmit((v) => saveEdit.mutate(v))}
            disabled={saveEdit.isPending}
          >
            {saveEdit.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form className="grid grid-cols-1 gap-4">
        <Field label="Batch name" required error={editForm.formState.errors.name?.message}>
          <Input {...editForm.register('name')} />
        </Field>
        <Field label="Code" error={editForm.formState.errors.code?.message}>
          <Input {...editForm.register('code')} />
        </Field>
        <Field label="Scheme" error={editForm.formState.errors.examBoardSchemeId?.message}>
          <Select {...editForm.register('examBoardSchemeId')}>
            <option value="">None</option>
            {schemes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
        <Field label="Capacity" error={editForm.formState.errors.capacity?.message}>
          <Input type="number" min={1} {...editForm.register('capacity')} />
        </Field>
        <Field label="Status" error={editForm.formState.errors.status?.message}>
          <Select {...editForm.register('status')}>
            <option value="active">active</option>
            <option value="closed">closed</option>
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

function BatchesTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ExamBoardBatch | null>(null);
  const [manageBatch, setManageBatch] = useState<ExamBoardBatch | null>(null);
  const [deleting, setDeleting] = useState<ExamBoardBatch | null>(null);
  const [schoolFilter, setSchoolFilter] = useState('');
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['eb-batches', schoolFilter],
    queryFn: () => ExamBoardApi.listBatches(schoolFilter ? { schoolId: schoolFilter } : undefined),
  });
  const { data: institutions = [] } = useQuery({
    queryKey: ['eb-institutions'],
    queryFn: ExamBoardApi.listInstitutions,
  });
  const { data: courses = [] } = useQuery({ queryKey: ['eb-courses'], queryFn: ExamBoardApi.listCourses });
  const { data: years = [] } = useQuery({ queryKey: ['eb-years'], queryFn: ExamBoardApi.listAcademicYears });

  const enabledInstitutions = institutions.filter((i) => i.isEnabled);
  const schoolName = (id: string) => institutions.find((i) => i.school.id === id)?.school.name ?? id;
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? id;
  const yearName = (id: string) => years.find((y) => y.id === id)?.name ?? id;

  const create = useMutation({
    mutationFn: async (p: CreateExamBoardBatchPayload & { copyFromBatchId?: string }) => {
      const { copyFromBatchId, ...payload } = p;
      const batch = await ExamBoardApi.createBatch(payload);
      if (copyFromBatchId) {
        await ExamBoardApi.copyBatchConfig(batch.id, copyFromBatchId);
      }
      return batch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-batches'] });
      setOpen(false);
      toast.success('Batch created');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const removeBatch = useMutation({
    mutationFn: (id: string) => ExamBoardApi.deleteBatch(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-batches'] });
      setDeleting(null);
      toast.success('Batch deleted');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<BatchForm>({
    resolver: zodResolver(batchSchema),
    values: {
      schoolId: '', examBoardCourseId: '', examBoardAcademicYearId: '',
      examBoardSchemeId: '', name: '', code: '', capacity: undefined, copyFromBatchId: '',
    },
  });
  const formCourseId = watch('examBoardCourseId');
  const { data: schemesForCourse = [] } = useQuery({
    queryKey: ['eb-schemes', formCourseId],
    queryFn: () => ExamBoardApi.listSchemes(formCourseId),
    enabled: open && !!formCourseId,
  });
  const batchesForCourse = batches.filter((b) => b.examBoardCourseId === formCourseId);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="">All colleges</option>
          {institutions.map((i) => (
            <option key={i.school.id} value={i.school.id}>{i.school.name}</option>
          ))}
        </Select>
        <button className="btn-primary" onClick={() => setOpen(true)} disabled={enabledInstitutions.length === 0}>
          <Plus className="mr-1.5 h-4 w-4" /> Add batch
        </button>
      </div>
      {enabledInstitutions.length === 0 && (
        <div className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Copy at least one institution into the Exam Board first (Institutions tab).
        </div>
      )}
      <DataTable<ExamBoardBatch>
        rows={batches}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No batches yet."
        columns={[
          { key: 'name', header: 'Batch', render: (b) => (
            <button
              className="text-left leading-tight hover:underline"
              onClick={() => navigate(`/org/exam-board/batches/${b.id}`)}
            >
              <div className="font-medium text-brand-700">{b.name}</div>
              {b.code && <code className="text-xs text-slate-500">{b.code}</code>}
            </button>
          ) },
          { key: 'school', header: 'Institution', render: (b) => schoolName(b.schoolId) },
          { key: 'course', header: 'Course', render: (b) => courseName(b.examBoardCourseId) },
          { key: 'year', header: 'Academic Year', render: (b) => yearName(b.examBoardAcademicYearId) },
          { key: 'capacity', header: 'Capacity', render: (b) => b.capacity ?? '—' },
          { key: 'status', header: 'Status', render: (b) => (
            <Badge tone={b.status === 'active' ? 'green' : 'slate'}>{b.status}</Badge>
          ) },
        ]}
        actions={(b) => (
          <>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
              title="Edit batch"
              onClick={() => setEditingBatch(b)}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
              title="Manage scheme & subjects"
              onClick={() => setManageBatch(b)}
            >
              <Settings2 className="h-4 w-4" />
            </button>
            <button
              className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
              title="Delete"
              onClick={() => setDeleting(b)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && removeBatch.mutate(deleting.id)}
        loading={removeBatch.isPending}
        title="Delete batch?"
        message={`Delete "${deleting?.name}". Its scheme/subject assignments are removed too.`}
        confirmText="Delete batch"
      />

      {editingBatch && (
        <EditBatchModal batch={editingBatch} onClose={() => setEditingBatch(null)} />
      )}

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title="Add batch"
        size="lg"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => create.mutate({
              ...v,
              code: v.code || undefined,
              capacity: v.capacity || undefined,
              examBoardSchemeId: v.examBoardSchemeId || undefined,
              copyFromBatchId: v.copyFromBatchId || undefined,
            }))} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Add batch'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Institution" required error={errors.schoolId?.message} className="sm:col-span-2">
            <Select {...register('schoolId')}>
              <option value="">Select institution…</option>
              {enabledInstitutions.map((i) => (
                <option key={i.school.id} value={i.school.id}>{i.school.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Course" required error={errors.examBoardCourseId?.message}>
            <Select {...register('examBoardCourseId')}>
              <option value="">Select course…</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Academic Year" required error={errors.examBoardAcademicYearId?.message}>
            <Select {...register('examBoardAcademicYearId')}>
              <option value="">Select year…</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </Select>
          </Field>
          <Field label="Scheme" hint="Optional — the curriculum regulation this batch follows" error={errors.examBoardSchemeId?.message}>
            <Select {...register('examBoardSchemeId')} disabled={!formCourseId}>
              <option value="">None</option>
              {schemesForCourse.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Batch name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="B.Sc CS 2026-27 Batch A" />
          </Field>
          <Field label="Code" error={errors.code?.message}>
            <Input {...register('code')} placeholder="A" />
          </Field>
          <Field label="Capacity" error={errors.capacity?.message}>
            <Input type="number" min={1} {...register('capacity')} placeholder="60" />
          </Field>
          <Field
            label="Copy config from"
            hint="Optional — copies the scheme + per-term subjects from an existing batch of the same course"
            error={errors.copyFromBatchId?.message}
            className="sm:col-span-2"
          >
            <Select {...register('copyFromBatchId')} disabled={!formCourseId || batchesForCourse.length === 0}>
              <option value="">Don't copy</option>
              {batchesForCourse.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
        </form>
      </Modal>

      {manageBatch && (
        <ManageBatchModal
          batch={manageBatch}
          allBatches={batches}
          onClose={() => setManageBatch(null)}
        />
      )}
    </div>
  );
}

function ManageBatchModal({
  batch,
  allBatches,
  onClose,
}: {
  batch: ExamBoardBatch;
  allBatches: ExamBoardBatch[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [activeTerm, setActiveTerm] = useState<number | null>(null);
  const [copySource, setCopySource] = useState('');

  const { data: terms = [] } = useQuery<CourseTerm[]>({
    queryKey: ['eb-course-terms', batch.examBoardCourseId],
    queryFn: () => ExamBoardApi.listCourseTerms(batch.examBoardCourseId),
  });
  const { data: schemesForCourse = [] } = useQuery({
    queryKey: ['eb-schemes', batch.examBoardCourseId],
    queryFn: () => ExamBoardApi.listSchemes(batch.examBoardCourseId),
  });

  const setScheme = useMutation({
    mutationFn: (examBoardSchemeId: string) =>
      ExamBoardApi.updateBatch(batch.id, { examBoardSchemeId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-batches'] });
      toast.success('Scheme updated');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const copyConfig = useMutation({
    mutationFn: () => ExamBoardApi.copyBatchConfig(batch.id, copySource),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['eb-batch-term-subjects'] });
      qc.invalidateQueries({ queryKey: ['eb-batches'] });
      toast.success(`Copied ${r.copiedSubjects} subject assignment(s)`);
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const otherBatchesSameCourse = allBatches.filter(
    (b) => b.id !== batch.id && b.examBoardCourseId === batch.examBoardCourseId,
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={`Manage — ${batch.name}`}
      description="Set the scheme, then assign subjects for each Year/Semester."
      size="xl"
      footer={<button type="button" className="btn-secondary" onClick={onClose}>Close</button>}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3 rounded-md border border-slate-200 p-3">
          <Field label="Scheme">
            <Select
              value={batch.examBoardSchemeId ?? ''}
              onChange={(e) => setScheme.mutate(e.target.value)}
              className="w-56"
            >
              <option value="">None</option>
              {schemesForCourse.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          {otherBatchesSameCourse.length > 0 && (
            <>
              <Field label="Copy config from another batch" className="flex-1 min-w-[200px]">
                <Select value={copySource} onChange={(e) => setCopySource(e.target.value)}>
                  <option value="">Select batch…</option>
                  {otherBatchesSameCourse.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <button
                className="btn-secondary"
                disabled={!copySource || copyConfig.isPending}
                onClick={() => copyConfig.mutate()}
              >
                <Copy className="mr-1.5 h-4 w-4 inline" /> Copy
              </button>
            </>
          )}
        </div>

        <div>
          <div className="mb-4 border-b border-slate-200">
            <nav className="-mb-px flex flex-wrap gap-1">
              {terms.map((t) => {
                const isActive = (activeTerm ?? terms[0]?.number) === t.number;
                return (
                  <button
                    key={t.number}
                    onClick={() => setActiveTerm(t.number)}
                    className={`border-b-2 px-3 pb-2.5 text-sm font-medium ${
                      isActive
                        ? 'border-brand-500 text-brand-700'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </nav>
          </div>
          {terms.length > 0 && (
            <BatchTermSubjects
              batchId={batch.id}
              termNumber={activeTerm ?? terms[0].number}
            />
          )}
        </div>
      </div>
    </Modal>
  );
}

function BatchTermSubjects({ batchId, termNumber }: { batchId: string; termNumber: number }) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['eb-batch-term-subjects', batchId, termNumber],
    queryFn: () => ExamBoardApi.listBatchTermSubjects(batchId, termNumber),
  });

  const setSubjects = useMutation({
    mutationFn: (examBoardSubjectIds: string[]) =>
      ExamBoardApi.setBatchTermSubjects(batchId, termNumber, examBoardSubjectIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-batch-term-subjects', batchId, termNumber] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const toggle = (subjectId: string, checked: boolean) => {
    const current = rows.filter((r) => r.isAssigned).map((r) => r.subject.id);
    const next = checked ? [...current, subjectId] : current.filter((id) => id !== subjectId);
    setSubjects.mutate(next);
  };

  if (isLoading) return <div className="py-4 text-center text-slate-400">Loading…</div>;
  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        No subjects defined for this course/term yet. Add them in the Subjects section.
      </p>
    );
  }

  return (
    <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
      {rows.map(({ subject, isAssigned }) => (
        <label key={subject.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0">
            <span>
              {subject.name}
              {subject.code && <code className="ml-2 text-xs text-slate-400">{subject.code}</code>}
            </span>
            <span className="mt-0.5 block text-xs text-slate-400">
              Max/Pass: {subject.maxMarks}/{subject.passMarks}
              {(subject.ceMaxMarks != null || subject.cePassMarks != null) && (
                <> &nbsp;·&nbsp; CE: {subject.ceMaxMarks ?? '—'}/{subject.cePassMarks ?? '—'}</>
              )}
            </span>
          </span>
          <Checkbox
            label=""
            checked={isAssigned}
            disabled={setSubjects.isPending}
            onChange={(e) => toggle(subject.id, e.target.checked)}
          />
        </label>
      ))}
    </div>
  );
}

// ── Batch Details (Subjects / Enrolled Students / Exam Schedules tabs) ────────
type BatchDetailTab = 'subjects' | 'students' | 'exams';
const BATCH_DETAIL_TABS: TabItem<BatchDetailTab>[] = [
  { key: 'subjects', label: 'Subjects' },
  { key: 'students', label: 'Enrolled students' },
  { key: 'exams', label: 'Exam schedules' },
];

export function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tab, setTab] = useState<BatchDetailTab>('subjects');

  const { data: batch, isLoading: batchLoading } = useQuery({
    queryKey: ['eb-batch', id],
    queryFn: () => ExamBoardApi.getBatch(id!),
    enabled: !!id,
  });
  const { data: institutions = [] } = useQuery({
    queryKey: ['eb-institutions'],
    queryFn: ExamBoardApi.listInstitutions,
  });
  const { data: courses = [] } = useQuery({ queryKey: ['eb-courses'], queryFn: ExamBoardApi.listCourses });
  const { data: years = [] } = useQuery({ queryKey: ['eb-years'], queryFn: ExamBoardApi.listAcademicYears });
  const { data: schemes = [] } = useQuery({ queryKey: ['eb-schemes', ''], queryFn: () => ExamBoardApi.listSchemes() });
  const { data: allBatches = [] } = useQuery({
    queryKey: ['eb-batches', ''],
    queryFn: () => ExamBoardApi.listBatches(),
  });

  const schoolName = (sid: string) => institutions.find((i) => i.school.id === sid)?.school.name ?? sid;
  const courseName = (cid: string) => courses.find((c) => c.id === cid)?.name ?? cid;
  const yearName = (yid: string) => years.find((y) => y.id === yid)?.name ?? yid;
  const schemeName = (sid: string | null) => (sid ? (schemes.find((s) => s.id === sid)?.name ?? sid) : 'None');

  return (
    <>
      <button
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
        onClick={() => navigate('/org/exam-board/batches')}
      >
        <ArrowLeft className="h-4 w-4" /> Back to batches
      </button>

      <PageHeader
        title={batch ? batch.name : batchLoading ? 'Loading…' : 'Batch not found'}
        description={batch ? `${courseName(batch.examBoardCourseId)} · ${yearName(batch.examBoardAcademicYearId)}` : undefined}
        actions={
          <SearchSelect
            className="min-w-[260px]"
            placeholder="Change batch…"
            value={id ?? ''}
            onChange={(newId) => newId !== id && navigate(`/org/exam-board/batches/${newId}`)}
            options={allBatches.map((b) => ({
              value: b.id,
              label: b.name,
              sublabel: schoolName(b.schoolId),
            }))}
          />
        }
      />

      {batch && (
        <div className="mb-5 grid grid-cols-2 gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <div className="text-xs text-slate-500">Course</div>
            <div className="text-sm font-medium text-slate-900">{courseName(batch.examBoardCourseId)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Academic Year</div>
            <div className="text-sm font-medium text-slate-900">{yearName(batch.examBoardAcademicYearId)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Scheme</div>
            <div className="text-sm font-medium text-slate-900">{schemeName(batch.examBoardSchemeId)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Code</div>
            <div className="text-sm font-medium text-slate-900">{batch.code ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Capacity</div>
            <div className="text-sm font-medium text-slate-900">{batch.capacity ?? '—'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Status</div>
            <Badge tone={batch.status === 'active' ? 'green' : 'slate'}>{batch.status}</Badge>
          </div>
        </div>
      )}

      <Tabs items={BATCH_DETAIL_TABS} active={tab} onChange={setTab} />

      {batch && tab === 'subjects' && <BatchSubjectsTab batch={batch} />}
      {batch && tab === 'students' && (
        <BatchStudentsTab batchId={batch.id} institutions={institutions} />
      )}
      {batch && tab === 'exams' && <BatchExamsTab batch={batch} />}
    </>
  );
}

function BatchSubjectsTab({ batch }: { batch: ExamBoardBatch }) {
  const [activeTerm, setActiveTerm] = useState<number | null>(null);

  const { data: terms = [] } = useQuery<CourseTerm[]>({
    queryKey: ['eb-course-terms', batch.examBoardCourseId],
    queryFn: () => ExamBoardApi.listCourseTerms(batch.examBoardCourseId),
  });

  return (
    <div className="space-y-6">
      <div>
        <nav className="mb-4 inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {terms.map((t) => {
            const isActive = (activeTerm ?? terms[0]?.number) === t.number;
            return (
              <button
                key={t.number}
                onClick={() => setActiveTerm(t.number)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-brand-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
        {terms.length > 0 && (
          <BatchTermSubjects
            batchId={batch.id}
            termNumber={activeTerm ?? terms[0].number}
          />
        )}
      </div>
    </div>
  );
}

function BatchStudentsTab({
  batchId,
  institutions,
}: {
  batchId: string;
  institutions: ExamBoardInstitution[];
}) {
  const navigate = useNavigate();
  const [schoolFilter, setSchoolFilter] = useState('');

  const { data: enrollments = [], isLoading: enrollLoading } = useQuery({
    queryKey: ['eb-batch-enrollments', batchId],
    queryFn: () => ExamBoardApi.listBatchEnrollments(batchId),
    enabled: !!batchId,
  });

  // A batch belongs to exactly one college — this filter narrows which
  // college's batches you're browsing, letting an admin jump straight to a
  // sibling batch at another college to view its enrolled students.
  const { data: siblingBatches = [] } = useQuery({
    queryKey: ['eb-batches', schoolFilter],
    queryFn: () => ExamBoardApi.listBatches(schoolFilter ? { schoolId: schoolFilter } : undefined),
    enabled: !!schoolFilter,
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">{enrollments.length} student(s) enrolled</div>
        <Select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="">Filter by college…</option>
          {institutions.map((i) => (
            <option key={i.school.id} value={i.school.id}>{i.school.name}</option>
          ))}
        </Select>
      </div>

      {schoolFilter && (
        <div className="mb-4 rounded-md border border-slate-200 bg-white p-3">
          {siblingBatches.length === 0 ? (
            <p className="text-sm text-slate-400">No batches for this college yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {siblingBatches.map((b) => (
                <button
                  key={b.id}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    b.id === batchId
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  onClick={() => navigate(`/org/exam-board/batches/${b.id}`)}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <DataTable<ExamBoardEnrollment>
        rows={enrollments}
        getRowId={(r) => r.id}
        isLoading={enrollLoading}
        emptyMessage="No students enrolled in this batch yet."
        columns={[
          { key: 'admissionNumber', header: 'Admission #', render: (e) => (
            <code className="text-xs">{e.student?.admissionNumber ?? '—'}</code>
          ) },
          { key: 'name', header: 'Name', render: (e) => (
            <span className="font-medium text-slate-900">{e.student?.studentName ?? '—'}</span>
          ) },
          { key: 'enrollmentDate', header: 'Enrolled on', render: (e) => formatDate(e.enrollmentDate) },
        ]}
      />
    </div>
  );
}

// ── Exams (org can schedule directly, on behalf of any institution) ──────────
const ORG_EXAM_TYPES = ['unit_test', 'mid_term', 'final', 'quarterly', 'half_yearly'] as const;
const batchExamSchema = z.object({
  termNumber: z.coerce.number().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  examType: z.enum(ORG_EXAM_TYPES),
  startDate: z.string().min(1, 'Required'),
  endDate: z.string().min(1, 'Required'),
});
type BatchExamForm = z.infer<typeof batchExamSchema>;

function ExamsTab() {
  const [batchId, setBatchId] = useState('');
  const { data: institutions = [] } = useQuery({
    queryKey: ['eb-institutions'],
    queryFn: ExamBoardApi.listInstitutions,
  });
  const { data: batches = [] } = useQuery({
    queryKey: ['eb-batches', ''],
    queryFn: () => ExamBoardApi.listBatches(),
  });
  const { data: courses = [] } = useQuery({ queryKey: ['eb-courses'], queryFn: ExamBoardApi.listCourses });
  const schoolName = (id: string) => institutions.find((i) => i.school.id === id)?.school.name ?? id;
  const courseName = (id: string) => courses.find((c) => c.id === id)?.name ?? id;
  const batch = batches.find((b) => b.id === batchId) ?? null;

  return (
    <div>
      <div className="mb-4">
        <SearchSelect
          className="max-w-md"
          placeholder="Select a batch to schedule exams for…"
          value={batchId}
          onChange={setBatchId}
          options={batches.map((b) => ({
            value: b.id,
            label: b.name,
            sublabel: `${schoolName(b.schoolId)} · ${courseName(b.examBoardCourseId)}`,
          }))}
        />
      </div>
      {!batch ? (
        <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Select a batch above to schedule and print its exams.
        </div>
      ) : (
        <BatchExamsScheduler
          batch={batch}
          context={{ collegeName: schoolName(batch.schoolId), courseName: courseName(batch.examBoardCourseId), batchName: batch.name }}
        />
      )}
    </div>
  );
}

function BatchExamsScheduler({
  batch,
  context,
}: {
  batch: ExamBoardBatch;
  context: { collegeName?: string; courseName?: string; batchName?: string };
}) {
  const qc = useQueryClient();
  const [activeTerm, setActiveTerm] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [viewingSubjects, setViewingSubjects] = useState<ExamBoardExam | null>(null);

  const { data: terms = [] } = useQuery<CourseTerm[]>({
    queryKey: ['eb-course-terms', batch.examBoardCourseId],
    queryFn: () => ExamBoardApi.listCourseTerms(batch.examBoardCourseId),
  });
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['eb-batch-exams', batch.id],
    queryFn: () => ExamBoardApi.listBatchExams(batch.id),
  });

  const currentTerm = activeTerm ?? terms[0]?.number;
  const currentTermLabel = terms.find((t) => t.number === currentTerm)?.label;
  const examsForTerm = exams.filter((e) => e.termNumber === currentTerm);

  const create = useMutation({
    mutationFn: (p: CreateBatchExamPayload) => ExamBoardApi.createBatchExam(batch.id, p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eb-batch-exams', batch.id] });
      setOpen(false);
      toast.success('Exam scheduled');
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<BatchExamForm>({
    resolver: zodResolver(batchExamSchema),
    values: { termNumber: currentTerm ?? 1, name: '', examType: 'unit_test', startDate: '', endDate: '' },
  });

  return (
    <div>
      {terms.length > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-slate-200">
          <nav className="-mb-px flex flex-wrap gap-1">
            {terms.map((t) => {
              const isActive = currentTerm === t.number;
              return (
                <button
                  key={t.number}
                  onClick={() => setActiveTerm(t.number)}
                  className={`border-b-2 px-3 pb-2.5 text-sm font-medium ${
                    isActive
                      ? 'border-brand-500 text-brand-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
          <button className="btn-primary mb-2" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Schedule exam
          </button>
        </div>
      )}

      <DataTable<ExamBoardExam>
        rows={examsForTerm}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No exams scheduled for this term yet."
        columns={[
          { key: 'name', header: 'Exam', render: (e) => e.name },
          { key: 'type', header: 'Type', render: (e) => e.examType.replace('_', ' ') },
          { key: 'dates', header: 'Dates', render: (e) => `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` },
          { key: 'status', header: 'Status', render: (e) => (
            <Badge tone={e.status === 'completed' ? 'green' : e.status === 'ongoing' ? 'amber' : 'slate'}>
              {e.status}
            </Badge>
          ) },
        ]}
        actions={(e) => (
          <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => setViewingSubjects(e)}>
            Schedule subjects / Print
          </button>
        )}
      />

      <Modal
        open={open}
        onClose={() => { reset(); setOpen(false); }}
        title={`Schedule exam — ${batch.name}`}
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className="btn-primary" onClick={handleSubmit((v) => create.mutate(v))} disabled={create.isPending}>
              {create.isPending ? 'Scheduling…' : 'Schedule'}
            </button>
          </>
        }
      >
        <form className="grid grid-cols-1 gap-4">
          <Field label="Term" required error={errors.termNumber?.message}>
            <Select {...register('termNumber')}>
              {terms.map((t) => <option key={t.number} value={t.number}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Exam name" required error={errors.name?.message}>
            <Input {...register('name')} placeholder="Semester 1 Final" />
          </Field>
          <Field label="Type" error={errors.examType?.message}>
            <Select {...register('examType')}>
              {ORG_EXAM_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </Select>
          </Field>
          <Field label="Start date" required error={errors.startDate?.message}>
            <Input type="date" {...register('startDate')} />
          </Field>
          <Field label="End date" required error={errors.endDate?.message}>
            <Input type="date" {...register('endDate')} />
          </Field>
        </form>
      </Modal>

      {viewingSubjects && (
        <ExamSubjectScheduleModal
          batchId={batch.id}
          exam={viewingSubjects}
          onClose={() => setViewingSubjects(null)}
          context={{ ...context, termLabel: currentTermLabel }}
        />
      )}
    </div>
  );
}

function BatchExamsTab({ batch }: { batch: ExamBoardBatch }) {
  const [activeTerm, setActiveTerm] = useState<number | null>(null);
  const [viewingSubjects, setViewingSubjects] = useState<ExamBoardExam | null>(null);

  const { data: terms = [] } = useQuery<CourseTerm[]>({
    queryKey: ['eb-course-terms', batch.examBoardCourseId],
    queryFn: () => ExamBoardApi.listCourseTerms(batch.examBoardCourseId),
  });
  const { data: exams = [], isLoading } = useQuery({
    queryKey: ['eb-batch-exams', batch.id],
    queryFn: () => ExamBoardApi.listBatchExams(batch.id),
  });

  const currentTerm = activeTerm ?? terms[0]?.number;
  const examsForTerm = exams.filter((e) => e.termNumber === currentTerm);

  return (
    <div>
      {terms.length > 0 && (
        <div className="mb-4 border-b border-slate-200">
          <nav className="-mb-px flex flex-wrap gap-1">
            {terms.map((t) => {
              const isActive = currentTerm === t.number;
              return (
                <button
                  key={t.number}
                  onClick={() => setActiveTerm(t.number)}
                  className={`border-b-2 px-3 pb-2.5 text-sm font-medium ${
                    isActive
                      ? 'border-brand-500 text-brand-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      <DataTable<ExamBoardExam>
        rows={examsForTerm}
        getRowId={(r) => r.id}
        isLoading={isLoading}
        emptyMessage="No exams scheduled for this term yet. The college schedules exams from its Examination Board module."
        columns={[
          { key: 'name', header: 'Exam', render: (e) => e.name },
          { key: 'type', header: 'Type', render: (e) => e.examType.replace('_', ' ') },
          { key: 'dates', header: 'Dates', render: (e) => `${formatDate(e.startDate)} – ${formatDate(e.endDate)}` },
          { key: 'status', header: 'Status', render: (e) => (
            <Badge tone={e.status === 'completed' ? 'green' : e.status === 'ongoing' ? 'amber' : 'slate'}>
              {e.status}
            </Badge>
          ) },
        ]}
        actions={(e) => (
          <button className="btn-secondary !py-1 !px-2.5 text-xs" onClick={() => setViewingSubjects(e)}>
            Subject-wise schedule
          </button>
        )}
      />

      {viewingSubjects && (
        <ExamSubjectScheduleModal
          batchId={batch.id}
          exam={viewingSubjects}
          onClose={() => setViewingSubjects(null)}
        />
      )}
    </div>
  );
}

function ExamSubjectScheduleModal({
  batchId,
  exam,
  onClose,
  context,
}: {
  batchId: string;
  exam: ExamBoardExam;
  onClose: () => void;
  context?: { collegeName?: string; batchName?: string; courseName?: string; termLabel?: string };
}) {
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['eb-batch-exam-subjects', batchId, exam.id],
    queryFn: () => ExamBoardApi.listBatchExamSubjects(batchId, exam.id),
  });
  const { data: termSubjects = [], isLoading: termLoading } = useQuery({
    queryKey: ['eb-batch-term-subjects', batchId, exam.termNumber],
    queryFn: () => ExamBoardApi.listBatchTermSubjects(batchId, exam.termNumber),
  });
  const assignedSubjects = termSubjects.filter((r) => r.isAssigned).map((r) => r.subject);
  const isLoading = subjectsLoading || termLoading;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Subject-wise schedule — ${exam.name}`}
      description={`${exam.examType.replace('_', ' ')} · ${formatDate(exam.startDate)} – ${formatDate(exam.endDate)}`}
      size="xl"
      footer={
        <>
          <button
            className="btn-secondary"
            onClick={() =>
              printExamSchedule(exam, subjects, context ?? {})
            }
          >
            <Printer className="mr-1.5 h-4 w-4 inline" /> Print / PDF
          </button>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </>
      }
    >
      {isLoading ? (
        <div className="py-6 text-center text-slate-400">Loading…</div>
      ) : assignedSubjects.length === 0 ? (
        <div className="py-6 text-center text-sm text-slate-400">
          No subjects are assigned to this batch's term yet — assign them from the Subjects tab first.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="py-1.5">Subject</th>
              <th className="py-1.5">Date</th>
              <th className="py-1.5">Time</th>
              <th className="py-1.5">Max / Pass</th>
            </tr>
          </thead>
          <tbody>
            {assignedSubjects.map((s) => (
              <OrgSubjectScheduleRow
                key={s.id}
                batchId={batchId}
                examId={exam.id}
                subjectMaster={s}
                existing={subjects.find((es) => es.subjectName === s.name) ?? null}
              />
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

function OrgSubjectScheduleRow({
  batchId,
  examId,
  subjectMaster,
  existing,
}: {
  batchId: string;
  examId: string;
  subjectMaster: ExamBoardSubject;
  existing: ExamBoardExamSubject | null;
}) {
  const qc = useQueryClient();
  const [rowId, setRowId] = useState(existing?.id ?? null);
  const [date, setDate] = useState(existing?.date?.slice(0, 10) ?? '');
  const [time, setTime] = useState(existing?.time?.slice(0, 5) ?? '');

  useEffect(() => {
    if (existing) {
      setRowId(existing.id);
      setDate(existing.date?.slice(0, 10) ?? '');
      setTime(existing.time?.slice(0, 5) ?? '');
    }
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = { date: date || undefined, time: time || undefined };
      if (rowId) {
        return ExamBoardApi.updateBatchExamSubject(batchId, examId, rowId, payload);
      }
      const created = await ExamBoardApi.addBatchExamSubject(batchId, examId, {
        subjectName: subjectMaster.name,
        maxMarks: subjectMaster.maxMarks,
        passMarks: subjectMaster.passMarks,
        ceMaxMarks: subjectMaster.ceMaxMarks ?? undefined,
        cePassMarks: subjectMaster.cePassMarks ?? undefined,
        ...payload,
      });
      setRowId(created.id);
      return created;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['eb-batch-exam-subjects', batchId, examId] }),
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <tr className="border-t border-slate-100">
      <td className="py-2 font-medium text-slate-900">{subjectMaster.name}</td>
      <td className="py-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          onBlur={() => save.mutate()}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2">
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          onBlur={() => save.mutate()}
          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
        />
      </td>
      <td className="py-2 text-slate-500">{subjectMaster.maxMarks} / {subjectMaster.passMarks}</td>
    </tr>
  );
}
