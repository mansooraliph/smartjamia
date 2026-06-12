import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  Upload,
  FileText,
  GraduationCap,
  ExternalLink,
  Camera,
  Loader2,
} from 'lucide-react';
import {
  AcademicYearsApi,
  ClassesApi,
  classLabel,
  DocumentsApi,
  ParentsApi,
  QualificationsApi,
  SectionsApi,
  StudentDocument,
  StudentDocumentType,
  StudentQualification,
  StudentsApi,
  UploadApi,
} from '@/services/school.api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, Input, Select, Textarea } from '@/components/ui/Input';
import { formatDate } from '@/lib/format';
import { useTerminology } from '@/hooks/useTerminology';
import { usePermissions } from '@/hooks/usePermissions';

type Tab = 'overview' | 'parents' | 'qualifications' | 'documents';

const DOC_TYPES: { value: StudentDocumentType; label: string }[] = [
  { value: 'aadhaar', label: 'Aadhaar' },
  { value: 'birth_certificate', label: 'Birth certificate' },
  { value: 'transfer_certificate', label: 'Transfer certificate' },
  { value: 'marksheet', label: 'Marksheet' },
  { value: 'id_proof', label: 'ID proof' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'caste_certificate', label: 'Caste certificate' },
  { value: 'income_certificate', label: 'Income certificate' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Other' },
];
const docLabel = (t: StudentDocumentType) =>
  DOC_TYPES.find((d) => d.value === t)?.label ?? t;

export function StudentViewPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const term = useTerminology();
  const { can } = usePermissions();
  const canWrite = can('/students', 'create');
  const canDelete = can('/students', 'delete');
  const [tab, setTab] = useState<Tab>('overview');

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: () => StudentsApi.get(id),
    enabled: !!id,
  });
  const { data: years = [] } = useQuery({
    queryKey: ['academic-years'],
    queryFn: AcademicYearsApi.list,
  });
  const { data: classes = [] } = useQuery({
    queryKey: ['classes', student?.enrollment?.academicYearId],
    queryFn: () => ClassesApi.list(student?.enrollment?.academicYearId),
    enabled: !!student?.enrollment?.academicYearId,
  });
  const { data: sections = [] } = useQuery({
    queryKey: ['sections-all'],
    queryFn: () => SectionsApi.list(),
  });

  const enrollmentLabel = useMemo(() => {
    const e = student?.enrollment;
    if (!e) return null;
    const yr = years.find((y) => y.id === e.academicYearId)?.name ?? '';
    const cls = classes.find((c) => c.id === e.classId);
    const sec = sections.find((s) => s.id === e.sectionId)?.name;
    return {
      year: yr,
      cls: cls ? classLabel(cls) : '',
      sec: sec ?? null,
      roll: e.rollNumber,
    };
  }, [student, years, classes, sections]);

  if (isLoading || !student) {
    return (
      <div className="card p-10 text-center text-slate-400">Loading…</div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'parents', label: 'Parents' },
    { key: 'qualifications', label: 'Qualifications' },
    { key: 'documents', label: 'Documents' },
  ];

  return (
    <>
      <button
        onClick={() => navigate('/students')}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to students
      </button>

      {/* Header card */}
      <div className="card mb-4 flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <StudentAvatar student={student} canEdit={canWrite} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-slate-900">
              {student.firstName} {student.lastName}
            </h1>
            <Badge tone={student.status === 'active' ? 'green' : 'slate'}>
              {student.status}
            </Badge>
            {student.userId && <Badge tone="blue">Portal access</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>
              Adm #{' '}
              <code className="text-slate-700">{student.admissionNumber}</code>
            </span>
            {enrollmentLabel && (
              <span>
                {enrollmentLabel.cls}
                {enrollmentLabel.sec ? ` · ${enrollmentLabel.sec}` : ''}
                {enrollmentLabel.year ? ` (${enrollmentLabel.year})` : ''}
                {enrollmentLabel.roll ? ` · Roll ${enrollmentLabel.roll}` : ''}
              </span>
            )}
          </div>
        </div>
        {canWrite && (
          <button
            className="btn-secondary self-start"
            onClick={() => navigate(`/students/${id}/edit`)}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> Edit
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? 'border-brand-500 text-brand-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab student={student} enrollment={enrollmentLabel} term={term} />
      )}
      {tab === 'parents' && (
        <ParentsTab studentId={id} canEdit={canWrite} />
      )}
      {tab === 'qualifications' && (
        <QualificationsTab
          studentId={id}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      )}
      {tab === 'documents' && (
        <DocumentsTab
          studentId={id}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      )}
    </>
  );
}

/* ── Photo avatar with upload ──────────────────────────────────────────────── */
function StudentAvatar({
  student,
  canEdit,
}: {
  student: { id: string; firstName: string; photoUrl: string | null };
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { url } = await UploadApi.upload(file);
      return StudentsApi.update(student.id, { photoUrl: url });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['student', student.id] }),
  });

  return (
    <div className="relative h-20 w-20 shrink-0">
      {student.photoUrl ? (
        <img
          src={student.photoUrl}
          alt=""
          className="h-20 w-20 rounded-full object-cover ring-1 ring-slate-200"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 text-2xl font-semibold text-brand-600">
          {student.firstName?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute -bottom-1 -right-1 rounded-full bg-white p-1.5 text-slate-600 shadow ring-1 ring-slate-200 hover:text-brand-600"
            title="Change photo"
          >
            {upload.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}

/* ── Overview ──────────────────────────────────────────────────────────────── */
function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="text-sm text-slate-800">{value || '—'}</dd>
    </div>
  );
}
function OverviewTab({
  student,
  enrollment,
  term,
}: {
  student: any;
  enrollment: {
    year: string;
    cls: string;
    sec: string | null;
    roll: string | null;
  } | null;
  term: ReturnType<typeof useTerminology>;
}) {
  return (
    <div className="space-y-4">
      <section className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Personal details</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Row label="First name" value={student.firstName} />
          <Row label="Last name" value={student.lastName} />
          <Row label="Gender" value={student.gender} />
          <Row label="Date of birth" value={formatDate(student.dateOfBirth)} />
          <Row label="Blood group" value={student.bloodGroup} />
          <Row label="Religion" value={student.religion} />
          <Row label="Caste" value={student.caste} />
          <Row label="Aadhaar #" value={student.aadharNumber} />
        </dl>
      </section>

      <section className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Address & contact</h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Row label="Address" value={student.address} />
          <Row label="City" value={student.city} />
          <Row label="State" value={student.state} />
          <Row label="Pincode" value={student.pincode} />
        </dl>
      </section>

      <section className="card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">
          Admission & enrollment
        </h3>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Row label="Admission #" value={student.admissionNumber} />
          <Row label="Admission date" value={formatDate(student.admissionDate)} />
          <Row label="Previous school" value={student.previousSchool} />
          <Row label="Status" value={student.status} />
          <Row label="Academic year" value={enrollment?.year} />
          <Row label={term.level} value={enrollment?.cls} />
          <Row label={term.group} value={enrollment?.sec} />
          <Row label="Roll number" value={enrollment?.roll} />
        </dl>
      </section>
    </div>
  );
}

/* ── Parents ───────────────────────────────────────────────────────────────── */
function ParentsTab({
  studentId,
  canEdit,
}: {
  studentId: string;
  canEdit: boolean;
}) {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['student-parents', studentId],
    queryFn: () => ParentsApi.list({ studentId, limit: 100 }),
  });
  const parents = data?.items ?? [];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canEdit && (
          <button
            className="btn-secondary text-sm"
            onClick={() => navigate(`/students/${studentId}/edit`)}
          >
            <Pencil className="mr-1.5 h-4 w-4" /> Manage guardians
          </button>
        )}
      </div>
      {parents.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          No parents/guardians recorded.{' '}
          {canEdit && 'Use “Manage guardians” to add them.'}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parents.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium capitalize text-slate-900">
                  {p.relation}
                </span>
                {p.isPrimary && <Badge tone="green">Primary</Badge>}
              </div>
              <div className="mt-2 space-y-1 text-sm text-slate-600">
                <div className="font-medium text-slate-800">{p.name}</div>
                <div>📞 {p.phone}</div>
                {p.email && <div>✉️ {p.email}</div>}
                {p.occupation && <div>💼 {p.occupation}</div>}
                {p.annualIncome != null && (
                  <div>₹ {p.annualIncome.toLocaleString('en-IN')} / yr</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Qualifications ────────────────────────────────────────────────────────── */
const qualSchema = z.object({
  examName: z.string().min(1, 'Required'),
  board: z.string().optional().or(z.literal('')),
  institution: z.string().optional().or(z.literal('')),
  yearOfPassing: z.string().optional().or(z.literal('')),
  percentage: z.string().optional().or(z.literal('')),
  grade: z.string().optional().or(z.literal('')),
  registerNumber: z.string().optional().or(z.literal('')),
});
type QualForm = z.infer<typeof qualSchema>;

function QualificationsTab({
  studentId,
  canWrite,
  canDelete,
}: {
  studentId: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ['qualifications', studentId],
    queryFn: () => QualificationsApi.list(studentId),
  });
  const [modal, setModal] = useState<{
    open: boolean;
    q?: StudentQualification;
  }>({ open: false });
  const [confirm, setConfirm] = useState<{
    open: boolean;
    q?: StudentQualification;
  }>({ open: false });

  const remove = useMutation({
    mutationFn: (qid: string) => QualificationsApi.remove(qid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['qualifications', studentId] });
      setConfirm({ open: false });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canWrite && (
          <button
            className="btn-primary text-sm"
            onClick={() => setModal({ open: true })}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add qualification
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          <GraduationCap className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          No prior qualifications recorded (e.g. 10th, Higher Secondary, Diploma).
        </div>
      ) : (
        <div className="card divide-y divide-slate-100">
          {items.map((q) => (
            <div
              key={q.id}
              className="flex items-start justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <div className="font-medium text-slate-900">{q.examName}</div>
                <div className="mt-0.5 text-sm text-slate-500">
                  {[q.board, q.institution].filter(Boolean).join(' · ') || '—'}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {q.yearOfPassing && <span>Year {q.yearOfPassing}</span>}
                  {q.percentage && <span>Score {q.percentage}</span>}
                  {q.grade && <span>Grade {q.grade}</span>}
                  {q.registerNumber && <span>Reg# {q.registerNumber}</span>}
                  {q.fileUrl && (
                    <a
                      href={q.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> Certificate
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {canWrite && (
                  <button
                    className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600"
                    onClick={() => setModal({ open: true, q })}
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {canDelete && (
                  <button
                    className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setConfirm({ open: true, q })}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <QualificationModal
          studentId={studentId}
          qual={modal.q}
          onClose={() => setModal({ open: false })}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['qualifications', studentId] });
            setModal({ open: false });
          }}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.q && remove.mutate(confirm.q.id)}
        loading={remove.isPending}
        title="Delete qualification?"
        message={`Remove "${confirm.q?.examName}" from this student's record.`}
        confirmText="Delete"
      />
    </div>
  );
}

function QualificationModal({
  studentId,
  qual,
  onClose,
  onSaved,
}: {
  studentId: string;
  qual?: StudentQualification;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fileUrl, setFileUrl] = useState<string | null>(qual?.fileUrl ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadCert = useMutation({
    mutationFn: (f: File) => UploadApi.upload(f),
    onSuccess: (r) => setFileUrl(r.url),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<QualForm>({
    resolver: zodResolver(qualSchema),
    values: {
      examName: qual?.examName ?? '',
      board: qual?.board ?? '',
      institution: qual?.institution ?? '',
      yearOfPassing: qual?.yearOfPassing ? String(qual.yearOfPassing) : '',
      percentage: qual?.percentage ?? '',
      grade: qual?.grade ?? '',
      registerNumber: qual?.registerNumber ?? '',
    },
  });

  const save = useMutation({
    mutationFn: (v: QualForm) => {
      const payload: Record<string, unknown> = {
        examName: v.examName,
        board: v.board || undefined,
        institution: v.institution || undefined,
        yearOfPassing: v.yearOfPassing ? Number(v.yearOfPassing) : undefined,
        percentage: v.percentage || undefined,
        grade: v.grade || undefined,
        registerNumber: v.registerNumber || undefined,
        fileUrl: fileUrl || undefined,
      };
      return qual
        ? QualificationsApi.update(qual.id, payload)
        : QualificationsApi.create({ studentId, ...payload });
    },
    onSuccess: onSaved,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={qual ? 'Edit qualification' : 'Add qualification'}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSubmit((v) => save.mutate(v))}
            disabled={save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Examination / level"
          required
          error={errors.examName?.message}
          className="sm:col-span-2"
        >
          <Input
            {...register('examName')}
            placeholder="10th / SSLC, Higher Secondary, Diploma…"
          />
        </Field>
        <Field label="Board / University">
          <Input {...register('board')} placeholder="CBSE, State Board…" />
        </Field>
        <Field label="Institution">
          <Input {...register('institution')} />
        </Field>
        <Field label="Year of passing">
          <Input type="number" {...register('yearOfPassing')} placeholder="2021" />
        </Field>
        <Field label="Percentage / CGPA">
          <Input {...register('percentage')} placeholder="78% / 8.4" />
        </Field>
        <Field label="Grade">
          <Input {...register('grade')} placeholder="A+" />
        </Field>
        <Field label="Register / Roll #">
          <Input {...register('registerNumber')} />
        </Field>
        <Field label="Certificate (optional)" className="sm:col-span-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploadCert.isPending}
            >
              {uploadCert.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Upload
            </button>
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View
              </a>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadCert.mutate(f);
                e.target.value = '';
              }}
            />
          </div>
        </Field>
      </div>
      {save.error && (
        <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errMsg(save.error)}
        </div>
      )}
    </Modal>
  );
}

/* ── Documents ─────────────────────────────────────────────────────────────── */
function DocumentsTab({
  studentId,
  canWrite,
  canDelete,
}: {
  studentId: string;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ['documents', studentId],
    queryFn: () => DocumentsApi.list(studentId),
  });
  const [modal, setModal] = useState(false);
  const [confirm, setConfirm] = useState<{
    open: boolean;
    d?: StudentDocument;
  }>({ open: false });

  const remove = useMutation({
    mutationFn: (did: string) => DocumentsApi.remove(did),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['documents', studentId] });
      setConfirm({ open: false });
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        {canWrite && (
          <button
            className="btn-primary text-sm"
            onClick={() => setModal(true)}
          >
            <Upload className="mr-1.5 h-4 w-4" /> Upload document
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-slate-400">
          <FileText className="mx-auto mb-2 h-6 w-6 text-slate-300" />
          No documents uploaded (Aadhaar, TC, marksheets, proofs…).
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Badge tone="slate">{docLabel(d.type)}</Badge>
                  <div className="mt-1.5 truncate font-medium text-slate-900">
                    {d.title}
                  </div>
                  {d.fileName && (
                    <div className="truncate text-xs text-slate-400">
                      {d.fileName}
                    </div>
                  )}
                </div>
                {canDelete && (
                  <button
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={() => setConfirm({ open: true, d })}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              {d.note && <p className="mt-2 text-xs text-slate-500">{d.note}</p>}
              <a
                href={d.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open
              </a>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <DocumentModal
          studentId={studentId}
          onClose={() => setModal(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ['documents', studentId] });
            setModal(false);
          }}
        />
      )}

      <ConfirmDialog
        open={confirm.open}
        onClose={() => setConfirm({ open: false })}
        onConfirm={() => confirm.d && remove.mutate(confirm.d.id)}
        loading={remove.isPending}
        title="Delete document?"
        message={`Permanently remove "${confirm.d?.title}" and its file.`}
        confirmText="Delete"
      />
    </div>
  );
}

function DocumentModal({
  studentId,
  onClose,
  onSaved,
}: {
  studentId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<StudentDocumentType>('aadhaar');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [file, setFile] = useState<{ url: string; name: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadFile = useMutation({
    mutationFn: (f: File) => UploadApi.upload(f),
    onSuccess: (r) => {
      setFile({ url: r.url, name: r.name });
      if (!title) setTitle(r.name);
    },
  });
  const save = useMutation({
    mutationFn: () =>
      DocumentsApi.create({
        studentId,
        type,
        title: title || docLabel(type),
        fileUrl: file!.url,
        fileName: file!.name,
        note: note || undefined,
      }),
    onSuccess: onSaved,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Upload document"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => save.mutate()}
            disabled={!file || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Type" required>
          <Select
            value={type}
            onChange={(e) => setType(e.target.value as StudentDocumentType)}
          >
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Aadhaar card (front)"
          />
        </Field>
        <Field label="File" required>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploadFile.isPending}
            >
              {uploadFile.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              Choose file
            </button>
            {file && (
              <span className="truncate text-sm text-slate-600">
                {file.name}
              </span>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFile.mutate(f);
                e.target.value = '';
              }}
            />
          </div>
        </Field>
        <Field label="Note (optional)">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {(save.error || uploadFile.error) && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errMsg(save.error || uploadFile.error)}
          </div>
        )}
      </div>
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
